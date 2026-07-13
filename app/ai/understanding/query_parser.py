"""
Query Understanding layer.

Only the genuinely unambiguous, zero-NLP-needed cases stay on the fast
heuristic path: a phone number regex, and a structural "CÔNG TY CỔ
PHẦN/TNHH + Name" pattern (or a known famous-company name). Everything
else — greetings, news vs. business, recommend/search/compare intent,
follow-up detection, industry/region extraction — goes through Gemini
structured output instead of a keyword list.

This used to be the other way around (heuristics handled most cases, LLM
only got the leftovers), but keyword-list heuristics kept breaking on
substring false-matches (see git history: "do" inside "doanh", "ay" inside
"hay", "hi" inside "hiện", etc. all mis-triggered classification). Shifting
more of the interpretation to the LLM trades latency/quota for robustness
to phrasing — the LLM never fetches data or answers the question itself,
it only classifies intent, same as before.
"""
import json
import logging
import re
from typing import Dict, List, Optional

from pydantic import BaseModel

from .schemas import Constraints, Entities, QueryUnderstanding

logger = logging.getLogger(__name__)

PHONE_PATTERN = re.compile(r'\b\d[\d\s\.\-]{7,}\b')

# Structural pattern (a formal company-name suffix, or a known brand name),
# not a keyword list — this is what makes it safe to keep on the fast path:
# there's no plausible sentence where this matches by accident.
SPECIFIC_COMPANY_PATTERNS = [
    r'công\s+ty\s+(?:cổ\s+phần|tnhh|trách\s+nhiệm|cp|mtv)\s+[\wÀ-ỹ\s]{3,}',
    r'(?:chi\s+tiết|thông\s+tin|địa\s+chỉ|số\s+điện\s+thoại).+công\s+ty\s+[A-Z\wÀ-ỹ]',
    r'\b(fpt|viettel|vng|vingroup|grab|shopee|lazada|tiki|samsung|lg)\b',
]

# Guards SPECIFIC_COMPANY_PATTERNS above — a bare famous-company keyword
# match (e.g. "fpt") must not short-circuit straight to lookup_exact when
# the message is actually comparing two companies.
COMPARE_KEYWORDS = ['so sánh', 'so voi', 'so với', ' vs ', ' hay ', 'hơn hay', 'tốt hơn', 'nên chọn']

# "Give me more detail on [the thing you just suggested]" is unambiguous
# whenever the previous turn actually suggested something — but the LLM's
# is_followup classification is NOT reliably deterministic at temperature
# 0.1 (confirmed: identical real conversation state classified is_followup
# True in one call, False in another), which silently drops the prior
# job/business context and re-searches from scratch (often finding nothing,
# since a bare company/title fragment is weak on its own). Handling this one
# common, unambiguous pattern as a deterministic heuristic — bypassing the
# LLM's judgment entirely — removes that flakiness for the case that matters
# most (a user asking to see the details of a result just shown to them).
DETAIL_REQUEST_KEYWORDS = [
    'chi tiết', 'thông tin thêm', 'biết thêm', 'cho tôi biết', 'nói rõ hơn', 'rõ hơn về',
]

