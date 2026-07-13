"""
Job Listings API Routes
Real job postings crawled per business (job_listings table) — powers the
"Việc làm" tab so users can browse actual open positions, not just a count.
"""
import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor

from app.database import get_db_connection
from app.dependencies import get_current_user, get_current_admin, get_embedding_service
from app.services.encryption_service import get_encryption_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _embed_job(cur, job_id: int, tieu_de: str, ky_nang, phuc_loi) -> None:
    """Best-effort — an embedding-API hiccup must never fail job creation,
    it just leaves this one job out of AI suggestions until backfilled."""
    text = " | ".join(p for p in (tieu_de, ky_nang, phuc_loi) if p)
    if not text.strip():
        return
    try:
        embedding = get_embedding_service().generate_document_embedding(text)
        cur.execute(
            "UPDATE job_listings SET embedding = %s::vector WHERE id = %s",
            ("[" + ",".join(map(str, embedding)) + "]", job_id),
        )
    except Exception as e:
        logger.warning(f"Job embedding failed for job {job_id}: {e}")

APPLICATION_STATUSES = {"Moi_nop", "Dang_xem_xet", "Hen_phong_van", "Nhan_viec", "Tu_choi"}
REPORT_REASONS = {"Lua_dao", "Da_cap", "Sai_su_that", "Quay_roi", "Khac"}
REPORT_REASON_LABELS = {
    "Lua_dao": "Lừa đảo",
    "Da_cap": "Đa cấp",
    "Sai_su_that": "Sai sự thật",
    "Quay_roi": "Quấy rối",
    "Khac": "Khác",
}


