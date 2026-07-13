"""
CV AI Service
- CV Parser: extract plain text from uploaded PDF/DOCX resumes, then have
  the LLM bóc tách (parse) candidate fields out of it for profile auto-fill.
- AI CV Builder: draft professional profile text (career objective /
  experience summary) and score a candidate's profile with concrete
  weaknesses to fix.

Reuses the existing structured/plain LLM provider chain in
app.services.llm_provider — no new AI infra.
"""
import io
import json
import logging
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


# Below this many extracted characters, treat pypdf's result as "no real
# text layer" (some CV templates, e.g. Canva exports, render text as vector
# paths with no encoding pypdf can read) and fall back to OCR instead of
# silently returning near-nothing to the AI parser.
MIN_PDF_TEXT_LENGTH = 30


def _ocr_pdf(content: bytes) -> str:
    """Render each PDF page to an image and OCR it — last-resort path for
    scanned/vector-graphic PDFs with no extractable text layer. Requires the
    poppler-utils and tesseract-ocr system packages (see Dockerfile)."""
    from pdf2image import convert_from_bytes
    import pytesseract

    pages = convert_from_bytes(content)
    return "\n".join(pytesseract.image_to_string(page, lang="vie+eng") for page in pages)


def extract_text_from_cv(content: bytes, ext: str) -> str:
    """Best-effort plain-text extraction. Legacy .doc (binary Word format)
    has no lightweight pure-Python reader available here — returns "" so
    callers degrade gracefully (skip AI parsing) instead of failing the
    upload itself."""
    ext = ext.lower()
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
            if len(text.strip()) < MIN_PDF_TEXT_LENGTH:
                logger.info("PDF has no usable text layer, falling back to OCR")
                try:
                    ocr_text = _ocr_pdf(content)
                    if len(ocr_text.strip()) > len(text.strip()):
                        return ocr_text
                except Exception as e:
                    logger.warning(f"OCR fallback failed: {e}")
            return text
        if ext == ".docx":
            from docx import Document
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        return ""
    except Exception as e:
        logger.warning(f"CV text extraction failed ({ext}): {e}")
        return ""


class _CVParseResult(BaseModel):
    """All fields default to None. QUERY_UNDERSTANDING_PROVIDER is now
    "opencode" (see query_parser._LLMQueryUnderstanding for the same fix
    applied earlier) — it only uses response_format=json_object, not true
    schema enforcement, so the model frequently omits fields entirely. With
    no default, pydantic requires the key to be *present* (even if null),
    and a single missing field raised ValidationError on every real CV
    upload, silently discarding the parse (caught below) and never auto-
    filling the profile form. Only revert to bare Optional[...] (no
    default) if QUERY_UNDERSTANDING_PROVIDER is switched back to a
    provider using true schema-constrained output (e.g. Gemini's
    response_schema, which rejects fields carrying a "default" key)."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    years_of_experience: Optional[int] = None
    skills: Optional[str] = None
    experience_summary: Optional[str] = None
    education_summary: Optional[str] = None


CV_PARSE_INSTRUCTIONS = """Bạn là công cụ bóc tách thông tin từ CV (resume parser).
Đọc nội dung CV dưới đây và trích xuất các trường thông tin. Chỉ điền khi CÓ trong CV,
để null nếu không tìm thấy hoặc không chắc chắn. KHÔNG bịa thông tin.

