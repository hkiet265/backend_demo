"""
Candidate API Routes
Phase 1 (Ứng viên): hồ sơ ứng viên, upload CV, ứng tuyển, lưu việc làm.
"""
import logging
import mimetypes
import os
import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from psycopg2.extras import RealDictCursor

from app.database import get_db_connection
from app.dependencies import get_current_user, get_embedding_service
from app.services.encryption_service import get_encryption_service
from app.services.cv_ai_service import (
    extract_text_from_cv, parse_cv_text, suggest_profile_text, score_profile,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/candidates", tags=["candidates"])


def _profile_embedding_text(full_name, headline, skills, experience_summary) -> str:
    parts = [headline, skills, experience_summary]
    return " | ".join(p for p in parts if p) or (full_name or "")


def _embed_candidate_profile(cur, user_id: int, full_name, headline, skills, experience_summary) -> None:
    """Best-effort: an embedding-API hiccup must never fail the profile
    save itself, just leave suggestions stale until the next successful
    update (same pattern as news_crawler_service._backfill_new_embeddings)."""
    text = _profile_embedding_text(full_name, headline, skills, experience_summary)
    if not text.strip():
        return
    try:
        embedding = get_embedding_service().generate_document_embedding(text)
        cur.execute(
            "UPDATE candidate_profiles SET embedding = %s::vector WHERE user_id = %s",
            ("[" + ",".join(map(str, embedding)) + "]", user_id),
        )
    except Exception as e:
        logger.warning(f"Candidate profile embedding failed for user {user_id}: {e}")

# Absolute, anchored to the repo root (two levels up from app/api/) — a
# relative path here would depend on the process's working directory at
# launch, so a differently-configured restart could silently orphan every
# previously stored CV path in the database.
CV_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "cv")
ALLOWED_CV_EXTENSIONS = (".pdf", ".doc", ".docx")
MAX_CV_SIZE_BYTES = 5 * 1024 * 1024  # 5MB