def _require_owned_job(conn, job_id: int, user_id: int, extra_columns: str = "") -> tuple:
    """Fetch a job_listings row and raise 404/403 unless the current user
    posted it. Used by every job-management/ATS endpoint below so the
    ownership check lives in exactly one place. Opens its own plain
    (tuple-row) cursor — callers may be using a RealDictCursor for their
    main query, and mixing row-factories on one cursor object doesn't work.
    Returns the row tuple (created_by_user_id first, then any extra_columns)."""
    cur = conn.cursor()
    cur.execute(f"SELECT created_by_user_id{extra_columns} FROM job_listings WHERE id = %s", (job_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng")
    if row[0] != user_id:
        raise HTTPException(status_code=403, detail="Bạn không phải chủ tin tuyển dụng này")
    return row


class JobModerationRequest(BaseModel):
    approve: bool


class JobReportRequest(BaseModel):
    reason: str
    details: Optional[str] = None


class ReportResolutionRequest(BaseModel):
    hide_job: bool = False


class JobCreateRequest(BaseModel):
    business_id: int
    tieu_de: str
    mo_ta_cong_viec: Optional[str] = None
    dia_diem: Optional[str] = None
    ky_nang: Optional[str] = None
    phuc_loi: Optional[str] = None


class JobUpdateRequest(BaseModel):
    tieu_de: Optional[str] = None
    mo_ta_cong_viec: Optional[str] = None
    dia_diem: Optional[str] = None
    ky_nang: Optional[str] = None
    phuc_loi: Optional[str] = None


class ApplicationStatusUpdateRequest(BaseModel):
    status: Optional[str] = None
    employer_notes: Optional[str] = None


@router.get("")
async def get_all_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Tìm theo tên vị trí hoặc tên công ty"),
    business_id: Optional[int] = Query(None, description="Chỉ lấy tin của một doanh nghiệp cụ thể"),
    urgent: bool = Query(False, description="Chỉ lấy tin sắp hết hạn nộp, sắp xếp theo hạn nộp gần nhất"),
):
    """List job postings, newest first, optionally filtered by title/company search.
    Only approved jobs are public — employer-posted jobs sit as 'Cho_duyet'
    until an admin reviews them (crawled ITviec jobs are auto-approved)."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)

            # Conditions are qualified with the "j." alias since both queries
            # below join businesses_demo, which also has ten_doanh_nghiep and
            # trang_thai columns — an unqualified reference is ambiguous.
            # Jobs with a KNOWN past deadline are hidden from public
            # browse/search entirely (matches how ITviec/LinkedIn/
            # VietnamWorks behave) — a candidate shouldn't waste time
            # reading, let alone applying to, a posting that's stopped
            # accepting applications. Jobs with no han_nop on file (NULL —
            # e.g. some employer-posted ones) are NOT hidden since we have
            # no evidence they've actually closed.
            conditions = ["j.trang_thai = 'Da_duyet'", "(j.han_nop IS NULL OR j.han_nop >= CURRENT_DATE)"]
            params = []
            if search:
                conditions.append("(j.tieu_de ILIKE %s OR j.ten_doanh_nghiep ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%"])
            if business_id:
                conditions.append("j.business_id = %s")
                params.append(business_id)
            if urgent:
                # Not-yet-expired only — a job whose han_nop already passed
                # isn't "urgent", it's stale/should already be off the list.
                conditions.append("j.han_nop IS NOT NULL AND j.han_nop >= CURRENT_DATE")

            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            order_clause = "j.han_nop ASC" if urgent else "j.created_at DESC"

            cur.execute(
                f"SELECT COUNT(*) FROM job_listings j LEFT JOIN businesses_demo b ON b.id = j.business_id {where_clause};",
                params,
            )
            total = cur.fetchone()["count"]

            offset = (page - 1) * page_size
            params_with_paging = params + [page_size, offset]

            cur.execute(
                f"""
                SELECT j.id, j.business_id, j.ten_doanh_nghiep, j.tieu_de, j.url,
                       j.dia_diem, j.ky_nang, j.phuc_loi, j.nguon, j.created_at,
                       j.ai_industry, j.mo_ta_cong_viec, j.hinh_thuc_lam_viec,
                       j.kinh_nghiem_thang, j.ngay_dang, j.han_nop,
                       b.logo_url, b.nganh_nghe
                FROM job_listings j
                LEFT JOIN businesses_demo b ON b.id = j.business_id
                {where_clause}
                ORDER BY {order_clause}
                LIMIT %s OFFSET %s;
                """,
                params_with_paging,
            )
            rows = cur.fetchall()

            jobs = [
                {
                    "id": r["id"],
                    "business_id": r["business_id"],
                    "company_name": r["ten_doanh_nghiep"],
                    "title": r["tieu_de"],
                    "url": r["url"],
                    "location": r["dia_diem"],
                    "skills": r["ky_nang"],
                    "benefits": r["phuc_loi"],
                    "source": r["nguon"],
                    # Jobs whose business was never crawled into
                    # businesses_demo (business_id NULL, so nganh_nghe is
                    # NULL too) fall back to the AI-classified industry.
                    "industry": r["nganh_nghe"] or r["ai_industry"],
                    "logo_url": r["logo_url"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "description": r["mo_ta_cong_viec"],
                    "employment_type": r["hinh_thuc_lam_viec"],
                    "months_of_experience": r["kinh_nghiem_thang"],
                    "date_posted": r["ngay_dang"].isoformat() if r["ngay_dang"] else None,
                    "deadline": r["han_nop"].isoformat() if r["han_nop"] else None,
                }
                for r in rows
            ]

            return {
                "status": "success",
                "data": jobs,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size if total else 0,
            }

    except Exception as e:
        logger.error(f"Get all jobs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mine")
async def get_my_posted_jobs(current_user: dict = Depends(get_current_user)):
    """Jobs the current user posted themselves (for their own businesses) —
    as opposed to the crawled ITviec listings everyone else sees."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT j.id, j.business_id, j.ten_doanh_nghiep, j.tieu_de, j.mo_ta_cong_viec,
                       j.dia_diem, j.ky_nang, j.phuc_loi, j.created_at, j.trang_thai,
                       (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id) as application_count
                FROM job_listings j
                WHERE j.created_by_user_id = %s
                ORDER BY j.created_at DESC;
                """,
                (current_user["id"],),
            )
            rows = cur.fetchall()
        return {"status": "success", "data": rows}
    except Exception as e:
        logger.error(f"Get my posted jobs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_job(request: JobCreateRequest, current_user: dict = Depends(get_current_user)):
    """Post a new job listing for one of the current user's own businesses."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT ten_doanh_nghiep FROM businesses_demo WHERE id = %s AND created_by_user_id = %s",
                (request.business_id, current_user["id"]),
            )
            business = cur.fetchone()
            if not business:
                raise HTTPException(status_code=403, detail="Bạn không phải chủ sở hữu doanh nghiệp này")

            cur.execute(
                """
                INSERT INTO job_listings (business_id, ten_doanh_nghiep, tieu_de, mo_ta_cong_viec, dia_diem, ky_nang, phuc_loi, nguon, created_by_user_id, trang_thai)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'Đăng trực tiếp', %s, 'Cho_duyet')
                RETURNING id
                """,
                (request.business_id, business[0], request.tieu_de, request.mo_ta_cong_viec,
                 request.dia_diem, request.ky_nang, request.phuc_loi, current_user["id"]),
            )
            new_id = cur.fetchone()[0]
            _embed_job(cur, new_id, request.tieu_de, request.ky_nang, request.phuc_loi)
            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã đăng tin, đang chờ admin duyệt", "id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{job_id}")
