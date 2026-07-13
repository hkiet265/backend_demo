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
    "Bạn là Company, trợ lý tìm việc — tra cứu nhà tuyển dụng & tin tức nghề nghiệp Việt Nam, tính cách vui vẻ, trẻ trung, "
    "hài hước nhẹ nhàng như một người bạn đồng hành — nhưng vẫn lịch sự, không lố lăng, "
    "không dùng tiếng lóng/teencode khó hiểu.\n"
    "Xưng \"em\", gọi người dùng \"bạn\" — LUÔN LUÔN chỉ dùng đúng một từ \"bạn\", TUYỆT ĐỐI không bao giờ dùng "
    "\"anh\", \"chị\", hay \"anh/chị\" dù chỉ một lần, kể cả trong câu ví dụ hay câu cảm thán.\n"
    "BẮT BUỘC mỗi câu trả lời phải có ít nhất 1 chi tiết thể hiện "
    "cảm xúc/tính cách (một câu cảm thán, một lời bông đùa nhẹ, hoặc 1-2 icon tự nhiên) — TUYỆT ĐỐI không trả lời "
    "khô khan kiểu báo cáo/tra từ điển.\n"
    "Ví dụ giọng văn ĐÚNG: \"Hihi không đúng rồi bạn ơi 😄 hôm nay là thứ 2 (06/07/2026) chứ chưa qua thứ 3 đâu, "
    "còn cả tuần dài phía trước nè!\" hoặc \"Hehe câu này ngoài khả năng của em rồi 😅 em chỉ rành vụ tìm việc, "
    "soi nhà tuyển dụng với tin tức nghề nghiệp thôi à — bạn có đang cần tìm việc gì không, để em hỗ trợ nha!\"\n"
    "Ví dụ giọng văn SAI (tránh): \"Không đúng bạn ạ, hôm nay là thứ 2, ngày 06/07/2026.\" — quá khô, thiếu cảm xúc.\n"
    "NGẮN GỌN: tối đa 2-3 câu, đủ ý là dừng — TUYỆT ĐỐI không lặp lại ý, không giải thích dài dòng, không thêm "
    "câu đưa đẩy thừa. Có thể kết bằng một câu hỏi gợi ý ngắn nếu tự nhiên, không bắt buộc phải có.\n"
    "Nếu cần liệt kê danh sách: dùng dấu \"•\" hoặc số thứ tự (1., 2., 3.) ở đầu dòng — "
    "TUYỆT ĐỐI không dùng dấu \"*\" hay markdown (**in đậm**, _in nghiêng_, # tiêu đề...) vì khung chat chỉ hiển thị "
    "văn bản thuần, mọi ký tự đặc biệt sẽ hiện nguyên văn chứ không được định dạng."
)