# Degraded-mode only (see parse()'s last-resort fallback) — used ONLY when
# the LLM call itself fails (quota exhausted, network down), never as a
# primary classifier. Deliberately small/coarse: just enough to not
# misroute an obvious news question into a business search.
DEGRADED_MODE_NEWS_KEYWORDS = ['tin tức', 'tin tuc', 'news', 'bài viết', 'bai viet']
# Greeting AND self-intro/site-usage phrasing both route to conversation —
# same bucket SCOPE_RULES groups them into for the smalltalk system prompt.
# "hi"/"chào" alone (word-boundary, not "hiện"/"chào hàng"...) plus explicit
# "giới thiệu"/"bạn là ai" phrasing, since a plain keyword list without
# these missed exactly this case: "hi hãy giới thiệu về trang web này" has
# no other topical content, so with the LLM call failing (quota exhausted)
# it fell all the way through to the last-resort "business search" default
# and returned a nonsensical "no company found" answer.
DEGRADED_MODE_GREETING_KEYWORDS = [
    'xin chào', 'hello', 'chào bạn', 'giới thiệu', 'gioi thieu', 'bạn là ai', 'ban la ai',
]
# Separate, word-boundary-anchored check for bare "hi" — a plain substring
# match would false-positive inside "chi tiết" ("...c-h-i- -t..."), which is
# a real, frequently-used follow-up phrase (see pipeline.py's button-action
# fast path), not a greeting.
DEGRADED_MODE_GREETING_RE = re.compile(r'\bhi\b', re.IGNORECASE)
DEGRADED_MODE_JOB_KEYWORDS = [
    'việc làm', 'viec lam', 'tuyển dụng', 'tuyen dung', 'công việc', 'cong viec',
    'ứng tuyển', 'ung tuyen', 'tìm việc', 'tim viec', 'vị trí', 'vi tri',
]
# Follow-up/correction detection is normally an LLM-only judgment (there's
# no keyword list for "this references what I said before") — but with the
# LLM call failing entirely (quota exhausted), a message like "tôi đâu có
# kêu khu vực phía bắc" (correcting something from the previous turn) had
# NO degraded-mode path at all and fell through to the generic "business
# search" default, which finds nothing and returns a nonsensical answer.
# This is deliberately narrow — common correction/reference phrasings only,
# not general follow-up understanding — good enough to at least route back
# to the previous turn's topic instead of a wrong fresh search.
DEGRADED_MODE_FOLLOWUP_KEYWORDS = [
    'đâu có', 'dau co', 'tôi có nói', 'toi co noi', 'ai bảo', 'ai bao',
    'trong đó', 'trong do', 'cái nào', 'cai nao', 'con nào', 'con nao',
]

# Values match businesses_demo.vung_mien exactly ('Bac'/'Trung'/'Nam',
# no diacritics) — the legacy _extract_filters() in hybrid_chat_service.py
# maps to 'Bắc' (with diacritic), which never matches the real column
# value and silently made every region filter a no-op. Fixed here.
REGION_KEYWORDS = {
    'Bac': ['bắc', 'hà nội', 'ha noi', 'miền bắc'],
    'Trung': ['trung', 'đà nẵng', 'da nang', 'miền trung'],
    'Nam': ['nam', 'sài gòn', 'sai gon', 'tp.hcm', 'hcm', 'miền nam'],
}


def _last_context_from_history(history: List[Dict]) -> Dict:
    """Same lookup as pipeline.LayeredChatPipeline._get_last_context — kept
    as a separate small helper here so query_parser doesn't need to import
    the pipeline module just for this."""
    for msg in reversed(history or []):
        if msg.get('role') == 'assistant' and msg.get('context'):
            return msg['context']
    return {}


def _last_topic_from_history(history: List[Dict]) -> Optional[str]:
    """Degraded-mode-only helper — maps the last assistant turn's
    search_method (saved in its `context`, see app/api/chat.py) back to a
    Topic, so a correction like "tôi đâu có kêu khu vực phía bắc" reuses
    whatever the previous turn was actually about instead of guessing."""
    for msg in reversed(history):
        if msg.get('role') != 'assistant':
            continue
        method = (msg.get('context') or {}).get('search_method', '')
        if 'job' in method:
            return 'jobs'
        if 'business' in method:
            return 'business'
        if 'news' in method:
            return 'news'
        return None
    return None


def _extract_region(message_lower: str) -> Optional[str]:
    """Region is a closed 3-value set — safe to keep as deterministic
    keyword normalization (also used to correct the LLM's free-text region
    output, e.g. "miền nam" -> "Nam", to match businesses_demo.vung_mien)."""
    for region, keywords in REGION_KEYWORDS.items():
        if any(kw in message_lower for kw in keywords):
            return region
    return None