async def update_job(job_id: int, request: JobUpdateRequest, current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            _require_owned_job(conn, job_id, current_user["id"])

            cur.execute(
                """
                UPDATE job_listings SET
                    tieu_de = COALESCE(%s, tieu_de),
                    mo_ta_cong_viec = COALESCE(%s, mo_ta_cong_viec),
                    dia_diem = COALESCE(%s, dia_diem),
                    ky_nang = COALESCE(%s, ky_nang),
                    phuc_loi = COALESCE(%s, phuc_loi)
                WHERE id = %s
                """,
                (request.tieu_de, request.mo_ta_cong_viec, request.dia_diem, request.ky_nang, request.phuc_loi, job_id),
            )
            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã cập nhật tin tuyển dụng"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{job_id}")
async def delete_job(job_id: int, current_user: dict = Depends(get_current_user)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            _require_owned_job(conn, job_id, current_user["id"])

            cur.execute("DELETE FROM job_listings WHERE id = %s", (job_id,))
            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã xóa tin tuyển dụng"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}/applications/{application_id}/cv")
async def download_applicant_cv(job_id: int, application_id: int, current_user: dict = Depends(get_current_user)):
    """Employer downloading an applicant's CV — only if they own the job
    this application belongs to (separate from candidates.download_cv,
    which only ever serves the logged-in user's own CV)."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            _require_owned_job(conn, job_id, current_user["id"])

            cur.execute(
                """
                SELECT COALESCE(a.cv_file_path, cp.cv_file_path)
                FROM job_applications a
                LEFT JOIN candidate_profiles cp ON cp.user_id = a.user_id
                WHERE a.id = %s AND a.job_id = %s
                """,
                (application_id, job_id),
            )
            row = cur.fetchone()
            cur.close()

        if not row or not row[0] or not os.path.isfile(row[0]):
            raise HTTPException(status_code=404, detail="Ứng viên chưa có CV")

        from app.api.candidates import read_decrypted_cv
        return read_decrypted_cv(row[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download applicant CV error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}/applications")
async def get_job_applications(job_id: int, current_user: dict = Depends(get_current_user)):
    """ATS view: applicants for one of the current user's own job postings."""
    try:
        with get_db_connection() as conn:
            _, job_title = _require_owned_job(conn, job_id, current_user["id"], extra_columns=", tieu_de")

            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT a.id, a.status, a.cover_letter, a.employer_notes, a.created_at,
                       u.id as candidate_id, u.email, u.phone as user_phone,
                       cp.full_name, cp.phone_encrypted, cp.headline, cp.skills, cp.experience_summary,
                       COALESCE(a.cv_file_path, cp.cv_file_path) as cv_file_path
                FROM job_applications a
                JOIN app_users u ON u.id = a.user_id
                LEFT JOIN candidate_profiles cp ON cp.user_id = a.user_id
                WHERE a.job_id = %s
                ORDER BY a.created_at DESC;
                """,
                (job_id,),
            )
            applications = cur.fetchall()

        encryption_service = get_encryption_service()
        for app in applications:
            app["phone"] = encryption_service.decrypt_phone(app.pop("phone_encrypted"))

        return {"status": "success", "job_title": job_title, "data": applications}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get job applications error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{job_id}/applications/{application_id}")
async def update_application_status(
    job_id: int, application_id: int, request: ApplicationStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Move an applicant through the ATS pipeline / leave an internal note."""
    if request.status and request.status not in APPLICATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Trạng thái không hợp lệ: {request.status}")
    try:
        with get_db_connection() as conn:
            _require_owned_job(conn, job_id, current_user["id"])

            cur = conn.cursor()
            cur.execute(
                """
                UPDATE job_applications SET
                    status = COALESCE(%s, status),
                    employer_notes = COALESCE(%s, employer_notes)
                WHERE id = %s AND job_id = %s
                """,
                (request.status, request.employer_notes, application_id, job_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Không tìm thấy đơn ứng tuyển")
            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã cập nhật"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update application status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending-review")
async def get_pending_jobs(admin: dict = Depends(get_current_admin)):
    """Admin moderation queue: employer-posted jobs awaiting approval
    (crawled ITviec jobs are auto-approved and never show up here)."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT j.id, j.business_id, j.ten_doanh_nghiep, j.tieu_de, j.mo_ta_cong_viec,
                       j.dia_diem, j.ky_nang, j.phuc_loi, j.created_at, j.created_by_user_id,
                       u.email as posted_by_email
                FROM job_listings j
                LEFT JOIN app_users u ON u.id = j.created_by_user_id
                WHERE j.trang_thai = 'Cho_duyet'
                ORDER BY j.created_at ASC;
                """
            )
            rows = cur.fetchall()
        return {"status": "success", "data": rows}
    except Exception as e:
        logger.error(f"Get pending jobs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{job_id}/moderate")