def _save_encrypted_cv(content: bytes, filename: str, user_id: int) -> str:
    """Validates extension/size, encrypts, and writes a CV file to disk —
    shared by the profile CV upload and the per-application CV attachment
    below (POST /jobs/{job_id}/apply), since both need identical
    validation/at-rest-encryption handling. Returns the stored path."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_CV_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .pdf, .doc hoặc .docx")
    if len(content) > MAX_CV_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File quá lớn (tối đa 5MB)")

    encrypted_content = get_encryption_service().encrypt_bytes(content)
    os.makedirs(CV_UPLOAD_DIR, exist_ok=True)
    stored_name = f"{user_id}_{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(CV_UPLOAD_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(encrypted_content)
    return stored_path


def read_decrypted_cv(path: str) -> Response:
    """Shared by candidates.download_cv (own CV) and jobs.download_applicant_cv
    (employer viewing an applicant's CV) — files are encrypted at rest, so
    FileResponse-from-disk won't work; read + decrypt into memory instead."""
    with open(path, "rb") as f:
        encrypted = f.read()
    content = get_encryption_service().decrypt_bytes(encrypted)
    filename = os.path.basename(path)
    media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return Response(
        content=content, media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    experience_summary: Optional[str] = None
    education_summary: Optional[str] = None
    skills: Optional[str] = None
    is_open_to_work: Optional[bool] = None


class SuggestTextRequest(BaseModel):
    field: str  # "experience_summary" | "objective"
    industry: Optional[str] = None


SUGGESTABLE_FIELDS = {"experience_summary", "objective"}


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT user_id, full_name, phone_encrypted, headline, experience_summary, "
                "education_summary, skills, cv_file_path, is_open_to_work, updated_at "
                "FROM candidate_profiles WHERE user_id = %s",
                (current_user["id"],),
            )
            profile = cur.fetchone()
            cur.close()
        if profile:
            profile["phone"] = get_encryption_service().decrypt_phone(profile.pop("phone_encrypted"))
        return {"status": "success", "data": profile}
    except Exception as e:
        logger.error(f"Get candidate profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/profile")
async def upsert_profile(request: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    try:
        # Encrypted at rest (Fernet, same service used for business phone/
        # email) — candidate_profiles no longer has a plaintext phone column.
        phone_encrypted = get_encryption_service().encrypt_phone(request.phone) if request.phone else None

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO candidate_profiles (
                    user_id, full_name, phone_encrypted, headline, experience_summary,
                    education_summary, skills, is_open_to_work, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, COALESCE(%s, true), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    full_name = COALESCE(EXCLUDED.full_name, candidate_profiles.full_name),
                    phone_encrypted = COALESCE(EXCLUDED.phone_encrypted, candidate_profiles.phone_encrypted),
                    headline = COALESCE(EXCLUDED.headline, candidate_profiles.headline),
                    experience_summary = COALESCE(EXCLUDED.experience_summary, candidate_profiles.experience_summary),
                    education_summary = COALESCE(EXCLUDED.education_summary, candidate_profiles.education_summary),
                    skills = COALESCE(EXCLUDED.skills, candidate_profiles.skills),
                    is_open_to_work = COALESCE(%s, candidate_profiles.is_open_to_work),
                    updated_at = NOW()
                """,
                (
                    current_user["id"], request.full_name, phone_encrypted, request.headline,
                    request.experience_summary, request.education_summary, request.skills,
                    request.is_open_to_work, request.is_open_to_work,
                ),
            )

            cur.execute(
                "SELECT full_name, headline, skills, experience_summary FROM candidate_profiles WHERE user_id = %s",
                (current_user["id"],),
            )
            saved = cur.fetchone()
            _embed_candidate_profile(cur, current_user["id"], *saved)

            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã cập nhật hồ sơ"}
    except Exception as e:
        logger.error(f"Update candidate profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile/cv")
async def upload_cv(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        content = await file.read()
        ext = os.path.splitext(file.filename or "")[1].lower()
        # Encrypted at rest — a CV contains full name/phone/email/address in
        # plain text, no different from the DB fields already encrypted.
        stored_path = _save_encrypted_cv(content, file.filename, current_user["id"])

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT cv_file_path FROM candidate_profiles WHERE user_id = %s", (current_user["id"],))
            existing = cur.fetchone()
            old_cv_path = existing[0] if existing else None

            cur.execute(
                """
                INSERT INTO candidate_profiles (user_id, cv_file_path, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (user_id) DO UPDATE SET cv_file_path = EXCLUDED.cv_file_path, updated_at = NOW()
                """,
                (current_user["id"], stored_path),
            )
            conn.commit()
            cur.close()

        # Remove the previous CV file now that the DB points at the new one —
        # otherwise every re-upload leaves the old file orphaned on disk forever.
        if old_cv_path and old_cv_path != stored_path and os.path.isfile(old_cv_path):
            try:
                os.remove(old_cv_path)
            except OSError as e:
                logger.warning(f"Could not remove old CV file {old_cv_path}: {e}")

        # CV Parser (best-effort): bóc tách thông tin từ chính file vừa
        # upload để gợi ý điền sẵn form hồ sơ — KHÔNG tự lưu vào DB, ứng
        # viên xem lại và bấm áp dụng ở frontend, tránh AI hiểu sai lại
        # ghi đè dữ liệu đã có.
        parsed_profile = None
        cv_text = extract_text_from_cv(content, ext)
        if cv_text:
            parsed_profile = parse_cv_text(cv_text)

        return {"status": "success", "message": "Đã tải lên CV", "parsed_profile": parsed_profile}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload CV error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/cv")
async def download_cv(current_user: dict = Depends(get_current_user)):
    """Only the profile owner can download their own CV back."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT cv_file_path FROM candidate_profiles WHERE user_id = %s", (current_user["id"],))
            row = cur.fetchone()
            cur.close()
        if not row or not row[0] or not os.path.isfile(row[0]):
            raise HTTPException(status_code=404, detail="Chưa có CV nào được tải lên")

        return read_decrypted_cv(row[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download CV error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile/suggest-text")
async def suggest_text(request: SuggestTextRequest, current_user: dict = Depends(get_current_user)):
    """AI CV Builder: draft a professional paragraph for the profile's
    career-objective or experience-summary field, based on the candidate's
    current headline/skills. Returned as a suggestion only — the candidate
    reviews/edits it client-side before saving via PUT /profile."""
    if request.field not in SUGGESTABLE_FIELDS:
        raise HTTPException(status_code=400, detail=f"Trường không hợp lệ: {request.field}")
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT headline, skills FROM candidate_profiles WHERE user_id = %s", (current_user["id"],))
            row = cur.fetchone()
            cur.close()
        headline, skills = (row[0], row[1]) if row else (None, None)

        suggestion = suggest_profile_text(request.field, request.industry, headline, skills)
        if not suggestion:
            raise HTTPException(status_code=503, detail="Không thể tạo gợi ý lúc này, vui lòng thử lại sau")
        return {"status": "success", "data": {"suggestion": suggestion}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Suggest profile text error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/cv-score")
async def get_cv_score(current_user: dict = Depends(get_current_user)):
    """AI CV Builder: chấm điểm hồ sơ hiện tại (0-100) và liệt kê điểm
    mạnh/yếu cụ thể cần sửa để tăng tỷ lệ đỗ."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT full_name, headline, skills, experience_summary, education_summary "
                "FROM candidate_profiles WHERE user_id = %s",
                (current_user["id"],),
            )
            row = cur.fetchone()
            cur.close()
        if not row:
            raise HTTPException(status_code=400, detail="Vui lòng tạo hồ sơ trước khi chấm điểm")

        result = score_profile(*row)
        if not result:
            raise HTTPException(status_code=503, detail="Không thể chấm điểm lúc này, vui lòng thử lại sau")
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_id}/apply")
async def apply_to_job(
    job_id: int,
    cover_letter: Optional[str] = Form(None),
    cv: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    """Multipart (not JSON) since a candidate may attach a CV specific to
    this application — e.g. a version tailored to the role, or they simply
    have none saved in their profile yet. Falls back to the profile CV for
    the "has enough info to apply" gate below when none is attached here."""
    try:
        application_cv_path = None
        if cv is not None and cv.filename:
            content = await cv.read()
            application_cv_path = _save_encrypted_cv(content, cv.filename, current_user["id"])

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT trang_thai, han_nop FROM job_listings WHERE id = %s", (job_id,))
            job = cur.fetchone()
            if not job:
                raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng")
            if job[0] != "Da_duyet":
                raise HTTPException(status_code=404, detail="Tin tuyển dụng chưa được duyệt")
            if job[1] and job[1] < date.today():
                raise HTTPException(status_code=400, detail="Tin tuyển dụng đã hết hạn nộp hồ sơ")

            # An application with no name/skills and no CV gives the
            # employer nothing to review — require at least one of those
            # before letting the application through.
            cur.execute(
                "SELECT full_name, skills, cv_file_path FROM candidate_profiles WHERE user_id = %s",
                (current_user["id"],),
            )
            profile = cur.fetchone()
            has_name = bool(profile and profile[0])
            has_skills = bool(profile and profile[1])
            has_cv = bool(profile and profile[2]) or application_cv_path is not None
            if not (has_name and (has_skills or has_cv)):
                raise HTTPException(
                    status_code=400,
                    detail="Vui lòng hoàn thiện hồ sơ (họ tên + kỹ năng hoặc CV) trước khi ứng tuyển",
                )

            cur.execute(
                """
                INSERT INTO job_applications (job_id, user_id, cover_letter, cv_file_path)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (job_id, user_id) DO NOTHING
                RETURNING id
                """,
                (job_id, current_user["id"], cover_letter, application_cv_path),
            )
            result = cur.fetchone()
            conn.commit()
            cur.close()

        if result:
            return {"status": "success", "message": "Đã nộp đơn ứng tuyển"}
        raise HTTPException(status_code=409, detail="Bạn đã ứng tuyển vị trí này rồi")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Apply to job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/applications")
async def get_my_applications(current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT a.id, a.status, a.created_at, a.cover_letter,
                       j.id as job_id, j.tieu_de, j.ten_doanh_nghiep, j.url
                FROM job_applications a
                JOIN job_listings j ON j.id = a.job_id
                WHERE a.user_id = %s
                ORDER BY a.created_at DESC
                """,
                (current_user["id"],),
            )
            applications = cur.fetchall()
            cur.close()
        return {"status": "success", "data": applications}
    except Exception as e:
        logger.error(f"Get applications error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_id}/save")
async def save_job(job_id: int, current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM job_listings WHERE id = %s", (job_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng")

            cur.execute(
                """
                INSERT INTO saved_jobs (user_id, job_id)
                VALUES (%s, %s)
                ON CONFLICT (user_id, job_id) DO NOTHING
                """,
                (current_user["id"], job_id),
            )
            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã lưu việc làm"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/jobs/{job_id}/save")
async def unsave_job(job_id: int, current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM saved_jobs WHERE user_id = %s AND job_id = %s",
                (current_user["id"], job_id),
            )
            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã bỏ lưu việc làm"}
    except Exception as e:
        logger.error(f"Unsave job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/saved-jobs")
async def get_saved_jobs(current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT j.id, j.tieu_de, j.ten_doanh_nghiep, j.url, j.dia_diem,
                       b.logo_url, b.nganh_nghe, s.created_at as saved_at
                FROM saved_jobs s
                JOIN job_listings j ON j.id = s.job_id
                LEFT JOIN businesses_demo b ON b.id = j.business_id
                WHERE s.user_id = %s
                ORDER BY s.created_at DESC
                """,
                (current_user["id"],),
            )
            jobs = cur.fetchall()
            cur.close()
        return {"status": "success", "data": jobs}
    except Exception as e:
        logger.error(f"Get saved jobs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}/saved")
async def check_job_saved(job_id: int, current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM saved_jobs WHERE user_id = %s AND job_id = %s", (current_user["id"], job_id))
            result = cur.fetchone()
            cur.close()
        return {"saved": result is not None}
    except Exception as e:
        logger.error(f"Check job saved error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suggested-jobs")
async def get_suggested_jobs(current_user: dict = Depends(get_current_user), limit: int = 10):
    """AI job matching: ranks approved job listings by cosine similarity
    to the candidate's profile embedding (pgvector <=> operator). Requires
    the candidate to have filled in enough of their profile to generate an
    embedding — returns an explicit reason otherwise instead of an empty
    list that looks like "no jobs match"."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT embedding, skills FROM candidate_profiles WHERE user_id = %s", (current_user["id"],))
            profile = cur.fetchone()
            if not profile or not profile["embedding"]:
                return {
                    "status": "success",
                    "data": [],
                    "message": "Hãy hoàn thiện hồ sơ (vị trí mong muốn, kỹ năng, kinh nghiệm) để nhận gợi ý việc làm phù hợp",
                }

            # Pure cosine similarity on a short profile ("backend | React")
            # barely discriminates — a Backend job and a ReactJS job can land
            # within ~1 point of each other because there's so little text to
            # go on. Pull a wider pool, then boost jobs that literally mention
            # one of the candidate's listed skills before truncating to
            # `limit`, so an explicit "React" skill can't get buried under
            # generic semantic noise.
            pool_size = max(limit * 4, 40)
            cur.execute(
                """
                SELECT j.id, j.tieu_de, j.ten_doanh_nghiep, j.dia_diem, j.ky_nang,
                       b.logo_url, b.nganh_nghe,
                       1 - (j.embedding <=> %s) as match_score
                FROM job_listings j
                LEFT JOIN businesses_demo b ON b.id = j.business_id
                WHERE j.trang_thai = 'Da_duyet' AND j.embedding IS NOT NULL
                      AND (j.han_nop IS NULL OR j.han_nop >= CURRENT_DATE)
                ORDER BY j.embedding <=> %s
                LIMIT %s;
                """,
                (profile["embedding"], profile["embedding"], pool_size),
            )
            jobs = cur.fetchall()

        skill_keywords = [s.strip().lower() for s in (profile["skills"] or "").split(",") if s.strip()]
        if skill_keywords:
            for job in jobs:
                haystack = f"{job['tieu_de'] or ''} {job['ky_nang'] or ''}".lower()
                matched = sum(1 for kw in skill_keywords if kw in haystack)
                # Capped boost — a couple of literal skill hits should lift a
                # job clear of embedding noise, but shouldn't let one job with
                # 10 comma-separated keyword hits dominate the entire list.
                job["match_score"] = min(1.0, job["match_score"] + 0.08 * min(matched, 3))

        jobs.sort(key=lambda j: j["match_score"], reverse=True)
        return {"status": "success", "data": jobs[:limit]}
    except Exception as e:
        logger.error(f"Get suggested jobs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