- full_name: họ tên đầy đủ của ứng viên
- phone: số điện thoại (giữ nguyên định dạng gốc)
- headline: chức danh/vị trí mong muốn (ví dụ "Backend Developer", "Nhân viên Kinh doanh")
- years_of_experience: số năm kinh nghiệm làm việc, ước lượng số nguyên từ lịch sử làm việc trong CV; null nếu là sinh viên/mới ra trường
- skills: danh sách kỹ năng, ngăn cách bởi dấu phẩy
- experience_summary: tóm tắt 3-5 câu về kinh nghiệm làm việc
- education_summary: tóm tắt học vấn (trường, chuyên ngành, năm tốt nghiệp)
"""


def parse_cv_text(cv_text: str) -> Optional[dict]:
    """Returns extracted fields (only the ones the model was confident
    about), or None if no structured-output provider is configured or the
    call failed outright — callers must treat this as best-effort."""
    if not cv_text or not cv_text.strip():
        return None
    from app.services.llm_provider import get_structured_provider

    provider = get_structured_provider()
    if provider is None:
        logger.warning("No structured-output LLM provider configured, cannot parse CV")
        return None

    # Gemini's context window is plenty for a resume; truncate defensively
    # against a pathological multi-hundred-page upload.
    prompt = f"{CV_PARSE_INSTRUCTIONS}\n\nNội dung CV:\n{cv_text[:12000]}"
    try:
        raw = provider.generate_structured(prompt, _CVParseResult, temperature=0.1)
        if not raw:
            return None
        parsed = _CVParseResult.model_validate(json.loads(raw))
        return parsed.model_dump(exclude_none=True)
    except Exception as e:
        logger.warning(f"CV parse failed: {e}")
        return None


SUGGEST_FIELD_LABELS = {
    "experience_summary": "phần Mô tả Kinh nghiệm làm việc",
    "objective": "phần Mục tiêu nghề nghiệp (career objective)",
}


def suggest_profile_text(field: str, industry: Optional[str], headline: Optional[str], skills: Optional[str]) -> Optional[str]:
    """Draft a professional paragraph for the candidate's profile — a
    suggestion to review/edit, never auto-saved by this function itself."""
    from app.services.llm_provider import generate_with_fallback

    label = SUGGEST_FIELD_LABELS.get(field, field)
    context_lines = []
    if headline:
        context_lines.append(f"Vị trí mong muốn: {headline}")
    if industry:
        context_lines.append(f"Ngành nghề: {industry}")
    if skills:
        context_lines.append(f"Kỹ năng: {skills}")
    context = "\n".join(context_lines) or "(Ứng viên chưa cung cấp thêm thông tin)"

    system_prompt = (
        f"Bạn là chuyên gia tư vấn CV, viết hộ ứng viên tiếng Việt {label}, "
        "văn phong chuyên nghiệp, súc tích (3-5 câu), nêu bật thế mạnh phù hợp ngành nghề. "
        "CHỈ trả về đoạn văn bản, không thêm tiêu đề hay giải thích."
    )
    user_prompt = f"Thông tin ứng viên:\n{context}"
    return generate_with_fallback(system_prompt, user_prompt, temperature=0.6, max_tokens=400)


class _CVScoreResult(BaseModel):
    """See _CVParseResult above for why every optional field needs an
    explicit default under the current opencode structured-output provider."""
    score: int = 0
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None


CV_SCORE_INSTRUCTIONS = """Bạn là chuyên gia tuyển dụng, chấm điểm hồ sơ ứng viên (0-100) dựa trên:
- Độ đầy đủ thông tin (họ tên, kỹ năng, kinh nghiệm, học vấn)
- Mức độ cụ thể/định lượng của phần mô tả kinh nghiệm (có số liệu, kết quả cụ thể không, hay chỉ chung chung)
- Sự rõ ràng và phù hợp của các kỹ năng liệt kê

Trả về JSON gồm:
- score: điểm số 0-100
- strengths: các điểm mạnh, mỗi ý ngăn cách bởi dấu ";"
- weaknesses: các điểm YẾU CẦN SỬA cụ thể để tăng tỷ lệ đỗ, mỗi ý ngăn cách bởi dấu ";"
"""


def score_profile(full_name, headline, skills, experience_summary, education_summary) -> Optional[dict]:
    from app.services.llm_provider import get_structured_provider

    provider = get_structured_provider()
    if provider is None:
        return None

    lines = [
        f"Họ tên: {full_name or '(chưa có)'}",
        f"Vị trí mong muốn: {headline or '(chưa có)'}",
        f"Kỹ năng: {skills or '(chưa có)'}",
        f"Kinh nghiệm: {experience_summary or '(chưa có)'}",
        f"Học vấn: {education_summary or '(chưa có)'}",
    ]
    prompt = f"{CV_SCORE_INSTRUCTIONS}\n\nHồ sơ ứng viên:\n" + "\n".join(lines)
    try:
        raw = provider.generate_structured(prompt, _CVScoreResult, temperature=0.2)
        if not raw:
            return None
        parsed = _CVScoreResult.model_validate(json.loads(raw))
        return {
            "score": max(0, min(100, parsed.score)),
            "strengths": [s.strip() for s in (parsed.strengths or "").split(";") if s.strip()],
            "weaknesses": [s.strip() for s in (parsed.weaknesses or "").split(";") if s.strip()],
        }
    except Exception as e:
        logger.warning(f"CV score failed: {e}")
        return None
