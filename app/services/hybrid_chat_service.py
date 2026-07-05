import re
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings
from app.services.semantic_business_service import get_semantic_business_service
from app.services.rag_service import RAGService
from app.services.conversation_service import get_conversation_service

logger = logging.getLogger(__name__)


class QueryComplexity:
    """Query complexity levels"""
    SIMPLE = "simple"           # Exact match: name, phone
    SEMANTIC = "semantic"       # Fuzzy: industry, recommendation
    COMPLEX = "complex"         # Multi-step, reasoning
    CONVERSATIONAL = "conversational"  # Greetings, casual chat


class HybridChatService:
    """
    Intelligent hybrid chat service
    
    Benefits:
    - 70% cost reduction vs full AI
    - 2-3x faster for simple queries
    - Maintains AI flexibility for complex queries
    - Graceful degradation on AI failures
    """
    
    def __init__(self, rag_service: Optional[RAGService] = None):
        """Initialize hybrid service with all engines"""
        self.rag_service = rag_service
        self.semantic_service = None  # Lazy load
        self.conv_service = get_conversation_service()
        
        # Performance metrics
        self.metrics = {
            'simple_queries': 0,
            'semantic_queries': 0,
            'ai_queries': 0,
            'cache_hits': 0,
            'total_queries': 0
        }
        
        # Simple response cache (in-memory)
        self._cache = {}
        self._cache_ttl = timedelta(hours=1)
        
        logger.info("🔥 HybridChatService initialized - Ready for production!")
    
    def process_message(
        self,
        message: str,
        session_id: str = None,
        history: List[Dict] = None,
        action_button_id: str = None
    ) -> Dict:
        """
        Main entry point - intelligently routes query
        
        Args:
            message: User message
            session_id: Session ID for context
            history: Conversation history
            action_button_id: Optional button action
            
        Returns:
            Response dict with answer, businesses, news, etc.
        """
        start_time = datetime.now()
        self.metrics['total_queries'] += 1
        
        logger.info(f"🎯 HYBRID CHAT: {message[:100]}...")
        if action_button_id:
            logger.info(f"🔘 Button action: {action_button_id}")
        
        try:
            # Step 0.5: Handle button actions with context
            # Get history early if not provided
            if not history and session_id:
                history = self.conv_service.get_conversation_history(session_id)
            
            if action_button_id and session_id:
                button_result = self._handle_button_action(action_button_id, message, session_id, history)
                if button_result:
                    logger.info(f"✅ Button action handled: {action_button_id}")
                    button_result['response_time_ms'] = int((datetime.now() - start_time).total_seconds() * 1000)
                    return button_result
            
            # Step 0: Analyze sentiment (fast, improves UX)
            sentiment_result = None
            try:
                from app.services.sentiment_service import get_sentiment_service
                sentiment_service = get_sentiment_service()
                sentiment_result = sentiment_service.analyze(message, history)
                logger.info(f"😊 Sentiment: {sentiment_result['sentiment']} (confidence: {sentiment_result['confidence']:.2f})")
            except Exception as e:
                logger.warning(f"Sentiment analysis skipped: {e}")
            
            # Step 1: Check cache first (SKIP for context-dependent queries)
            # Don't cache if:
            # - Button action (needs context)
            # - Has history (follow-up query)
            should_check_cache = not action_button_id and (not history or len(history) == 0)
            
            if should_check_cache:
                cache_key = self._get_cache_key(message)
                cached = self._get_from_cache(cache_key)
                if cached:
                    self.metrics['cache_hits'] += 1
                    logger.info(f"⚡ CACHE HIT: {cache_key[:50]}...")
                    cached['cached'] = True
                    cached['response_time_ms'] = int((datetime.now() - start_time).total_seconds() * 1000)
                    return cached
            
            # Step 2: Classify query complexity
            complexity, confidence, features = self._classify_query(message, history)
            logger.info(f"📊 Classified as: {complexity} (confidence: {confidence:.2f})")
            
            # Step 3: Route to appropriate handler
            if complexity == QueryComplexity.SIMPLE:
                result = self._handle_simple_query(message, features, session_id)
                self.metrics['simple_queries'] += 1
                
            elif complexity == QueryComplexity.SEMANTIC:
                result = self._handle_semantic_query(message, features, session_id, history)
                self.metrics['semantic_queries'] += 1
                
            elif complexity == QueryComplexity.CONVERSATIONAL:
                result = self._handle_conversational(message, session_id)
                
            else:  # COMPLEX
                result = self._handle_complex_query(message, session_id, history)
                self.metrics['ai_queries'] += 1
            
            # Step 4: Add metadata
            result['complexity'] = complexity
            result['confidence'] = confidence
            result['response_time_ms'] = int((datetime.now() - start_time).total_seconds() * 1000)
            result['hybrid'] = True
            
            # Step 4.5: Adjust tone based on sentiment
            if sentiment_result and sentiment_result.get('confidence', 0) >= 0.7:
                try:
                    from app.services.sentiment_service import get_sentiment_service
                    sentiment_service = get_sentiment_service()
                    result['answer'] = sentiment_service.adjust_tone(result['answer'], sentiment_result)
                    result['sentiment'] = sentiment_result['sentiment']
                    result['sentiment_confidence'] = sentiment_result['confidence']
                except Exception as e:
                    logger.warning(f"Tone adjustment skipped: {e}")
            
            # Step 5: Cache if appropriate (and was eligible for caching)
            if should_check_cache and self._should_cache(complexity, result):
                cache_key = self._get_cache_key(message)
                self._add_to_cache(cache_key, result)
            
            logger.info(f"✅ Response ready: {complexity} path, {result['response_time_ms']}ms")
            return result
            
        except Exception as e:
            logger.error(f"❌ Hybrid chat error: {e}", exc_info=True)
            return self._error_response(str(e))
    
    def _classify_query(
        self,
        message: str,
        history: List[Dict] = None
    ) -> Tuple[str, float, Dict]:
        """
        Classify query complexity using heuristics
        
        Returns:
            (complexity_level, confidence, extracted_features)
        """
        message_lower = message.lower()
        features = {
            'has_phone': False,
            'has_company_name': False,
            'has_industry': False,
            'has_fuzzy_intent': False,
            'has_greeting': False,
            'is_followup': False,
            'is_news_query': False,
            'word_count': len(message.split())
        }
        
        # Feature extraction
        
        # 1. Phone number detection
        phone_pattern = r'\b\d[\d\s\.\-]{7,}\b'
        if re.search(phone_pattern, message):
            features['has_phone'] = True
            return (QueryComplexity.SIMPLE, 0.95, features)
        
        # 2. FOLLOW-UP DETECTION (PRIORITIZE FIRST!)
        # Check if this references previous context like "10 cái đó", "công ty nào", etc.
        if history and len(history) > 1:
            followup_strong_indicators = [
                'cái đó', 'cái nào', 'trong đó', 'trong những', 'trong 10',
                'công ty nào', 'cong ty nao', 'doanh nghiệp nào', 'doanh nghiep nao',
                'so sánh', 'so sanh', 'khác nhau', 'khac nhau', 'tốt hơn', 'tot hon',
                'đầu tiên', 'dau tien', 'tốt nhất', 'tot nhat', 'hàng đầu', 'hang dau'
            ]
            followup_weak_indicators = [
                'nó', 'đó', 'do', 'này', 'nay', 'kia', 'ấy', 'ay', 'họ', 'ho'
            ]
            
            # Strong indicators: Always route to COMPLEX (AI reasoning)
            strong_count = sum(1 for ind in followup_strong_indicators if ind in message_lower)
            if strong_count >= 1:
                features['is_followup'] = True
                features['followup_type'] = 'reasoning'  # Needs AI to compare/analyze
                return (QueryComplexity.COMPLEX, 0.95, features)
            
            # Weak indicators: Route to SIMPLE (lookup from context)
            weak_count = sum(1 for ind in followup_weak_indicators if ind in message_lower)
            if weak_count >= 2 or (features['word_count'] <= 10 and weak_count >= 1):
                features['is_followup'] = True
                features['followup_type'] = 'simple'  # Just lookup
                return (QueryComplexity.SIMPLE, 0.85, features)
        
        # 3. Exact company name detection (CHECK BEFORE GENERIC BUSINESS KEYWORDS!)
        # Detect when user asks about a SPECIFIC company by name
        specific_company_indicators = [
            r'công\s+ty\s+(?:cổ\s+phần|tnhh|trách\s+nhiệm|cp|mtv)\s+[\wÀ-ỹ\s]{3,}',  # CÔNG TY CP/TNHH + name (Unicode-aware)
            r'(?:chi\s+tiết|thông\s+tin|địa\s+chỉ|số\s+điện\s+thoại).+công\s+ty\s+[A-Z\wÀ-ỹ]',  # "chi tiết công ty X"
            r'\b(fpt|viettel|vng|vingroup|grab|shopee|lazada|tiki|samsung|lg)\b',  # Famous companies
        ]
        
        for pattern in specific_company_indicators:
            if re.search(pattern, message_lower):
                features['has_company_name'] = True
                features['exact_name'] = True
                return (QueryComplexity.SIMPLE, 0.95, features)
        
        # Check if message contains "công ty" + long specific name (likely exact search)
        # BUT exclude generic questions like "công ty nào" or "công ty IT"
        if 'công ty' in message_lower or 'cong ty' in message_lower:
            # Exclude if it's a follow-up question
            followup_excludes = ['công ty nào', 'cong ty nao', 'trong', 'cái đó', 'cai do']
            if any(ex in message_lower for ex in followup_excludes):
                # This is follow-up, skip
                pass
            else:
                # Count words after "công ty" - if many words, likely a specific name
                parts = re.split(r'công\s+ty|cong\s+ty', message_lower)
                if len(parts) > 1:
                    after_company = parts[1].strip()
                    
                    # Remove location/question words first
                    after_company_cleaned = re.sub(r'\s*(ở|o|tại|tai)\s+[\wÀ-ỹ\s]+$', '', after_company)
                    after_company_cleaned = re.sub(r'\s*(là\s+gì|la\s+gi|thế\s+nào|the\s+nao)\s*$', '', after_company_cleaned)
                    
                    word_count_after = len(after_company_cleaned.split())
                    
                    # If 4+ words AND not generic keywords like "it", "tốt"
                    generic_keywords = ['it', 'tot', 'tốt', 'uy tín', 'uy tin', 'nổi tiếng', 'noi tieng', 'tìm', 'tim']
                    has_generic = any(kw == after_company_cleaned.strip() or kw in after_company_cleaned.split()[:2] for kw in generic_keywords)
                    
                    if word_count_after >= 4 and not has_generic:
                        features['has_company_name'] = True
                        features['exact_name'] = True
                        features['extracted_name'] = after_company_cleaned
                        logger.info(f"🎯 Detected specific company name: {after_company_cleaned[:50]}...")
                        return (QueryComplexity.SIMPLE, 0.92, features)
        
        # 4. Business/fuzzy intent detection (ONLY if not specific company name)
        # Check for business search keywords (but NOT if it's follow-up reasoning)
        fuzzy_keywords = [
            'gợi ý', 'goi y', 'giới thiệu', 'gioi thieu', 'tư vấn', 'tu van',
            'nên', 'nen', 'uy tín', 'uy tin', 'tốt', 'tot', 'chất lượng', 'chat luong',
            'nổi tiếng', 'noi tieng', 'recommend', 'suggest', 'tìm', 'tim',
            'cần', 'can', 'muốn', 'muon', 'doanh nghiệp', 'doanh nghiep'
        ]
        industry_keywords = [
            'it', 'công nghệ', 'cong nghe', 'phần mềm', 'phan mem',
            'ai', 'blockchain', 'fintech', 'thương mại điện tử', 'thuong mai dien tu',
            'e-commerce', 'logistics', 'du lịch', 'du lich', 'nhà hàng', 'nha hang'
        ]
        
        has_fuzzy = any(kw in message_lower for kw in fuzzy_keywords)
        has_industry = any(kw in message_lower for kw in industry_keywords)
        
        if has_fuzzy or has_industry:
            features['has_fuzzy_intent'] = has_fuzzy
            features['has_industry'] = has_industry
            return (QueryComplexity.SEMANTIC, 0.90, features)
        
        # 5. Greeting detection (AFTER business and follow-up check)
        greetings = ['xin chào', 'hello', 'hi ', ' hi', 'hey', 'em tên gì', 'em là ai']
        if any(g in message_lower for g in greetings):
            features['has_greeting'] = True
            return (QueryComplexity.CONVERSATIONAL, 0.90, features)
        
        # 6. NEWS QUERY DETECTION - Always use RAG for news
        news_keywords = [
            'tin tức', 'tin tuc', 'news', 'bài viết', 'bai viet',
            'báo', 'bao', 'thông tin mới', 'thong tin moi', 'xu hướng', 'xu huong',
            'sự kiện', 'su kien', 'diễn biến', 'dien bien', 'cập nhật', 'cap nhat'
        ]
        if any(kw in message_lower for kw in news_keywords):
            features['is_news_query'] = True
            return (QueryComplexity.COMPLEX, 0.90, features)
        
        # 7. Complex query detection
        # Multi-clause, long, or requires reasoning
        complex_indicators = [
            'so sánh', 'khác nhau', 'tốt hơn', 'và', 'hoặc', 'sau đó',
            'trước tiên', 'tiếp theo', 'top', 'đầu tiên', 'thống kê'
        ]
        
        if features['word_count'] > 15:
            return (QueryComplexity.COMPLEX, 0.70, features)
        
        complex_count = sum(1 for ind in complex_indicators if ind in message_lower)
        if complex_count >= 2:
            return (QueryComplexity.COMPLEX, 0.75, features)
        
        # Default: semantic (safe fallback)
        return (QueryComplexity.SEMANTIC, 0.60, features)
    
    def _handle_simple_query(
        self,
        message: str,
        features: Dict,
        session_id: str = None
    ) -> Dict:
        """
        Fast path: Direct SQL query (no AI)
        
        Handles:
        - Exact company name search
        - Phone number lookup
        - Follow-up questions from context
        """
        logger.info("🚀 FAST PATH: Direct SQL query")
        
        message_lower = message.lower()
        
        try:
            # Follow-up from context
            if features['is_followup'] and session_id:
                history = self.conv_service.get_conversation_history(session_id)
                last_context = self._get_last_context(history)
                
                if last_context and last_context.get('suggested_businesses'):
                    company = last_context['suggested_businesses'][0]
                    
                    # Extract what user wants
                    if any(kw in message_lower for kw in ['số', 'phone', 'điện thoại']):
                        return self._format_business_response(
                            [company],
                            f"📞 Số điện thoại **{company['name']}**: {company['phone']}",
                            'simple_followup'
                        )
                    
                    elif any(kw in message_lower for kw in ['địa chỉ', 'address', 'ở đâu']):
                        return self._format_business_response(
                            [company],
                            f"📍 **{company['name']}** ở {company.get('region', '')} - {company.get('location', '')}",
                            'simple_followup'
                        )
                    
                    elif any(kw in message_lower for kw in ['ngành', 'industry', 'làm', 'hoạt động']):
                        return self._format_business_response(
                            [company],
                            f"🏭 **{company['name']}** hoạt động trong lĩnh vực: {company.get('industry', 'N/A')}",
                            'simple_followup'
                        )
            
            # Direct SQL search
            conn = psycopg2.connect(**settings.database_url)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            sql = """
                SELECT id, ten_doanh_nghiep, so_dien_thoai, tinh_thanh,
                       vung_mien, nganh_nghe, website, email
                FROM businesses_demo
                WHERE 1=1
            """
            params = []
            
            # Phone search
            if features['has_phone']:
                phone_match = re.search(r'\d[\d\s\.\-]{7,}', message)
                if phone_match:
                    phone_raw = phone_match.group()
                    phone_clean = re.sub(r'[\s\.\-]', '', phone_raw)
                    
                    # Normalize: convert both 0xxx and +84xxx to same format for matching
                    # User might search: "0915563288" but DB has "+84915563288" (or vice versa)
                    phone_variants = [phone_clean]
                    
                    if phone_clean.startswith('0'):
                        # Convert 0915563288 → 84915563288
                        phone_variants.append('84' + phone_clean[1:])
                    elif phone_clean.startswith('+84'):
                        # Convert +84915563288 → 84915563288 and 0915563288
                        normalized = phone_clean.replace('+', '')
                        phone_variants.append(normalized)
                        phone_variants.append('0' + normalized[2:])
                    elif phone_clean.startswith('84') and len(phone_clean) >= 10:
                        # Convert 84915563288 → 0915563288
                        phone_variants.append('0' + phone_clean[2:])
                    
                    # Search all variants
                    logger.info(f"📞 Phone search variants: {phone_variants}")
                    sql += " AND ("
                    sql += " OR ".join([
                        "REPLACE(REPLACE(REPLACE(REPLACE(so_dien_thoai, ' ', ''), '.', ''), '-', ''), '+', '') LIKE %s"
                        for _ in phone_variants
                    ])
                    sql += ")"
                    params.extend([f'%{variant}%' for variant in phone_variants])
            
            # Company name search
            elif features['has_company_name']:
                # Extract full company name after "công ty"
                name_to_search = features.get('extracted_name')  # Use pre-extracted name if available
                
                if not name_to_search:
                    # Try to extract everything after "công ty"
                    patterns_to_try = [
                        r'(?:công\s+ty|cong\s+ty)\s+(.+?)(?:\s*$|(?=[.?!,]))',  # Everything after "công ty"
                        r'(?:chi\s+tiết|thông\s+tin|địa\s+chỉ).+?(công\s+ty\s+.+?)(?:\s*$|(?=[.?!,]))',  # "thông tin công ty X"
                    ]
                    
                    for pattern in patterns_to_try:
                        match = re.search(pattern, message_lower)
                        if match:
                            name_to_search = match.group(1).strip() if len(match.groups()) > 0 else match.group(0)
                            # Remove common question words at the end
                            name_to_search = re.sub(r'\s*(là\s+gì|ở\s+đâu|thế\s+nào)\s*$', '', name_to_search)
                            break
                    
                    # Fallback: famous company names
                    if not name_to_search:
                        famous = ['fpt', 'viettel', 'vng', 'vingroup', 'grab', 'shopee', 'lazada', 'tiki']
                        for famous_name in famous:
                            if famous_name in message_lower:
                                name_to_search = famous_name
                                break
                
                if name_to_search:
                    logger.info(f"🔍 Searching for company name: {name_to_search}")
                    
                    # For specific exact search, use stricter matching
                    if features.get('exact_name') and len(name_to_search.split()) >= 4:
                        # Very specific name - try exact match first, then partial
                        sql += " AND (ten_doanh_nghiep ILIKE %s OR ten_doanh_nghiep ILIKE %s)"
                        params.append(f'{name_to_search}')  # Exact
                        params.append(f'%{name_to_search}%')  # Partial fallback
                        logger.info(f"  Using strict exact search for: {name_to_search}")
                    else:
                        # Famous company or short name - use partial match
                        sql += " AND ten_doanh_nghiep ILIKE %s"
                        params.append(f'%{name_to_search}%')
            
            sql += " ORDER BY updated_at DESC LIMIT 10"
            
            cur.execute(sql, params)
            businesses = cur.fetchall()
            
            cur.close()
            conn.close()
            
            if not businesses:
                # If searching for specific company name, give more helpful message
                if features['has_company_name'] and name_to_search:
                    logger.warning(f"❌ Company not found: {name_to_search}")
                    return {
                        'answer': f"🔍 Em không tìm thấy công ty tên **\"{name_to_search}\"** trong cơ sở dữ liệu.\n\n"
                                 f"Vui lòng kiểm tra lại:\n"
                                 f"• Tên công ty có chính xác không?\n"
                                 f"• Thử tìm theo từ khóa hoặc ngành nghề?\n\n"
                                 f"💡 Hoặc bạn có thể nói: *\"Gợi ý công ty xây dựng\"* để em tìm các công ty tương tự.",
                        'suggested_businesses': [],
                        'search_method': 'simple_sql_not_found',
                        'rag_used': False,
                        'searched_name': name_to_search,
                        'followup_suggestions': [
                            '🔍 Tìm công ty xây dựng',
                            '🏢 Gợi ý công ty tương tự',
                            '❓ Hướng dẫn tìm kiếm'
                        ]
                    }
                else:
                    return {
                        'answer': 'Không tìm thấy công ty phù hợp. Thử mô tả rõ hơn nhé!',
                        'suggested_businesses': [],
                        'search_method': 'simple_sql',
                        'rag_used': False
                    }
            
            results = []
            for biz in businesses:
                results.append({
                    'id': biz.get('id'),
                    'name': biz.get('ten_doanh_nghiep', 'N/A'),
                    'phone': biz.get('so_dien_thoai', 'Chưa có'),
                    'location': biz.get('tinh_thanh', ''),
                    'region': biz.get('vung_mien', ''),
                    'industry': biz.get('nganh_nghe', ''),
                    'website': biz.get('website', ''),
                    'email': biz.get('email', '')
                })
            
            return self._format_business_response(
                results,
                f"Tìm thấy {len(results)} công ty:",
                'simple_sql'
            )
            
        except Exception as e:
            logger.error(f"Simple query error: {e}")
            return self._error_response(str(e))
    
    def _handle_semantic_query(
        self,
        message: str,
        features: Dict,
        session_id: str = None,
        history: List[Dict] = None
    ) -> Dict:
        """
        Semantic path: AI for understanding + SQL for data
        
        Uses:
        - Semantic search for fuzzy matching
        - Embeddings for similarity
        - Rules for filtering
        """
        logger.info("✨ SEMANTIC PATH: AI embeddings + SQL")
        
        try:
            # Lazy load semantic service
            if not self.semantic_service:
                self.semantic_service = get_semantic_business_service()
            
            # Extract filters from message
            filters = self._extract_filters(message)
            
            # Semantic search with HIGHER threshold for better results
            results = self.semantic_service.semantic_search(
                query=message,
                top_k=10,
                threshold=0.35,  # Increased from 0.18 for better quality
                filters=filters
            )
            
            if results:
                return self._format_business_response(
                    results,
                    f"✨ Em gợi ý {len(results)} công ty phù hợp nhất:",
                    'semantic_ai'
                )
            
            # Fallback to simple SQL if semantic fails
            logger.warning("Semantic search returned 0, falling back to simple")
            return self._handle_simple_query(message, features, session_id)
            
        except Exception as e:
            logger.error(f"Semantic query error: {e}")
            # Graceful degradation
            return self._handle_simple_query(message, features, session_id)
    
    def _handle_complex_query(
        self,
        message: str,
        session_id: str = None,
        history: List[Dict] = None
    ) -> Dict:
        """
        Complex path: Use RAG for news + Semantic for businesses + AI reasoning for follow-ups
        
        For:
        - News queries with RAG
        - Multi-step reasoning
        - Comparisons
        - Follow-up questions that need AI reasoning (e.g., "which one is best")
        """
        logger.info("🤖 COMPLEX PATH: RAG (news) + Semantic (businesses) + AI reasoning")
        
        try:
            # Check if this is a FOLLOW-UP question needing reasoning
            message_lower = message.lower()
            followup_reasoning_keywords = [
                'cái nào', 'công ty nào', 'doanh nghiệp nào', 'trong đó', 'trong 10', 'trong những',
                'tốt nhất', 'tot nhat', 'hàng đầu', 'hang dau', 'đầu tiên', 'dau tien',
                'so sánh', 'so sanh', 'khác nhau', 'khac nhau', 'tốt hơn', 'tot hon'
            ]
            
            is_followup_reasoning = any(kw in message_lower for kw in followup_reasoning_keywords)
            
            if is_followup_reasoning and history and len(history) > 1:
                logger.info("🔄 FOLLOW-UP REASONING: Using AI with context")
                return self._handle_followup_reasoning(message, session_id, history)
            
            # Otherwise, proceed with normal RAG + Semantic
            results = {
                'documents': [],
                'suggested_businesses': [],
                'answer': '',
                'search_method': 'hybrid_rag_semantic',
                'rag_used': True
            }
            
            # 1. RAG search for NEWS
            if self.rag_service:
                logger.info("📰 Searching news with RAG...")
                rag_result = self.rag_service.chat(
                    query=message,
                    top_k=5,
                    threshold=0.3
                )
                results['documents'] = rag_result.get('documents', [])
                results['answer'] = rag_result.get('answer', '')
            
            # 2. Semantic search for BUSINESSES
            if not self.semantic_service:
                self.semantic_service = get_semantic_business_service()
            
            logger.info("🏢 Searching businesses with semantic...")
            filters = self._extract_filters(message)
            businesses = self.semantic_service.semantic_search(
                query=message,
                top_k=5,
                threshold=0.35,  # Higher threshold for quality
                filters=filters
            )
            results['suggested_businesses'] = businesses
            
            # 3. Build combined answer
            has_news = len(results['documents']) > 0
            has_businesses = len(results['suggested_businesses']) > 0
            
            if has_news and has_businesses:
                results['answer'] = f"📰 **Tin tức:** {results['answer']}\n\n🏢 **Doanh nghiệp liên quan:** Tìm thấy {len(results['suggested_businesses'])} công ty phù hợp."
            elif has_news:
                # Keep RAG answer as is
                pass
            elif has_businesses:
                results['answer'] = f"🏢 Tìm thấy {len(results['suggested_businesses'])} công ty phù hợp với yêu cầu của bạn."
            else:
                results['answer'] = "Em không tìm thấy thông tin liên quan. Bạn thử mô tả rõ hơn nhé! 🔍"
            
            results['followup_suggestions'] = [
                '📰 Tin tức khác',
                '🏢 Công ty liên quan',
                '🔍 Tìm kiếm chi tiết'
            ]
            
            return results
            
        except Exception as e:
            logger.error(f"Complex query error: {e}")
            # Last resort: try semantic only
            return self._handle_semantic_query(message, {}, session_id, history)
    
    def _handle_conversational(
        self,
        message: str,
        session_id: str = None
    ) -> Dict:
        """Handle greetings and casual chat"""
        message_lower = message.lower()
        
        if any(kw in message_lower for kw in ['chào', 'hello', 'hi']):
            answer = 'Chào bạn! Em là Em Tư, trợ lý thông minh. Em có thể giúp bạn tìm doanh nghiệp và tin tức. Bạn cần gì nhỉ? 😊'
        elif any(kw in message_lower for kw in ['tên', 'ai', 'là gì']):
            answer = 'Em là Em Tư - trợ lý AI của bạn! 🤖'
        elif any(kw in message_lower for kw in ['cảm ơn', 'thank']):
            answer = 'Không có gì! Rất vui được giúp bạn 😊'
        else:
            answer = 'Em là trợ lý tìm kiếm. Bạn muốn tìm công ty hay tin tức gì không? 🔍'
        
        return {
            'answer': answer,
            'suggested_businesses': [],
            'documents': [],
            'search_method': 'conversational',
            'rag_used': False,
            'followup_suggestions': [
                '🏢 Tìm công ty IT',
                '📰 Tin tức công nghệ',
                '❓ Hướng dẫn'
            ]
        }
    
    def _extract_filters(self, message: str) -> Dict:
        """Extract search filters from message"""
        message_lower = message.lower()
        filters = {}
        
        # Region filter
        if any(kw in message_lower for kw in ['bắc', 'hà nội', 'miền bắc']):
            filters['region'] = 'Bắc'
        elif any(kw in message_lower for kw in ['trung', 'đà nẵng', 'miền trung']):
            filters['region'] = 'Trung'
        elif any(kw in message_lower for kw in ['nam', 'sài gòn', 'tp.hcm', 'miền nam']):
            filters['region'] = 'Nam'
        
        return filters
    
    def _format_business_response(
        self,
        businesses: List[Dict],
        answer: str,
        method: str
    ) -> Dict:
        """Format business search response"""
        return {
            'answer': answer,
            'suggested_businesses': businesses,
            'documents': [],
            'search_method': method,
            'rag_used': method in ['semantic_ai', 'ai_function_calling'],
            'followup_suggestions': [
                '💼 Thông tin chi tiết',
                '📞 Số điện thoại',
                '🔍 Tìm công ty khác'
            ]
        }
    
    def _handle_followup_reasoning(
        self,
        message: str,
        session_id: str,
        history: List[Dict]
    ) -> Dict:
        """
        Handle follow-up questions that need AI reasoning
        E.g., "which one is best?", "compare them", "top 3 from those"
        """
        logger.info("🧠 Follow-up reasoning with context")
        
        # Get businesses from last context
        last_context = self._get_last_context(history)
        businesses = last_context.get('suggested_businesses', [])
        
        if not businesses:
            logger.warning("No businesses in context for follow-up")
            return {
                'answer': 'Em chưa gợi ý công ty nào trước đó. Bạn muốn tìm công ty gì nhỉ? 🔍',
                'suggested_businesses': [],
                'documents': [],
                'search_method': 'followup_no_context',
                'rag_used': False
            }
        
        # Use AI to reason about the businesses
        try:
            from app.services.groq_service import get_groq_service
            groq_service = get_groq_service()
            
            if groq_service:
                # Format businesses for AI
                businesses_text = "\n".join([
                    f"{i+1}. {b['name']} - {b.get('location', 'N/A')} ({b.get('phone', 'N/A')})"
                    for i, b in enumerate(businesses[:10])
                ])
                
                prompt = f"""Người dùng đã được gợi ý {len(businesses)} công ty sau:

{businesses_text}

Bây giờ họ hỏi: "{message}"

Hãy trả lời câu hỏi dựa trên danh sách công ty trên. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện."""
                
                logger.info(f"🤖 Asking AI to reason about {len(businesses)} businesses")
                
                ai_response = groq_service.generate(
                    system_prompt="Bạn là trợ lý tư vấn doanh nghiệp, trả lời ngắn gọn bằng tiếng Việt.",
                    user_prompt=prompt,
                    max_tokens=300,
                    temperature=0.7
                )
                
                return {
                    'answer': ai_response,
                    'suggested_businesses': businesses[:3],  # Show top 3 from original list
                    'documents': [],
                    'search_method': 'followup_ai_reasoning',
                    'rag_used': False,
                    'followup_suggestions': [
                        '📞 Xem số điện thoại',
                        '📍 Xem địa chỉ',
                        '🔍 Tìm công ty khác'
                    ]
                }
            else:
                # Fallback: return businesses from context
                return {
                    'answer': f'📋 Dựa trên {len(businesses)} công ty đã gợi ý, em nghĩ những công ty này phù hợp với bạn:',
                    'suggested_businesses': businesses[:5],
                    'documents': [],
                    'search_method': 'followup_simple',
                    'rag_used': False
                }
                
        except Exception as e:
            logger.error(f"AI reasoning failed: {e}")
            # Fallback
            return {
                'answer': f'📋 Đây là {len(businesses)} công ty em đã gợi ý:',
                'suggested_businesses': businesses[:5],
                'documents': [],
                'search_method': 'followup_fallback',
                'rag_used': False
            }
    
    def _handle_button_action(
        self,
        action_button_id: str,
        message: str,
        session_id: str,
        history: List[Dict] = None
    ) -> Optional[Dict]:
        """
        Handle button actions with context awareness
        
        Buttons like "Thông tin chi tiết", "Số điện thoại", etc.
        should use context from previous response
        """
        logger.info(f"🔘 Processing button: {action_button_id}")
        
        # Get last context
        if not history:
            history = self.conv_service.get_conversation_history(session_id)
        
        last_context = self._get_last_context(history)
        businesses = last_context.get('suggested_businesses', [])
        
        if not businesses:
            logger.warning("No businesses in context for button action")
            return None  # Let normal flow handle it
        
        # Take first company from context
        company = businesses[0]
        message_lower = message.lower()
        
        # Map button actions to specific info
        if any(kw in message_lower for kw in ['thông tin', 'chi tiết', 'thong tin', 'chi tiet']):
            # Full details
            answer = f"""📋 **{company['name']}**

📞 **Điện thoại**: {company.get('phone', 'Chưa có')}
📍 **Địa chỉ**: {company.get('location', 'Chưa có')} - {company.get('region', '')}
🏭 **Ngành nghề**: {company.get('industry', 'Chưa có')}
🌐 **Website**: {company.get('website', 'Chưa có')}
📧 **Email**: {company.get('email', 'Chưa có')}

Bạn cần thêm thông tin gì không? 😊"""
            
            return {
                'answer': answer,
                'suggested_businesses': [company],
                'documents': [],
                'search_method': 'button_action_details',
                'rag_used': False,
                'response_time_ms': 50,  # Fast response
                'followup_suggestions': [
                    '📞 Gọi ngay',
                    '🔍 Tìm công ty khác',
                    '📰 Tin tức liên quan'
                ]
            }
        
        elif any(kw in message_lower for kw in ['số', 'phone', 'điện thoại', 'dien thoai', 'sđt']):
            # Just phone
            return {
                'answer': f"📞 Số điện thoại **{company['name']}**: {company.get('phone', 'Chưa có')}",
                'suggested_businesses': [company],
                'documents': [],
                'search_method': 'button_action_phone',
                'rag_used': False,
                'response_time_ms': 50
            }
        
        elif any(kw in message_lower for kw in ['địa chỉ', 'dia chi', 'address', 'ở đâu', 'o dau']):
            # Just address
            return {
                'answer': f"📍 **{company['name']}** ở {company.get('region', '')} - {company.get('location', 'Chưa có')}",
                'suggested_businesses': [company],
                'documents': [],
                'search_method': 'button_action_address',
                'rag_used': False,
                'response_time_ms': 50
            }
        
        # Unknown button action, let normal flow handle
        return None
    
    def _get_last_context(self, history: List[Dict]) -> Dict:
        """Extract last context from history"""
        for msg in reversed(history):
            if msg.get('role') == 'assistant' and msg.get('context'):
                return msg['context']
        return {}
    
    def _get_cache_key(self, message: str) -> str:
        """Generate cache key from message"""
        # Normalize message for caching
        normalized = message.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized[:100]  # Limit key length
    
    def _get_from_cache(self, key: str) -> Optional[Dict]:
        """Get response from cache"""
        if key in self._cache:
            entry = self._cache[key]
            if datetime.now() - entry['timestamp'] < self._cache_ttl:
                return entry['response']
            else:
                del self._cache[key]  # Expired
        return None
    
    def _add_to_cache(self, key: str, response: Dict):
        """Add response to cache"""
        self._cache[key] = {
            'response': response.copy(),
            'timestamp': datetime.now()
        }
        
        # Simple LRU: limit cache size
        if len(self._cache) > 100:
            # Remove oldest
            oldest_key = min(self._cache.items(), key=lambda x: x[1]['timestamp'])[0]
            del self._cache[oldest_key]
    
    def _should_cache(self, complexity: str, result: Dict) -> bool:
        """Determine if response should be cached"""
        # Cache simple and semantic queries with results
        if complexity in [QueryComplexity.SIMPLE, QueryComplexity.SEMANTIC]:
            if result.get('suggested_businesses') or result.get('documents'):
                return True
        # Cache conversational responses
        if complexity == QueryComplexity.CONVERSATIONAL:
            return True
        return False
    
    def _error_response(self, error_msg: str) -> Dict:
        """Format error response"""
        return {
            'answer': 'Em gặp chút vấn đề kỹ thuật. Bạn thử lại sau nhé! 😅',
            'suggested_businesses': [],
            'documents': [],
            'search_method': 'error',
            'rag_used': False,
            'error': error_msg
        }
    
    def get_metrics(self) -> Dict:
        """Get performance metrics"""
        total = self.metrics['total_queries']
        if total == 0:
            return self.metrics
        
        return {
            **self.metrics,
            'simple_percent': round(self.metrics['simple_queries'] / total * 100, 2),
            'semantic_percent': round(self.metrics['semantic_queries'] / total * 100, 2),
            'ai_percent': round(self.metrics['ai_queries'] / total * 100, 2),
            'cache_hit_rate': round(self.metrics['cache_hits'] / total * 100, 2)
        }


# Singleton instance
_hybrid_chat_service = None


def get_hybrid_chat_service(rag_service: Optional[RAGService] = None) -> HybridChatService:
    """Get or create hybrid chat service singleton"""
    global _hybrid_chat_service
    if _hybrid_chat_service is None:
        _hybrid_chat_service = HybridChatService(rag_service)
    return _hybrid_chat_service
