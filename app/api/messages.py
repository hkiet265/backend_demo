"""
Live Chat API Routes
Phase 4: direct messaging between an employer and a candidate, scoped to
one job application (job_id + candidate_user_id) so there's always context
for what the conversation is about.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor

from app.database import get_db_connection
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/messages", tags=["messages"])


class SendMessageRequest(BaseModel):
    content: str


def _require_thread_participant(cur, job_id: int, candidate_user_id: int, user_id: int) -> int:
    """A message thread is scoped to (job_id, candidate_user_id). Only the
    candidate themselves or the employer who posted that job may read/send
    in it. Returns the job's created_by_user_id (the employer)."""
    cur.execute("SELECT created_by_user_id FROM job_listings WHERE id = %s", (job_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng")
    employer_id = row[0]
    if user_id != candidate_user_id and user_id != employer_id:
        raise HTTPException(status_code=403, detail="Bạn không thuộc cuộc trò chuyện này")
    return employer_id


@router.get("/jobs/{job_id}/candidates/{candidate_user_id}")
async def get_thread(job_id: int, candidate_user_id: int, current_user: dict = Depends(get_current_user)):
    """Full message history for one (job, candidate) thread. Marks messages
    addressed to the current user as read."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            _require_thread_participant(cur, job_id, candidate_user_id, current_user["id"])

            cur.execute(
                "UPDATE job_messages SET read_at = NOW() "
                "WHERE job_id = %s AND candidate_user_id = %s AND sender_id != %s AND read_at IS NULL",
                (job_id, candidate_user_id, current_user["id"]),
            )
            conn.commit()
            cur.close()

            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT m.id, m.sender_id, m.content, m.created_at, m.read_at,
                       u.full_name as sender_name
                FROM job_messages m
                JOIN app_users u ON u.id = m.sender_id
                WHERE m.job_id = %s AND m.candidate_user_id = %s
                ORDER BY m.created_at ASC;
                """,
                (job_id, candidate_user_id),
            )
            messages = cur.fetchall()
        return {"status": "success", "data": messages}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get thread error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_id}/candidates/{candidate_user_id}")
async def send_message(
    job_id: int, candidate_user_id: int, request: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Nội dung tin nhắn không được để trống")
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            _require_thread_participant(cur, job_id, candidate_user_id, current_user["id"])

            cur.execute(
                """
                INSERT INTO job_messages (job_id, candidate_user_id, sender_id, content)
                VALUES (%s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (job_id, candidate_user_id, current_user["id"], request.content.strip()),
            )
            new_id, created_at = cur.fetchone()
            conn.commit()
            cur.close()
        return {"status": "success", "id": new_id, "created_at": created_at.isoformat()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """All conversation threads the current user is part of — either as
    the candidate, or as the employer across all jobs they posted. Ordered
    by most recent activity, with an unread count for the badge."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                SELECT DISTINCT ON (m.job_id, m.candidate_user_id)
                       m.job_id, m.candidate_user_id, j.tieu_de, j.ten_doanh_nghiep,
                       j.created_by_user_id as employer_id,
                       candidate.full_name as candidate_name,
                       employer.full_name as employer_name,
                       m.content as last_message, m.created_at as last_message_at,
                       (
                           SELECT COUNT(*) FROM job_messages um
                           WHERE um.job_id = m.job_id AND um.candidate_user_id = m.candidate_user_id
                             AND um.sender_id != %(uid)s AND um.read_at IS NULL
                       ) as unread_count
                FROM job_messages m
                JOIN job_listings j ON j.id = m.job_id
                JOIN app_users candidate ON candidate.id = m.candidate_user_id
                LEFT JOIN app_users employer ON employer.id = j.created_by_user_id
                WHERE m.candidate_user_id = %(uid)s OR j.created_by_user_id = %(uid)s
                ORDER BY m.job_id, m.candidate_user_id, m.created_at DESC;
                """,
                {"uid": current_user["id"]},
            )
            conversations = cur.fetchall()
            conversations.sort(key=lambda c: c["last_message_at"], reverse=True)
        return {"status": "success", "data": conversations}
    except Exception as e:
        logger.error(f"Get conversations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