class _LLMQueryUnderstanding(BaseModel):
    """Flat schema for the structured-output call. Every field has a
    default now — NOT required-but-nullable like the original Gemini-only
    version (that shape existed because the genai JSON-schema translator
    rejects fields carrying a "default" key). Now that QUERY_UNDERSTANDING_
    PROVIDER can be a plain-JSON-object provider (OpenCode Zen, OpenAI,
    DeepSeek — none of them enforce the schema server-side, they just see
    it described in the prompt text), the model frequently omits fields
    it considers irrelevant (e.g. "limit"). Without defaults, Pydantic
    validation raised on every such response, silently discarding the
    entire real classification and falling back to the coarse keyword
    heuristic on EVERY message — not just when the LLM call itself failed.
    NOTE: if QUERY_UNDERSTANDING_PROVIDER is ever set back to "gemini",
    this schema needs the required-but-nullable shape again for that
    translator; the two constraints are mutually exclusive."""
    topic: str = "business"  # business | jobs | news | conversation | mixed
    operation: str = "search"  # search | recommend | compare | followup_reasoning | followup_lookup | smalltalk
    industry: Optional[str] = None
    location: Optional[str] = None
    region: Optional[str] = None
    company_name: Optional[str] = None
    # Only for operation="compare" — the two (or more) company names being
    # compared, as one comma-separated string (kept flat/string like every
    # other field here — see class docstring on why no lists/nesting).
    company_names: Optional[str] = None
    limit: int = 10
    is_followup: bool = False


LLM_PARSE_INSTRUCTIONS = """Bạn là bộ phân tích câu hỏi (query understanding), KHÔNG trả lời câu hỏi.
Nhiệm vụ duy nhất: đọc câu hỏi người dùng (và lịch sử hội thoại nếu có) rồi trả về JSON mô tả ý định.

topic: "business" (hỏi về doanh nghiệp/nhà tuyển dụng — công ty, quy mô, ngành nghề, độ tin cậy),
  "jobs" (hỏi về VIỆC LÀM/vị trí tuyển dụng cụ thể — tìm việc, gợi ý công việc theo kỹ năng/vị trí,
  ví dụ "giới thiệu việc làm backend", "có job frontend không", "tìm việc React ở Hà Nội"),
  "news" (hỏi về tin tức), "conversation" (chào hỏi/xã giao/giới thiệu bản thân/hướng dẫn dùng web),
  "mixed" (business + news cùng lúc)
operation:
  - "lookup_exact": hỏi về MỘT công ty cụ thể đã biết rõ tên (không cần tìm kiếm/gợi ý)
  - "search": tìm kiếm theo tiêu chí (ngành, khu vực, kỹ năng, vị trí, liệt kê danh sách...)
  - "recommend": xin gợi ý/tư vấn nên chọn công ty hoặc công việc nào
  - "compare": so sánh giữa các công ty CỤ THỂ đã được nêu tên trong câu hỏi (ví dụ "so sánh Techcombank
    và FPT Software", "Vietcombank hay Vingroup tốt hơn"). Khi chọn operation này, BẮT BUỘC điền
    company_names là các tên công ty đó, ngăn cách bởi dấu phẩy (ví dụ "Techcombank, FPT Software").
    Nếu câu hỏi so sánh nhưng KHÔNG nêu tên công ty cụ thể nào (ví dụ "so sánh các công ty IT ở Hà Nội"),
    dùng "search" hoặc "recommend" thay vì "compare".
  - "followup_reasoning": câu hỏi tiếp nối CẦN SUY LUẬN trên danh sách/công ty đã nhắc ở lượt trước
    (ví dụ "cái nào tốt nhất", "trong đó công ty nào ổn"). CHỈ chọn cái này khi câu hỏi rõ ràng
    tham chiếu tới thứ đã nói trước đó — câu hỏi tìm kiếm MỚI (có địa điểm/ngành nghề cụ thể,
    hoặc bắt đầu bằng "liệt kê"/"tìm"/"cho tôi") luôn là "search"/"recommend", KHÔNG phải follow-up,
    dù có chứa chữ "nào".
  - "followup_lookup": câu hỏi tiếp nối chỉ cần lấy lại 1 thông tin cụ thể đã có (SĐT/địa chỉ/ngành nghề
    của công ty vừa nhắc, ví dụ "số điện thoại của nó", "công ty này ở đâu")
  - "smalltalk": trò chuyện thông thường không cần tra dữ liệu

is_followup: true CHỈ KHI operation là followup_reasoning hoặc followup_lookup.

Chỉ điền industry/location/region/company_name/company_names khi CÓ trong câu hỏi. Không suy diễn thêm."""