async def moderate_job(job_id: int, request: JobModerationRequest, admin: dict = Depends(get_current_admin)):
    """Admin approves or rejects an employer-posted job. Approved jobs
    become visible in the public GET /api/jobs listing; rejected ones stay
    hidden (kept, not deleted, so the employer can see why via /mine)."""
    try:
        new_status = "Da_duyet" if request.approve else "Tu_choi"
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE job_listings SET trang_thai = %s WHERE id = %s RETURNING id",
                (new_status, job_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng")
            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã duyệt tin" if request.approve else "Đã từ chối tin"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Moderate job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{job_id}/report")
async def report_job(job_id: int, request: JobReportRequest, current_user: dict = Depends(get_current_user)):
    """Community flagging — any logged-in user (usually a candidate) can
    report a job as fraudulent/pyramid-scheme/misleading/harassing. One
    report per user per job (UNIQUE constraint) to prevent spam-reporting
    the same job repeatedly."""
    if request.reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail=f"Lý do không hợp lệ: {request.reason}")
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM job_listings WHERE id = %s", (job_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng")

            cur.execute(
                """
                INSERT INTO job_reports (job_id, reporter_user_id, reason, details)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (job_id, reporter_user_id) DO NOTHING
                RETURNING id
                """,
                (job_id, current_user["id"], request.reason, request.details),
            )
            result = cur.fetchone()
            conn.commit()
            cur.close()

        if result:
            return {"status": "success", "message": "Đã gửi báo cáo, cảm ơn bạn đã giúp cộng đồng an toàn hơn"}
        return {"status": "info", "message": "Bạn đã báo cáo tin này rồi"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports")
async def get_job_reports(
    status: Optional[str] = Query(None, description="Lọc theo trạng thái, mặc định chỉ lấy 'Cho_xu_ly'"),
    admin: dict = Depends(get_current_admin),
):
    """Admin queue: reported jobs, grouped so a job with 5 reports doesn't
    drown out ones with 1 — most-reported first, individual reports nested
    underneath so the admin can still read each reporter's own reason/details."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT r.id, r.job_id, r.reason, r.details, r.status, r.created_at,
                       u.email as reporter_email,
                       j.tieu_de, j.ten_doanh_nghiep, j.trang_thai as job_status,
                       (SELECT COUNT(*) FROM job_reports r2 WHERE r2.job_id = r.job_id) as report_count
                FROM job_reports r
                JOIN app_users u ON u.id = r.reporter_user_id
                JOIN job_listings j ON j.id = r.job_id
                WHERE r.status = %s
                ORDER BY report_count DESC, r.created_at ASC;
                """,
                (status or "Cho_xu_ly",),
            )
            reports = cur.fetchall()
        for r in reports:
            r["reason_label"] = REPORT_REASON_LABELS.get(r["reason"], r["reason"])
        return {"status": "success", "data": reports}
    except Exception as e:
        logger.error(f"Get job reports error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/reports/{report_id}")
