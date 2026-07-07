"""
LayeredChatPipeline: orchestrates the 7 layers end to end.

    Input -> Query Understanding -> Retrieval Planning -> Retrieval Runtime
    -> Knowledge Fusion -> Response Generation -> Learning

Replaces the legacy HybridChatService monolith (removed after cutover —
see AI_MIGRATION_PLAN.md and git history to restore it if ever needed).
Same process_message()/get_metrics() shape, so app/api/chat.py and
app/dependencies.py.get_hybrid_service() didn't need to change.
"""
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

from app.ai.understanding import get_query_parser
from app.ai.planning import get_retrieval_planner
from app.ai.retrieval import get_sql_business_retriever, get_business_vector_retriever, get_news_vector_retriever
from app.ai.fusion import get_knowledge_fusion, Evidence
from app.ai.generation import get_response_generator
from app.ai.learning import get_preference_store
from app.services.cache_service import get_cache_service
from app.services.conversation_service import get_conversation_service
from app.services.conversation_learning_service import get_learning_service
from app.services.sentiment_service import get_sentiment_service

logger = logging.getLogger(__name__)

_OPERATION_TO_COMPLEXITY = {
    "lookup_exact": "simple",
    "followup_lookup": "simple",
    "search": "semantic",
    "recommend": "semantic",
    "compare": "complex",
    "followup_reasoning": "complex",
    "greeting": "conversational",
    "smalltalk": "conversational",
}

FOLLOWUP_SUGGESTIONS_BUSINESS = ['💼 Thông tin chi tiết', '📞 Số điện thoại', '🔍 Tìm công ty khác']
FOLLOWUP_SUGGESTIONS_MIXED = ['📰 Tin tức khác', '🏢 Công ty liên quan', '🔍 Tìm kiếm chi tiết']
FOLLOWUP_SUGGESTIONS_DEFAULT = ['🏢 Tìm công ty IT', '📰 Tin tức công nghệ', '❓ Hướng dẫn']


