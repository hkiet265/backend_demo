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

# Degraded-mode only (see parse()'s last-resort fallback) — used ONLY when
# the LLM call itself fails (quota exhausted, network down), never as a
# primary classifier. Deliberately small/coarse: just enough to not
# misroute an obvious news question into a business search.
DEGRADED_MODE_NEWS_KEYWORDS = ['tin tức', 'tin tuc', 'news', 'bài viết', 'bai viet']
DEGRADED_MODE_GREETING_KEYWORDS = ['xin chào', 'hello', 'chào bạn']

# Values match businesses_demo.vung_mien exactly ('Bac'/'Trung'/'Nam',
# no diacritics) — the legacy _extract_filters() in hybrid_chat_service.py
# maps to 'Bắc' (with diacritic), which never matches the real column
# value and silently made every region filter a no-op. Fixed here.
REGION_KEYWORDS = {
    'Bac': ['bắc', 'hà nội', 'ha noi', 'miền bắc'],
    'Trung': ['trung', 'đà nẵng', 'da nang', 'miền trung'],
    'Nam': ['nam', 'sài gòn', 'sai gon', 'tp.hcm', 'hcm', 'miền nam'],
}


def _extract_region(message_lower: str) -> Optional[str]:
    """Region is a closed 3-value set — safe to keep as deterministic
    keyword normalization (also used to correct the LLM's free-text region
    output, e.g. "miền nam" -> "Nam", to match businesses_demo.vung_mien)."""
    for region, keywords in REGION_KEYWORDS.items():
        if any(kw in message_lower for kw in keywords):
            return region
    return None


class _LLMQueryUnderstanding(BaseModel):
    """Flat schema for the Gemini structured-output call (kept flat, and
    every field required-but-nullable, for compatibility with the genai
    JSON-schema translator — it rejects fields with a "default" key)."""
    topic: str  # business | news | conversation | mixed
    operation: str  # search | recommend | compare | followup_reasoning | followup_lookup | smalltalk
    industry: Optional[str]
    location: Optional[str]
    region: Optional[str]
    company_name: Optional[str]
    limit: int
    is_followup: bool


LLM_PARSE_INSTRUCTIONS = """Bạn là bộ phân tích câu hỏi (query understanding), KHÔNG trả lời câu hỏi.
Nhiệm vụ duy nhất: đọc câu hỏi người dùng (và lịch sử hội thoại nếu có) rồi trả về JSON mô tả ý định.

topic: "business" (hỏi về doanh nghiệp), "news" (hỏi về tin tức), "conversation" (chào hỏi/xã giao), "mixed" (cả hai)
operation:
  - "lookup_exact": hỏi về MỘT công ty cụ thể đã biết rõ tên (không cần tìm kiếm/gợi ý)
  - "search": tìm kiếm theo tiêu chí (ngành, khu vực, liệt kê danh sách...)
  - "recommend": xin gợi ý/tư vấn nên chọn công ty nào
  - "compare": so sánh nhiều lựa chọn cụ thể
  - "followup_reasoning": câu hỏi tiếp nối CẦN SUY LUẬN trên danh sách/công ty đã nhắc ở lượt trước
    (ví dụ "cái nào tốt nhất", "trong đó công ty nào ổn"). CHỈ chọn cái này khi câu hỏi rõ ràng
    tham chiếu tới thứ đã nói trước đó — câu hỏi tìm kiếm MỚI (có địa điểm/ngành nghề cụ thể,
    hoặc bắt đầu bằng "liệt kê"/"tìm"/"cho tôi") luôn là "search"/"recommend", KHÔNG phải follow-up,
    dù có chứa chữ "nào".
  - "followup_lookup": câu hỏi tiếp nối chỉ cần lấy lại 1 thông tin cụ thể đã có (SĐT/địa chỉ/ngành nghề
    của công ty vừa nhắc, ví dụ "số điện thoại của nó", "công ty này ở đâu")
  - "smalltalk": trò chuyện thông thường không cần tra dữ liệu

is_followup: true CHỈ KHI operation là followup_reasoning hoặc followup_lookup.

Chỉ điền industry/location/region/company_name khi CÓ trong câu hỏi. Không suy diễn thêm."""


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
        if any(kw in message_lower for kw in DEGRADED_MODE_NEWS_KEYWORDS):
            return QueryUnderstanding(
                raw_query=message, topic="news", operation="search",
                confidence=0.3, parsed_by="heuristic",
            )
        if any(kw in message_lower for kw in DEGRADED_MODE_GREETING_KEYWORDS):
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

        # 2. Exact company name patterns (structural regex, not keywords)
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
                topic=parsed.topic if parsed.topic in ("business", "news", "conversation", "mixed") else "business",
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