class QueryParser:
    """Parses a raw user message into a QueryUnderstanding object."""

    def parse(self, message: str, history: Optional[List[Dict]] = None) -> QueryUnderstanding:
        heuristic_result = self._heuristic_parse(message, history)
        if heuristic_result is not None:
            return heuristic_result

        llm_result = self._llm_parse(message, history)
        if llm_result is not None:
            return llm_result

        # Last-resort fallback if the LLM call itself fails (quota exhausted —
        # gemini-2.5-flash free tier is 20 requests/day PER KEY, easy to burn
        # through across 10 keys during heavy testing). Hardcoding
        # topic="business" here used to silently misroute every news
        # question into a business search once quota ran out. A minimal
        # keyword check for "topic" only (not full intent) is a much safer
        # degraded mode than guessing business for everything.
        message_lower = message.lower()
        if history and any(kw in message_lower for kw in DEGRADED_MODE_FOLLOWUP_KEYWORDS):
            last_topic = _last_topic_from_history(history)
            if last_topic:
                return QueryUnderstanding(
                    raw_query=message, topic=last_topic, operation="followup_reasoning",
                    is_followup=True, confidence=0.3, parsed_by="heuristic",
                )
        if any(kw in message_lower for kw in DEGRADED_MODE_NEWS_KEYWORDS):
            return QueryUnderstanding(
                raw_query=message, topic="news", operation="search",
                confidence=0.3, parsed_by="heuristic",
            )
        if any(kw in message_lower for kw in DEGRADED_MODE_JOB_KEYWORDS):
            return QueryUnderstanding(
                raw_query=message, topic="jobs", operation="search",
                confidence=0.3, parsed_by="heuristic",
            )
        if any(kw in message_lower for kw in DEGRADED_MODE_GREETING_KEYWORDS) or DEGRADED_MODE_GREETING_RE.search(message_lower):
            return QueryUnderstanding(
                raw_query=message, topic="conversation", operation="smalltalk",
                confidence=0.3, parsed_by="heuristic",
            )
        return QueryUnderstanding(
            raw_query=message,
            topic="business",
            operation="search",
            confidence=0.4,
            parsed_by="heuristic",
        )

    def _heuristic_parse(self, message: str, history: Optional[List[Dict]]) -> Optional[QueryUnderstanding]:
        message_lower = message.lower()

        # 0. "Give me more detail" referencing a job/business the previous
        # turn actually suggested — see DETAIL_REQUEST_KEYWORDS above for why
        # this bypasses the LLM's (unreliable) is_followup judgment entirely.
        if history and any(kw in message_lower for kw in DETAIL_REQUEST_KEYWORDS):
            last_context = _last_context_from_history(history)
            if last_context.get('suggested_jobs') or last_context.get('suggested_businesses'):
                topic = _last_topic_from_history(history) or 'business'
                return QueryUnderstanding(
                    raw_query=message, topic=topic, operation="followup_reasoning",
                    is_followup=True, confidence=0.9, parsed_by="heuristic",
                )

        # 1. Phone number → exact lookup
        phone_match = PHONE_PATTERN.search(message)
        if phone_match:
            return QueryUnderstanding(
                raw_query=message,
                topic="business",
                operation="lookup_exact",
                entities=Entities(phone=phone_match.group()),
                confidence=0.95,
            )

        # 2. Exact company name patterns (structural regex, not keywords) —
        # skipped when the message reads as a comparison ("so sánh X và Y",
        # "X hay Y tốt hơn"). One of these patterns matches bare famous-
        # company keywords (fpt/viettel/...), which would otherwise
        # short-circuit straight to lookup_exact on the FIRST company
        # mentioned and never reach the LLM's operation="compare" +
        # company_names extraction below.
        if not any(kw in message_lower for kw in COMPARE_KEYWORDS):
            for pattern in SPECIFIC_COMPANY_PATTERNS:
                match = re.search(pattern, message_lower)
                if match:
                    return QueryUnderstanding(
                        raw_query=message,
                        topic="business",
                        operation="lookup_exact",
                        entities=Entities(company_name=match.group().strip()),
                        confidence=0.95,
                    )

        # Everything else (greeting, news vs business, recommend/search/
        # compare, follow-up detection, industry/region extraction) goes
        # through the LLM — see module docstring for why.
        return None

    def _llm_parse(self, message: str, history: Optional[List[Dict]]) -> Optional[QueryUnderstanding]:
        # Structured (schema-constrained) parsing — provider configurable via
        # settings.QUERY_UNDERSTANDING_PROVIDER, see app/services/llm_provider.py.
        # Swapping to a different provider needs no changes here.
        from app.services.llm_provider import get_structured_provider

        provider = get_structured_provider()
        if provider is None:
            logger.warning("No structured-output LLM provider configured, using heuristic fallback")
            return None

        history_snippet = ""
        if history:
            recent = history[-4:]
            history_snippet = "\n".join(
                f"{m.get('role')}: {m.get('content', '')[:200]}" for m in recent
            )
        prompt = f"{LLM_PARSE_INSTRUCTIONS}\n\nLịch sử gần đây:\n{history_snippet}\n\nCâu hỏi: {message}"

        try:
            raw = provider.generate_structured(prompt, _LLMQueryUnderstanding, temperature=0.1)
            if not raw:
                return None
            parsed = _LLMQueryUnderstanding.model_validate(json.loads(raw))

            return QueryUnderstanding(
                raw_query=message,
                topic=parsed.topic if parsed.topic in ("business", "jobs", "news", "conversation", "mixed") else "business",
                operation=parsed.operation if parsed.operation in (
                    "lookup_exact", "search", "recommend", "compare",
                    "followup_reasoning", "followup_lookup", "smalltalk",
                ) else "search",
                entities=Entities(
                    industry=parsed.industry,
                    location=parsed.location,
                    # Region is a closed 3-value set (Bac/Trung/Nam,
                    # matching businesses_demo.vung_mien exactly) — the
                    # LLM returns free-text ("miền nam") that never
                    # matches the DB value, so re-derive it with the
                    # same keyword extraction as the heuristic path
                    # instead of trusting the LLM's raw string.
                    region=_extract_region(message.lower()) or parsed.region,
                    company_name=parsed.company_name,
                    company_names=[
                        name.strip() for name in (parsed.company_names or "").split(",") if name.strip()
                    ],
                ),
                constraints=Constraints(limit=parsed.limit or 10),
                is_followup=parsed.is_followup,
                confidence=0.7,
                parsed_by="llm",
            )
        except Exception as e:
            logger.warning(f"LLM query parse failed, using heuristic fallback: {e}")
            return None


_query_parser: Optional[QueryParser] = None


def get_query_parser() -> QueryParser:
    global _query_parser
    if _query_parser is None:
        _query_parser = QueryParser()
    return _query_parser