class LayeredChatPipeline:
    def __init__(self):
        self.query_parser = get_query_parser()
        self.retrieval_planner = get_retrieval_planner()
        self.sql_business_retriever = get_sql_business_retriever()
        self.knowledge_fusion = get_knowledge_fusion()
        self.response_generator = get_response_generator()
        self.preference_store = get_preference_store()
        self.learning_service = get_learning_service()
        self.cache = get_cache_service()
        self.conv_service = get_conversation_service()
        self._cache_ttl_seconds = 3600

        self.metrics = {
            'simple_queries': 0, 'semantic_queries': 0, 'ai_queries': 0,
            'cache_hits': 0, 'total_queries': 0,
        }

        logger.info("🧩 LayeredChatPipeline initialized")

    # Lazy: avoid connecting to Gemini/DB for vector retrievers until first use
    @property
    def business_vector_retriever(self):
        return get_business_vector_retriever()

    @property
    def news_vector_retriever(self):
        return get_news_vector_retriever()

    def process_message(
        self,
        message: str,
        session_id: str = None,
        history: List[Dict] = None,
        action_button_id: str = None,
    ) -> Dict:
        start_time = datetime.now()
        self.metrics['total_queries'] += 1

        try:
            if not history and session_id:
                history = self.conv_service.get_conversation_history(session_id)

            if action_button_id and session_id:
                button_result = self._handle_button_action(action_button_id, message, history)
                if button_result:
                    button_result['response_time_ms'] = self._elapsed_ms(start_time)
                    return button_result

            sentiment_result = None
            try:
                sentiment_result = get_sentiment_service().analyze(message, history)
            except Exception as e:
                logger.warning(f"Sentiment analysis skipped: {e}")

            # app/api/chat.py saves the user's message to conversation_service
            # BEFORE fetching history, so `history` always contains at least
            # the current turn — `len(history) == 0` never happens for a real
            # API request and silently disabled caching entirely in
            # production. <=1 means "no prior turn", i.e. still cacheable.
            should_check_cache = not action_button_id and (not history or len(history) <= 1)
            if should_check_cache:
                cached = self.cache.get(self._cache_key(message))
                if cached:
                    self.metrics['cache_hits'] += 1
                    cached['cached'] = True
                    cached['response_time_ms'] = self._elapsed_ms(start_time)
                    return cached

            understanding = self.query_parser.parse(message, history)
            complexity = _OPERATION_TO_COMPLEXITY.get(understanding.operation, "semantic")
            logger.info(f"📊 Understanding: topic={understanding.topic} op={understanding.operation} (complexity~{complexity})")

            if understanding.topic == "conversation":
                result = self._handle_conversational(understanding, message)
            elif understanding.is_followup:
                result = self._handle_followup(understanding, message, history)
            else:
                result = self._handle_retrieval(understanding, history)

            result['complexity'] = complexity
            result['confidence'] = understanding.confidence
            result['hybrid'] = True
            self._bump_metric(complexity)

            if sentiment_result and sentiment_result.get('confidence', 0) >= 0.7:
                try:
                    result['answer'] = get_sentiment_service().adjust_tone(result['answer'], sentiment_result)
                    result['sentiment'] = sentiment_result['sentiment']
                    result['sentiment_confidence'] = sentiment_result['confidence']
                except Exception as e:
                    logger.warning(f"Tone adjustment skipped: {e}")

            result['response_time_ms'] = self._elapsed_ms(start_time)

            if should_check_cache and self._should_cache(complexity, result):
                self.cache.set(self._cache_key(message), result, self._cache_ttl_seconds)

            if session_id:
                try:
                    self.preference_store.upsert_from_message(session_id, None, message)
                except Exception as e:
                    logger.warning(f"Preference persistence failed: {e}")

            return result

        except Exception as e:
            logger.error(f"❌ Layered pipeline error: {e}", exc_info=True)
            return self._error_response(str(e))

    # ---- retrieval + fusion + generation ---------------------------------

    def _handle_retrieval(self, understanding, history: Optional[List[Dict]]) -> Dict:
        plan = self.retrieval_planner.plan(understanding)

        if plan.need_sql_exact:
            return self._handle_exact_lookup(understanding)

        businesses, news, source_methods = [], [], []

        if plan.need_business_vector:
            filters = {}
            if understanding.entities.region:
                filters['region'] = understanding.entities.region
            # No hard ILIKE filter on industry: the heuristic keyword vocabulary
            # (e.g. "it") never matches the real taxonomy stored in
            # businesses_demo.nganh_nghe (e.g. "Công Nghệ Thông Tin"), so a
            # strict WHERE filter here would silently zero out every result.
            # Vector similarity ranking already surfaces the right industry
            # (verified: query "IT" ranks all "Công Nghệ Thông Tin" businesses
            # above F&B/Logistics/Construction ones without any SQL filter).
            businesses = self.business_vector_retriever.search(
                understanding.raw_query, top_k=plan.top_k, threshold=plan.threshold, filters=filters,
            )
            source_methods.append('business_vector')

            # Fallback to a plain attribute filter when semantic search comes
            # back empty but the query only carries a region/industry filter
            # and no other content (e.g. "liệt kê công ty ở miền Nam") — every
            # business scores similarly low against such a generic query, so
            # the similarity threshold filters everything out even though
            # matching rows exist. Mirrors the legacy "fallback to simple SQL"
            # behavior that got dropped when this was rewritten.
            if not businesses and filters:
                businesses = self.sql_business_retriever.list_by_filters(
                    region=filters.get('region'), industry=filters.get('industry'), limit=plan.top_k,
                )
                if businesses:
                    source_methods.append('business_sql_filter_fallback')

        if plan.need_news_vector:
            news = self.news_vector_retriever.search(
                understanding.raw_query, top_k=min(plan.top_k, 5), threshold=0.3,
            )
            source_methods.append('news_vector')

            # Fallback to "most recent news" when the request has no topical
            # content for similarity search to match against (e.g. "hôm nay
            # có tin gì thú vị") — same reasoning as the business SQL filter
            # fallback above.
            if not news:
                news = self.news_vector_retriever.list_recent(limit=min(plan.top_k, 5))
                if news:
                    source_methods.append('news_recent_fallback')

        evidence = self.knowledge_fusion.fuse(
            businesses=businesses, news=news, source_methods=source_methods,
        )

        learning_hints, learning_context = {}, None
        if history:
            try:
                preferences = self.learning_service.extract_user_preferences(history)
                context = self.learning_service.get_conversation_context(history)
                learning_hints = self.learning_service.personalize_response_hints(preferences, context)
                learning_context = self.learning_service.format_learning_context(history)
            except Exception as e:
                logger.warning(f"Learning hints unavailable: {e}")

        answer = self.response_generator.generate(understanding, evidence, learning_context, learning_hints)

        followups = FOLLOWUP_SUGGESTIONS_MIXED if (evidence.has_business and evidence.has_news) else (
            FOLLOWUP_SUGGESTIONS_BUSINESS if evidence.has_business else FOLLOWUP_SUGGESTIONS_DEFAULT
        )

        return {
            'answer': answer,
            'suggested_businesses': evidence.businesses,
            'documents': evidence.news,
            'search_method': "+".join(source_methods) or "no_retrieval",
            'rag_used': bool(source_methods),
            'followup_suggestions': followups,
        }

    def _handle_exact_lookup(self, understanding) -> Dict:
        entities = understanding.entities
        businesses: List[Dict] = []

        if entities.phone:
            businesses = self.sql_business_retriever.lookup_by_phone(entities.phone)
        elif entities.company_name:
            name = entities.company_name.strip()
            exact_hint = len(name.split()) >= 4
            businesses = self.sql_business_retriever.lookup_by_name(name, exact_hint=exact_hint)

        if not businesses:
            searched = entities.company_name or entities.phone or ""
            return {
                'answer': (
                    f"🔍 Em không tìm thấy công ty phù hợp với **\"{searched}\"** trong cơ sở dữ liệu.\n\n"
                    f"Vui lòng kiểm tra lại tên/số điện thoại, hoặc thử: *\"Gợi ý công ty xây dựng\"* "
                    f"để em tìm các công ty tương tự."
                ),
                'suggested_businesses': [],
                'documents': [],
                'search_method': 'sql_exact_not_found',
                'rag_used': False,
                'followup_suggestions': ['🔍 Tìm công ty xây dựng', '🏢 Gợi ý công ty tương tự', '❓ Hướng dẫn tìm kiếm'],
            }

        wants_details = any(
            kw in understanding.raw_query.lower()
            for kw in ['thông tin', 'chi tiết', 'thong tin', 'chi tiet']
        )
        if wants_details and len(businesses) == 1:
            answer = self._format_business_details(businesses[0])
        else:
            answer = f"Tìm thấy {len(businesses)} công ty:"

        return {
            'answer': answer,
            'suggested_businesses': businesses,
            'documents': [],
            'search_method': 'sql_exact',
            'rag_used': False,
            'followup_suggestions': FOLLOWUP_SUGGESTIONS_BUSINESS,
        }

    def _format_business_details(self, company: Dict) -> str:
        lines = [
            f"📋 **{company['name']}**\n",
            f"📞 **Điện thoại**: {company.get('phone', 'Chưa có')}",
            f"📍 **Địa chỉ**: {company.get('address') or company.get('location', 'Chưa có')} - {company.get('region', '')}",
            f"🏭 **Ngành nghề**: {company.get('industry', 'Chưa có')}",
            f"🌐 **Website**: {company.get('website', 'Chưa có')}",
            f"📧 **Email**: {company.get('email', 'Chưa có')}",
        ]
        if company.get('scale'):
            lines.append(f"👥 **Quy mô**: {company['scale']}")
        if company.get('description'):
            lines.append(f"📝 **Mô tả**: {company['description']}")
        lines.append("\nBạn cần thêm thông tin gì không? 😊")
        return "\n".join(lines)

    # ---- follow-up (reuses context from history, no fresh retrieval) -----

    def _handle_followup(self, understanding, message: str, history: Optional[List[Dict]]) -> Dict:
        last_context = self._get_last_context(history or [])
        businesses = last_context.get('suggested_businesses', [])

        if not businesses:
            return {
                'answer': 'Em chưa gợi ý công ty nào trước đó. Bạn muốn tìm công ty gì nhỉ? 🔍',
                'suggested_businesses': [], 'documents': [],
                'search_method': 'followup_no_context', 'rag_used': False,
            }

        if understanding.operation == "followup_lookup":
            return self._handle_followup_lookup_field(understanding, message, businesses)

        evidence = Evidence(businesses=businesses[:10], source_methods=['conversation_context'])
        answer = self.response_generator.generate(understanding, evidence)
        return {
            'answer': answer,
            'suggested_businesses': businesses[:3],
            'documents': [],
            'search_method': 'followup_reasoning',
            'rag_used': True,
            'followup_suggestions': ['📞 Xem số điện thoại', '📍 Xem địa chỉ', '🔍 Tìm công ty khác'],
        }

    def _handle_followup_lookup_field(self, understanding, message: str, businesses: List[Dict]) -> Dict:
        """Cheap, deterministic lookup of a single field on the last-mentioned
        company — no LLM call, mirrors the old fast-path philosophy for
        simple context lookups. Falls through to the LLM (with the company
        as evidence) for anything that isn't one of these known fields —
        e.g. confirmation questions like "công ty này ở Hồ Chí Minh đúng
        không" — instead of a non-answer template."""
        message_lower = message.lower()
        company = businesses[0]

        if any(kw in message_lower for kw in ['số', 'phone', 'điện thoại']):
            answer = f"📞 Số điện thoại **{company['name']}**: {company.get('phone', 'Chưa có')}"
        elif any(kw in message_lower for kw in ['địa chỉ', 'address', 'ở đâu', ' ở ', 'o dau']):
            answer = f"📍 **{company['name']}** ở {company.get('region', '')} - {company.get('location', '')}"
        elif any(kw in message_lower for kw in ['ngành', 'industry', 'làm', 'hoạt động']):
            answer = f"🏭 **{company['name']}** hoạt động trong lĩnh vực: {company.get('industry', 'N/A')}"
        else:
            evidence = Evidence(businesses=[company], source_methods=['conversation_context'])
            answer = self.response_generator.generate(understanding, evidence)

        return {
            'answer': answer,
            'suggested_businesses': [company],
            'documents': [],
            'search_method': 'followup_lookup',
            'rag_used': False,
        }

    def _handle_button_action(self, action_button_id: str, message: str, history: Optional[List[Dict]]) -> Optional[Dict]:
        last_context = self._get_last_context(history or [])
        businesses = last_context.get('suggested_businesses', [])
        if not businesses:
            return None

        company = businesses[0]
        message_lower = message.lower()

        if any(kw in message_lower for kw in ['thông tin', 'chi tiết', 'thong tin', 'chi tiet']):
            return {
                'answer': self._format_business_details(company), 'suggested_businesses': [company], 'documents': [],
                'search_method': 'button_action_details', 'rag_used': False, 'response_time_ms': 50,
                'followup_suggestions': ['📞 Gọi ngay', '🔍 Tìm công ty khác', '📰 Tin tức liên quan'],
            }
        if any(kw in message_lower for kw in ['số', 'phone', 'điện thoại', 'dien thoai', 'sđt']):
            return {
                'answer': f"📞 Số điện thoại **{company['name']}**: {company.get('phone', 'Chưa có')}",
                'suggested_businesses': [company], 'documents': [],
                'search_method': 'button_action_phone', 'rag_used': False, 'response_time_ms': 50,
            }
        if any(kw in message_lower for kw in ['địa chỉ', 'dia chi', 'address', 'ở đâu', 'o dau']):
            return {
                'answer': f"📍 **{company['name']}** ở {company.get('region', '')} - {company.get('location', 'Chưa có')}",
                'suggested_businesses': [company], 'documents': [],
                'search_method': 'button_action_address', 'rag_used': False, 'response_time_ms': 50,
            }
        return None

    def _handle_conversational(self, understanding, message: str) -> Dict:
        message_lower = message.lower()
        word_count = len(message.split())

        # Pure, content-free greeting/thanks ("chào", "hi", "cảm ơn") stays
        # a free/instant template. Anything with actual content beyond that
        # — e.g. "hi hôm nay là chủ nhật đúng không" — used to fall into the
        # same canned greeting reply regardless of what was actually asked,
        # because this never called the LLM at all. Now it does.
        is_pure_greeting = word_count <= 4 and re.fullmatch(
            r"(xin\s+)?(chào|hello|hi|hey)( bạn| anh| chị)?[!.\s]*", message_lower
        )
        is_pure_thanks = word_count <= 5 and re.search(r'cảm ơn|thank', message_lower)

        if is_pure_greeting:
            answer = 'Chào anh/chị! 👋 Em là Company đây, hôm nay cần tìm doanh nghiệp hay tin tức gì để em lục giúp không? 😄'
        elif is_pure_thanks:
            answer = 'Có gì đâu ạ, em rất vui vì giúp được anh/chị! Cần gì cứ hỏi em tiếp nha 😊'
        else:
            answer = self.response_generator.generate_smalltalk(understanding.raw_query)

        return {
            'answer': answer, 'suggested_businesses': [], 'documents': [],
            'search_method': 'conversational', 'rag_used': False,
            'followup_suggestions': FOLLOWUP_SUGGESTIONS_DEFAULT,
        }

    # ---- helpers -----------------------------------------------------

    def _get_last_context(self, history: List[Dict]) -> Dict:
        for msg in reversed(history):
            if msg.get('role') == 'assistant' and msg.get('context'):
                return msg['context']
        return {}

    def _cache_key(self, message: str) -> str:
        normalized = re.sub(r'\s+', ' ', message.lower().strip())
        return f"chat:{normalized[:100]}"

    def _should_cache(self, complexity: str, result: Dict) -> bool:
        if complexity in ("simple", "semantic") and (result.get('suggested_businesses') or result.get('documents')):
            return True
        return complexity == "conversational"

    def _bump_metric(self, complexity: str):
        if complexity == "simple":
            self.metrics['simple_queries'] += 1
        elif complexity == "semantic":
            self.metrics['semantic_queries'] += 1
        elif complexity == "complex":
            self.metrics['ai_queries'] += 1

    def _elapsed_ms(self, start_time: datetime) -> int:
        return int((datetime.now() - start_time).total_seconds() * 1000)

    def _error_response(self, error_msg: str) -> Dict:
        return {
            'answer': 'Ui, nói chuyện nhiều quá làm mình bị hụt hơi rồi. Cho mình thở một tí nhé!',
            'suggested_businesses': [], 'documents': [],
            'search_method': 'error', 'rag_used': False, 'error': error_msg,
        }

    def get_metrics(self) -> Dict:
        total = self.metrics['total_queries']
        if total == 0:
            return self.metrics
        return {
            **self.metrics,
            'simple_percent': round(self.metrics['simple_queries'] / total * 100, 2),
            'semantic_percent': round(self.metrics['semantic_queries'] / total * 100, 2),
            'ai_percent': round(self.metrics['ai_queries'] / total * 100, 2),
            'cache_hit_rate': round(self.metrics['cache_hits'] / total * 100, 2),
        }


_layered_pipeline: Optional[LayeredChatPipeline] = None


def get_layered_chat_pipeline() -> LayeredChatPipeline:
    global _layered_pipeline
    if _layered_pipeline is None:
        _layered_pipeline = LayeredChatPipeline()
    return _layered_pipeline
