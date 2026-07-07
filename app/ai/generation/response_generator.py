"""
Response Generation layer: the ONLY place in the new pipeline allowed to
produce the final answer text, and the last of the two places the LLM is
ever invoked (the other is Query Understanding).

Unifies what used to be two separate generators:
- rag_service._generate_response()        (LLM-based, news only)
- enhanced_response_generator.py           (template-based, business only)

The LLM here is given a compact, explicit EVIDENCE block and told not to
invent facts outside it — it diffuses evidence into prose, it does not
search or reason about data on its own. If both LLM providers fail, we
fall back to the existing deterministic template generator so the system
never returns an empty answer.
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional

from app.ai.fusion.evidence import Evidence
from app.ai.understanding.schemas import QueryUnderstanding
from app.services.enhanced_response_generator import get_enhanced_response_generator
from app.services.llm_provider import generate_with_fallback

logger = logging.getLogger(__name__)

SMALL_PERSONA = (
    "Bạn là Company, trợ lý tra cứu doanh nghiệp & tin tức Việt Nam, tính cách vui vẻ, trẻ trung, "
    "hài hước nhẹ nhàng như một người bạn đồng hành — nhưng vẫn lịch sự, không lố lăng, "
    "không dùng tiếng lóng/teencode khó hiểu.\n"
    "Xưng \"em\", gọi người dùng \"anh/chị\". BẮT BUỘC mỗi câu trả lời phải có ít nhất 1 chi tiết thể hiện "
    "cảm xúc/tính cách (một câu cảm thán, một lời bông đùa nhẹ, hoặc 1-2 icon tự nhiên) — TUYỆT ĐỐI không trả lời "
    "khô khan kiểu báo cáo/tra từ điển.\n"
    "Ví dụ giọng văn ĐÚNG: \"Hihi không đúng rồi anh ơi 😄 hôm nay là thứ 2 (06/07/2026) chứ chưa qua thứ 3 đâu, "
    "còn cả tuần dài phía trước nè!\" hoặc \"Ối, Messi mà chơi bóng rổ thì chắc khung thành... à nhầm, rổ bóng sẽ "
    "run lắm á 😂 Anh ơi Messi là 'vua' bóng đá chứ không phải bóng rổ nha!\"\n"
    "Ví dụ giọng văn SAI (tránh): \"Không đúng anh ạ, hôm nay là thứ 2, ngày 06/07/2026.\" — quá khô, thiếu cảm xúc.\n"
    "Trả lời 4-8 câu, dùng bullet cho danh sách, kết thúc bằng một câu hỏi gợi ý tiếp theo theo giọng thân thiện."
)

EVIDENCE_RULES = (
    "QUY TẮC BẮT BUỘC:\n"
    "- CHỈ nhắc tên công ty/tiêu đề tin tức nếu nó xuất hiện Y NGUYÊN trong phần EVIDENCE dưới đây. "
    "TUYỆT ĐỐI không tự nghĩ ra hoặc lấy từ kiến thức chung của bạn một công ty/tin tức nào không có trong EVIDENCE, "
    "dù nó nghe có vẻ hợp lý hay đúng thực tế.\n"
    "- Không tự suy luận số liệu hay thông tin không có trong EVIDENCE.\n"
    "- Nếu bạn muốn thêm bối cảnh/kiến thức chung bên ngoài EVIDENCE để câu trả lời hữu ích hơn, PHẢI nói rõ "
    "đó là thông tin bạn biết thêm (không phải từ dữ liệu tra cứu), ví dụ: \"(thông tin ngoài, anh/chị tham khảo thêm)\".\n"
    "- Nếu EVIDENCE trống, nói rõ không tìm thấy và gợi ý người dùng mô tả lại."
)

# For "which one is best" / "compare" follow-ups, the LLM was hedging with a
# long disclaimer instead of committing to an answer, because the evidence
# facts alone (name/industry/location) give it nothing to rank on. The list
# IS already ordered by relevance (see fusion.KnowledgeFusion) — telling it
# that explicitly turns "em không biết công ty nào tốt nhất" into a direct,
# short pick instead of a rambling non-answer.
REASONING_INSTRUCTIONS = (
    "\nGHI CHÚ CHO CÂU HỎI SO SÁNH/CHỌN LỰA:\n"
    "- Danh sách EVIDENCE đã được xếp theo thứ tự liên quan giảm dần (số 1 là phù hợp/liên quan nhất).\n"
    "- Trả lời NGẮN GỌN (3-5 câu): chọn thẳng 1-2 công ty phù hợp nhất dựa theo thứ tự đó, không liệt kê lại toàn bộ danh sách.\n"
    "- KHÔNG lan man giải thích là thiếu dữ liệu xếp hạng — nếu EVIDENCE không có tiêu chí so sánh trực tiếp "
    "(ví dụ không có điểm uy tín), vẫn chọn công ty đứng đầu danh sách làm gợi ý chính, nói rõ đó là dựa trên "
    "mức độ liên quan, rồi hỏi lại 1 câu ngắn xem người dùng có tiêu chí cụ thể nào khác không."
)


def _businesses_to_facts(businesses: List[Dict]) -> str:
    if not businesses:
        return "(không có)"
    lines = []
    for i, b in enumerate(businesses[:10], 1):
        similarity = b.get('similarity')
        relevance = f" | độ liên quan: {round(similarity, 2)}" if similarity is not None else ""
        lines.append(
            f"{i}. {b.get('name')} | ngành: {b.get('industry', '')} | "
            f"khu vực: {b.get('location', '')} {b.get('region', '')} | "
            f"SĐT: {b.get('phone', 'Chưa có')} | website: {b.get('website', '')}{relevance}"
        )
    return "\n".join(lines)


def _news_to_facts(news: List[Dict]) -> str:
    if not news:
        return "(không có)"
    lines = []
    for i, n in enumerate(news[:5], 1):
        summary = (n.get('summary') or '')[:200]
        lines.append(
            f"{i}. {n.get('title')} | nguồn: {n.get('source', '')} | "
            f"chuyên mục: {n.get('category', '')} | tóm tắt: {summary}"
        )
    return "\n".join(lines)


SMALLTALK_SYSTEM_PROMPT = (
    f"{SMALL_PERSONA}\n\n"
    "Đây là chit-chat thông thường, KHÔNG liên quan tra cứu doanh nghiệp/tin tức. "
    "Trả lời ngắn gọn (1-3 câu), tự nhiên, đúng nội dung câu hỏi. "
    "Nếu câu hỏi cần biết ngày/giờ hiện tại, dùng thông tin ngày hôm nay được cho sẵn dưới đây — "
    "không tự đoán. Nếu không chắc câu trả lời, nói thật là không chắc, đừng bịa.\n"
    "Cuối câu có thể gợi ý nhẹ là bạn cũng có thể tìm doanh nghiệp/tin tức, nhưng không bắt buộc."
)


class ResponseGenerator:
    def __init__(self):
        self._template_fallback = get_enhanced_response_generator()

    def generate_smalltalk(self, message: str) -> str:
        """Casual chit-chat with no business/news evidence involved — still
        goes through the LLM so it can actually address what was asked
        (e.g. "hôm nay là chủ nhật đúng không") instead of a canned greeting
        template that ignores the question content."""
        today = datetime.now().strftime("%A, %d/%m/%Y")
        prompt = f"Hôm nay là: {today}\n\nCâu hỏi/tin nhắn: {message}"

        answer = generate_with_fallback(
            system_prompt=SMALLTALK_SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.9,
            max_tokens=256,
        )
        return answer or 'Em là trợ lý tìm kiếm doanh nghiệp & tin tức. Bạn cần tìm gì không? 🔍'

    def generate(
        self,
        understanding: QueryUnderstanding,
        evidence: Evidence,
        learning_context: Optional[str] = None,
        learning_hints: Optional[Dict] = None,
    ) -> str:
        if evidence.is_empty:
            return self._no_results_answer(understanding)

        llm_answer = self._llm_generate(understanding, evidence, learning_context)
        if llm_answer:
            return llm_answer

        logger.warning("Response generation: both LLM providers failed, using template fallback")
        return self._template_generate(understanding, evidence, learning_hints)

    def _no_results_answer(self, understanding: QueryUnderstanding) -> str:
        if understanding.topic == "news":
            return (
                "Chào anh/chị! 📰 Em chưa tìm thấy tin tức phù hợp với yêu cầu này. "
                "Anh/chị thử mô tả rõ hơn chủ đề quan tâm nhé! 🔍"
            )
        return self._template_fallback._generate_no_results_response(understanding.raw_query)

    def _template_generate(
        self,
        understanding: QueryUnderstanding,
        evidence: Evidence,
        learning_hints: Optional[Dict],
    ) -> str:
        if evidence.has_business:
            return self._template_fallback.enhance_business_response(
                businesses=evidence.businesses,
                original_query=understanding.raw_query,
                learning_hints=learning_hints or {},
                search_method="business_vector",
            )
        return self._template_fallback.enhance_news_response(
            answer="",
            documents=evidence.news,
            original_query=understanding.raw_query,
        )

    def _build_prompt(
        self,
        understanding: QueryUnderstanding,
        evidence: Evidence,
        learning_context: Optional[str],
    ) -> str:
        learning_section = f"\n{learning_context}\n" if learning_context else ""
        reasoning_section = (
            REASONING_INSTRUCTIONS if understanding.operation in ("followup_reasoning", "compare") else ""
        )
        return (
            f"{SMALL_PERSONA}\n\n{EVIDENCE_RULES}{reasoning_section}\n\n{learning_section}"
            f"Câu hỏi: {understanding.raw_query}\n\n"
            f"EVIDENCE - Doanh nghiệp:\n{_businesses_to_facts(evidence.businesses)}\n\n"
            f"EVIDENCE - Tin tức:\n{_news_to_facts(evidence.news)}\n\n"
            f"Hãy trả lời câu hỏi dựa trên EVIDENCE trên."
        )

    def _llm_generate(
        self,
        understanding: QueryUnderstanding,
        evidence: Evidence,
        learning_context: Optional[str],
    ) -> Optional[str]:
        prompt = self._build_prompt(understanding, evidence, learning_context)
        answer = generate_with_fallback(
            system_prompt=SMALL_PERSONA,
            user_prompt=prompt,
            temperature=0.85,
            max_tokens=1024,
        )
        return answer if answer and len(answer) >= 10 else None


_response_generator: Optional[ResponseGenerator] = None


def get_response_generator() -> ResponseGenerator:
    global _response_generator
    if _response_generator is None:
        _response_generator = ResponseGenerator()
    return _response_generator