async def resolve_job_report(
    report_id: int, request: ReportResolutionRequest, admin: dict = Depends(get_current_admin),
):
    """Admin marks a report handled — optionally hiding the reported job
    (sets trang_thai='An', which the public GET /api/jobs listing already
    excludes since it only shows 'Da_duyet')."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT job_id FROM job_reports WHERE id = %s", (report_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo")
            job_id = row[0]

            cur.execute(
                "UPDATE job_reports SET status = 'Da_xu_ly', resolved_at = NOW() WHERE id = %s",
                (report_id,),
            )
            if request.hide_job:
                cur.execute("UPDATE job_listings SET trang_thai = 'An' WHERE id = %s", (job_id,))

            conn.commit()
            cur.close()
        return {"status": "success", "message": "Đã xử lý báo cáo" + (" và ẩn tin" if request.hide_job else "")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resolve job report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}")
async def get_job(job_id: int):
    """Get a single job posting by ID."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT j.id, j.business_id, j.ten_doanh_nghiep, j.tieu_de, j.url,
                       j.dia_diem, j.ky_nang, j.phuc_loi, j.nguon, j.created_at,
                       j.ai_industry, j.mo_ta_cong_viec, j.hinh_thuc_lam_viec,
                       j.kinh_nghiem_thang, j.ngay_dang, j.han_nop,
                       b.logo_url, b.nganh_nghe
                FROM job_listings j
                LEFT JOIN businesses_demo b ON b.id = j.business_id
                WHERE j.id = %s;
                """,
                (job_id,),
            )
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Job not found")

            return {
                "status": "success",
                "data": {
                    "id": r["id"],
                    "business_id": r["business_id"],
                    "company_name": r["ten_doanh_nghiep"],
                    "title": r["tieu_de"],
                    "url": r["url"],
                    "location": r["dia_diem"],
                    "skills": r["ky_nang"],
                    "benefits": r["phuc_loi"],
                    "source": r["nguon"],
                    "industry": r["nganh_nghe"] or r["ai_industry"],
                    "logo_url": r["logo_url"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "description": r["mo_ta_cong_viec"],
                    "employment_type": r["hinh_thuc_lam_viec"],
                    "months_of_experience": r["kinh_nghiem_thang"],
                    "date_posted": r["ngay_dang"].isoformat() if r["ngay_dang"] else None,
                    "deadline": r["han_nop"].isoformat() if r["han_nop"] else None,
                },
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