EVIDENCE_RULES = (
    "QUY TẮC BẮT BUỘC:\n"
    "- CHỈ nhắc tên công ty/vị trí tuyển dụng/tiêu đề tin tức nếu nó xuất hiện Y NGUYÊN trong phần EVIDENCE dưới đây. "
    "TUYỆT ĐỐI không tự nghĩ ra hoặc lấy từ kiến thức chung của bạn một công ty/việc làm/tin tức nào không có trong "
    "EVIDENCE, dù nó nghe có vẻ hợp lý hay đúng thực tế.\n"
    "- Không tự suy luận số liệu hay thông tin không có trong EVIDENCE.\n"
    "- Nếu bạn muốn thêm bối cảnh/kiến thức chung bên ngoài EVIDENCE để câu trả lời hữu ích hơn, PHẢI nói rõ "
    "đó là thông tin bạn biết thêm (không phải từ dữ liệu tra cứu), ví dụ: \"(thông tin ngoài, bạn tham khảo thêm)\".\n"
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
    "- Nếu EVIDENCE có các trường \"độ tin cậy\", \"quy mô\", \"nhân sự\", \"đang tuyển\", \"phúc lợi\" cho từng "
    "công ty — đây là câu hỏi SO SÁNH THẬT giữa các công ty cụ thể. Phải đánh giá dựa trên các số liệu này "
    "(ví dụ: công ty nào độ tin cậy cao hơn, quy mô lớn hơn, đang tuyển nhiều vị trí hơn, phúc lợi tốt hơn), "
    "nêu rõ RA SỐ LIỆU CỤ THỂ khi so sánh (\"A có độ tin cậy 85% trong khi B chỉ 60%\"), rồi kết luận công ty "
    "nào phù hợp hơn và VÌ SAO (dựa trên tiêu chí nào). Nếu 2 công ty ngang nhau ở 1 tiêu chí, nói rõ ngang nhau.\n"
    "- Nếu chỉ có 1 công ty trong EVIDENCE dù người dùng hỏi so sánh 2 công ty, nói rõ công ty còn lại không có "
    "trong dữ liệu, không tự bịa thông tin cho công ty đó.\n"
    "- Nếu EVIDENCE KHÔNG có các trường số liệu trên (chỉ có danh sách xếp theo độ liên quan — trường hợp tìm "
    "kiếm/gợi ý chung, không phải so sánh 2 công ty cụ thể): danh sách đã được xếp theo thứ tự liên quan giảm "
    "dần (số 1 phù hợp nhất). Trả lời NGẮN GỌN (3-5 câu): chọn thẳng 1-2 công ty phù hợp nhất dựa theo thứ tự "
    "đó, không liệt kê lại toàn bộ danh sách, không lan man giải thích thiếu dữ liệu xếp hạng — vẫn chọn công "
    "ty đứng đầu làm gợi ý chính, nói rõ đó là dựa trên mức độ liên quan, rồi hỏi lại 1 câu ngắn xem người "
    "dùng có tiêu chí cụ thể nào khác không."
)


def _businesses_to_facts(businesses: List[Dict]) -> str:
    if not businesses:
        return "(không có)"
    lines = []
    for i, b in enumerate(businesses[:10], 1):
        similarity = b.get('similarity')
        relevance = f" | độ liên quan: {round(similarity, 2)}" if similarity is not None else ""

        # These only come back populated from sql_business_retriever (exact
        # lookup / compare's named lookup), not the vector search path (its
        # SELECT doesn't fetch them) — omitted per-field when absent instead
        # of printing "None", since a generic search result legitimately
        # won't have them.
        extra = []
        if b.get('trust_score') is not None:
            extra.append(f"độ tin cậy: {b['trust_score']}%")
        if b.get('scale'):
            extra.append(f"quy mô: {b['scale']}")
        if b.get('staff_count') is not None:
            extra.append(f"nhân sự: {b['staff_count']}")
        if b.get('open_positions') is not None:
            extra.append(f"đang tuyển: {b['open_positions']} vị trí")
        if b.get('benefits'):
            extra.append(f"phúc lợi: {b['benefits'][:200]}")
        if b.get('skills_required'):
            extra.append(f"yêu cầu kỹ năng tuyển dụng: {b['skills_required'][:200]}")
        if b.get('description'):
            extra.append(f"mô tả: {b['description'][:200]}")
        extra_str = (" | " + " | ".join(extra)) if extra else ""

        lines.append(
            f"{i}. {b.get('name')} | ngành: {b.get('industry', '')} | "
            f"khu vực: {b.get('location', '')} {b.get('region', '')} | "
            f"SĐT: {b.get('phone', 'Chưa có')} | website: {b.get('website', '')}{relevance}{extra_str}"
        )
    return "\n".join(lines)


def _jobs_to_facts(jobs: List[Dict]) -> str:
    if not jobs:
        return "(không có)"
    lines = []
    for i, j in enumerate(jobs[:10], 1):
        similarity = j.get('similarity')
        relevance = f" | độ liên quan: {round(similarity, 2)}" if similarity is not None else ""

        extra = []
        if j.get('employment_type'):
            extra.append(f"hình thức: {j['employment_type']}")
        if j.get('months_of_experience') is not None:
            extra.append(f"kinh nghiệm yêu cầu: {j['months_of_experience']} tháng")
        if j.get('skills'):
            extra.append(f"yêu cầu: {j['skills'][:200]}")
        if j.get('benefits'):
            extra.append(f"phúc lợi: {j['benefits'][:200]}")
        if j.get('description'):
            extra.append(f"mô tả: {j['description'][:200]}")
        extra_str = (" | " + " | ".join(extra)) if extra else ""

        lines.append(
            f"{i}. {j.get('title')} tại {j.get('company_name')} | ngành: {j.get('industry', '')} | "
            f"địa điểm: {j.get('location', 'Chưa rõ')}{relevance}{extra_str}"
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


def _format_history_for_prompt(history: Optional[List[Dict]]) -> str:
    """Renders recent turns (and a leading summary message, if the history
    was collapsed by ConversationService.get_effective_history) into a plain
    "Lịch sử hội thoại" block for a user_prompt. Empty string if there's no
    history to include, so callers can just always append this."""
    if not history:
        return ""
    lines = []
    for m in history:
        role = m.get('role')
        content = (m.get('content') or '')[:400]
        if not content:
            continue
        if role == 'system':
            lines.append(f"[Bối cảnh]: {content}")
        else:
            speaker = 'Người dùng' if role == 'user' else 'Company'
            lines.append(f"{speaker}: {content}")
    if not lines:
        return ""
    return "Lịch sử hội thoại gần đây:\n" + "\n".join(lines) + "\n\n"


# General site knowledge so questions like "sao tôi không thấy nút yêu
# thích", "thông báo ở đâu", "web này để làm gì" get a grounded answer
# instead of "em không tìm thấy thông tin đó" — kept to real, current
# features only; update this whenever a feature actually changes.
SITE_FACTS = (
    "SỰ THẬT về website (chỉ dùng để trả lời câu hỏi liên quan đến cách dùng web, không suy diễn thêm):\n"
    "- Web này là nền tảng TUYỂN DỤNG: ứng viên tìm việc & ứng tuyển, nhà tuyển dụng đăng tin, có chatbot Company "
    "hỗ trợ tìm kiếm và tư vấn.\n"
    "- Thanh điều hướng trên cùng có các tab: \"Trang Chủ\" (tổng quan, giới thiệu tính năng nổi bật), "
    "\"Doanh Nghiệp\" (tìm kiếm, lọc nhà tuyển dụng theo ngành nghề/khu vực, xem mô tả công ty + vị trí đang "
    "tuyển của công ty đó), \"Tuyển Dụng\" (dropdown gồm \"Tin Tuyển Dụng\" — danh sách vị trí đang tuyển thật, "
    "ứng tuyển trực tiếp kèm thư xin việc + CV; và \"Tin Đã Đăng\" — chỉ nhà tuyển dụng thấy, quản lý tin mình "
    "đã đăng và xem/xử lý đơn ứng tuyển), \"Tin Tức\" (tin tức việc làm/nghề nghiệp theo chuyên mục), "
    "\"Hồ Sơ\" (chỉ ứng viên đã đăng nhập: quản lý hồ sơ ứng viên, tải CV lên để AI tự động đọc và điền sẵn "
    "thông tin, AI gợi ý viết mô tả kinh nghiệm/mục tiêu nghề nghiệp, AI chấm điểm hồ sơ và chỉ ra điểm cần sửa, "
    "xem việc làm AI gợi ý theo hồ sơ, xem lịch sử ứng tuyển và nhắn tin với nhà tuyển dụng).\n"
    "- Icon trái tim (Yêu Thích) và chuông thông báo nằm ở góc phải thanh điều hướng — Yêu Thích lưu lại nhà "
    "tuyển dụng/tin đã lưu, chuông hiển thị thông báo hệ thống và thông báo cá nhân.\n"
    "- Trên mỗi tin tuyển dụng đều có nút \"Báo cáo\" để ứng viên tố cáo tin lừa đảo/đa cấp/sai sự thật/quấy rối "
    "cho đội ngũ quản trị xử lý.\n"
    "- Cần đăng nhập để: ứng tuyển việc làm, đăng tin tuyển dụng, quản lý hồ sơ ứng viên, lưu yêu thích, nhận "
    "thông báo. Không đăng nhập vẫn xem/tìm kiếm việc làm và doanh nghiệp được.\n"
    "- Nút chat nổi (hình chatbot) ở góc màn hình để mở/đóng khung chat với Company bất cứ lúc nào."
)

# Keeps the bot from wandering into general-purpose-assistant territory
# (homework help, coding questions, random trivia, etc.) once it's framed
# as a recruitment product — simple greetings/self-intro/site-usage stay
# fully answerable, everything else outside that scope gets a short,
# friendly redirect instead of an attempt to actually answer it.
SCOPE_RULES = (
    "PHẠM VI HỖ TRỢ — chỉ trả lời đầy đủ 3 loại câu hỏi sau:\n"
    "1. Chào hỏi đơn giản (\"chào\", \"hi\", \"bạn khỏe không\"...).\n"
    "2. Tự giới thiệu bản thân Company / giới thiệu trang web này dùng để làm gì.\n"
    "3. Hướng dẫn cơ bản cách dùng website (dựa đúng theo SỰ THẬT bên dưới).\n"
    "Nếu câu hỏi KHÔNG thuộc 3 loại trên và cũng KHÔNG phải yêu cầu tra cứu nhà tuyển dụng/tin tức nghề nghiệp cụ "
    "thể (ví dụ: hỏi bài tập, lập trình, thời tiết, thể thao, giải trí, kiến thức chung không liên quan việc làm...), "
    "TỪ CHỐI ngắn gọn và thân thiện — nói rõ Company chỉ hỗ trợ tìm việc/tra cứu nhà tuyển dụng/tin tức nghề "
    "nghiệp, rồi mời người dùng hỏi lại đúng chủ đề. KHÔNG cố trả lời nội dung ngoài phạm vi dù bạn biết đáp án."
)

SMALLTALK_SYSTEM_PROMPT = (
    f"{SMALL_PERSONA}\n\n"
    "Đây là chit-chat thông thường hoặc câu hỏi về cách dùng website, KHÔNG phải yêu cầu tra cứu doanh nghiệp/tin "
    "tức cụ thể. Trả lời ngắn gọn (2-3 câu), đủ ý là dừng, tự nhiên, đúng nội dung câu hỏi.\n"
    f"{SCOPE_RULES}\n"
    f"{SITE_FACTS}\n"
    "Nếu câu hỏi liên quan tới cách dùng web, dựa vào SỰ THẬT ở trên — đừng bịa tính năng không có trong đó, "
    "nếu không chắc/tính năng chưa tồn tại thì nói thật là chưa hỗ trợ.\n"
    "Nếu câu hỏi cần biết ngày/giờ hiện tại, dùng thông tin ngày hôm nay được cho sẵn dưới đây — không tự đoán."
)

# Ground truth for BusinessCreate (app/api/business.py) — only
# ten_doanh_nghiep is required, everything else is Optional with defaults —
# so the LLM answers "is X required / do I need Y" from real facts instead
# of guessing at a generic SaaS onboarding flow.
ADD_BUSINESS_FACTS = (
    "SỰ THẬT về tính năng thêm doanh nghiệp lên hệ thống (chỉ dùng thông tin này để trả lời, không suy diễn thêm):\n"
    "- Cách thêm: đăng nhập → vào tab \"Doanh Nghiệp\" → bấm nút \"Thêm doanh nghiệp\" (hoặc nút \"Thêm doanh nghiệp "
    "ngay\" mà chatbot gợi ý) → điền form → bấm Lưu.\n"
    "- Trường BẮT BUỘC duy nhất: Tên doanh nghiệp. Không có trường nào khác là bắt buộc.\n"
    "- Các trường TÙY CHỌN, có thể bỏ trống rồi bổ sung sau: ngành nghề, vùng miền, tỉnh/thành, quận/huyện, "
    "địa chỉ, website, email, số điện thoại, Facebook, Zalo, LinkedIn, quy mô nhân sự, mã số thuế, ngày thành lập, "
    "logo, mô tả, ghi chú, số vị trí đang tuyển dụng.\n"
    "- KHÔNG cần upload giấy phép kinh doanh hay bất kỳ tài liệu/giấy tờ nào.\n"
    "- KHÔNG cần admin duyệt trước — doanh nghiệp hiện ngay trong danh sách công khai sau khi bấm Lưu.\n"
    "- Độ tin cậy (trust score) của doanh nghiệp tăng dần khi điền thêm thông tin (địa chỉ, website, mạng xã hội...), "
    "không phải một bước duyệt riêng."
)

ADD_BUSINESS_SYSTEM_PROMPT = (
    f"{SMALL_PERSONA}\n\n"
    "Người dùng đang hỏi về việc thêm/đăng ký doanh nghiệp của họ lên hệ thống — có thể là câu hỏi đầu tiên "
    "hoặc câu hỏi đào sâu tiếp theo (VD: trường nào bắt buộc, có cần giấy tờ không, đăng xong ai duyệt, "
    "sửa/xóa lại ở đâu...).\n\n"
    f"{ADD_BUSINESS_FACTS}\n\n"
    "Trả lời ĐÚNG TRỌNG TÂM câu hỏi dựa trên sự thật ở trên. TUYỆT ĐỐI không bịa thêm bước, giấy tờ, hay quy trình "
    "duyệt nào không có trong danh sách sự thật. Nếu người dùng hỏi điều gì đó không có trong sự thật (ví dụ tính "
    "năng chưa tồn tại), nói thật là chưa hỗ trợ, đừng đoán mò.\n"
    "LƯU Ý: nếu tin nhắn chỉ đơn giản là muốn thêm doanh nghiệp và KHÔNG hỏi thêm chi tiết cụ thể nào (không hỏi "
    "về trường bắt buộc, giấy tờ, duyệt, sửa/xóa...), thì chỉ cần 1 câu khích lệ ngắn thân thiện — vì phần hướng dẫn "
    "3 bước đã được hiển thị riêng phía trên rồi, đừng lặp lại các bước đó."
)


class ResponseGenerator:
    def __init__(self):
        self._template_fallback = get_enhanced_response_generator()

    def _jobs_template_response(self, jobs: List[Dict]) -> str:
        """Deterministic fallback when both LLM providers fail — mirrors
        enhance_business_response's role for businesses, but jobs have no
        equivalent in enhanced_response_generator.py (job_listings didn't
        exist when that was written), so this is a minimal template rather
        than delegating to it."""
        lines = ["Chào bạn! 💼 Em tìm thấy vài vị trí có thể phù hợp:\n"]
        for j in jobs[:5]:
            location = f" - {j['location']}" if j.get('location') else ""
            lines.append(f"• {j.get('title')} tại {j.get('company_name')}{location}")
        lines.append("\nBạn muốn xem chi tiết vị trí nào không? 😊")
        return "\n".join(lines)

    def generate_add_business_help(self, message: str, history: Optional[List[Dict]] = None) -> str:
        """Answers both the initial "how do I add my business" ask and any
        follow-up about it (which fields are required, do I need a license,
        does it need admin approval, etc.) — grounded in ADD_BUSINESS_FACTS
        so the LLM explains the real form/flow instead of guessing at a
        generic SaaS onboarding process."""
        history_snippet = _format_history_for_prompt(history)
        answer = generate_with_fallback(
            system_prompt=ADD_BUSINESS_SYSTEM_PROMPT,
            user_prompt=f"{history_snippet}Tin nhắn mới nhất: {message}",
            temperature=0.6,
            # Some providers (e.g. OpenCode Zen's "big-pickle") are reasoning
            # models that spend part of the token budget on invisible
            # "thinking" before the visible answer — a tight max_tokens cut
            # the real answer off mid-sentence once the reasoning ate most
            # of it. Padded well above what the answer itself needs.
            max_tokens=700,
        )
        return answer or (
            "Để thêm doanh nghiệp, bạn bấm nút \"Thêm doanh nghiệp ngay\" bên dưới nhé "
            "(cần đăng nhập trước) — chỉ cần điền tên doanh nghiệp là lưu được, các mục khác bổ sung sau cũng được ạ 😊"
        )

    def generate_smalltalk(self, message: str, history: Optional[List[Dict]] = None) -> str:
        """Casual chit-chat with no business/news evidence involved — still
        goes through the LLM so it can actually address what was asked
        (e.g. "hôm nay là chủ nhật đúng không") instead of a canned greeting
        template that ignores the question content.

        `history` (recent turns, possibly prefixed with a summary message —
        see ConversationService.get_effective_history) is threaded through so
        a follow-up like "vậy còn cái tôi hỏi lúc nãy thì sao" doesn't get a
        response that's blind to everything said before it."""
        today = datetime.now().strftime("%A, %d/%m/%Y")
        history_snippet = _format_history_for_prompt(history)
        prompt = (
            f"(Chỉ dùng nếu được hỏi) Hôm nay là: {today}\n"
            f"{history_snippet}"
            f"Câu hỏi/tin nhắn mới nhất: {message}"
        )

        answer = generate_with_fallback(
            system_prompt=SMALLTALK_SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.9,
            # Padded well above the ~2-3 short sentences actually needed —
            # some providers (e.g. OpenCode Zen's "big-pickle") spend part of
            # the budget on invisible "reasoning" tokens before the visible
            # answer, and a longer system prompt (persona + scope rules +
            # site facts) means more of that reasoning, which was cutting
            # the real answer off mid-sentence at the old max_tokens=256.
            max_tokens=700,
        )
        return answer or 'Em là Company, trợ lý tìm việc — hỗ trợ tìm việc làm, tra cứu nhà tuyển dụng & tin tức nghề nghiệp. Bạn cần tìm gì không? 🔍'

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
                "Chào bạn! 📰 Em chưa tìm thấy tin tức phù hợp với yêu cầu này. "
                "Bạn thử mô tả rõ hơn chủ đề quan tâm nhé! 🔍"
            )
        if understanding.topic == "jobs":
            return (
                "Chào bạn! 💼 Em chưa tìm thấy vị trí tuyển dụng phù hợp với yêu cầu này. "
                "Bạn thử mô tả rõ hơn vị trí/kỹ năng/khu vực đang tìm, hoặc ghé tab \"Tuyển Dụng\" để xem "
                "toàn bộ danh sách nhé! 🔍"
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
        if evidence.has_jobs:
            return self._jobs_template_response(evidence.jobs)
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
            f"EVIDENCE - Việc làm:\n{_jobs_to_facts(evidence.jobs)}\n\n"
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
        # followup_reasoning/compare prompts carry REASONING_INSTRUCTIONS plus
        # up to 10 evidence items — reasoning-model fallbacks (opencode's free
        # tier, used whenever Groq/Gemini are both quota-exhausted) burn a
        # sizeable chunk of max_tokens on hidden "thinking" before the visible
        # answer (confirmed: a real followup_reasoning call truncated mid-
        # sentence at 1024). Give this heavier case more headroom than a
        # plain search/lookup answer needs.
        is_reasoning_heavy = understanding.operation in ("followup_reasoning", "compare")
        answer = generate_with_fallback(
            system_prompt=SMALL_PERSONA,
            user_prompt=prompt,
            temperature=0.85,
            max_tokens=2048 if is_reasoning_heavy else 1024,
        )
        return answer if answer and len(answer) >= 10 else None


_response_generator: Optional[ResponseGenerator] = None


def get_response_generator() -> ResponseGenerator:
    global _response_generator
    if _response_generator is None:
        _response_generator = ResponseGenerator()
    return _response_generator
