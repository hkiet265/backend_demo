from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from app.database import get_db_connection
from app.dependencies import get_current_user
import logging

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])
logger = logging.getLogger(__name__)


class BookmarkNewsRequest(BaseModel):
    news_id: int
    note: Optional[str] = None


class BookmarkBusinessRequest(BaseModel):
    business_id: int
    note: Optional[str] = None


@router.post("/news")
async def bookmark_news(
    request: BookmarkNewsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Bookmark a news article"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO user_bookmarks_news (user_id, news_id, note)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, news_id) DO NOTHING
                RETURNING id
            """, (current_user['id'], request.news_id, request.note))
            
            result = cur.fetchone()
            conn.commit()
            cur.close()
        
        if result:
            return {"status": "success", "message": "Đã thêm vào yêu thích"}
        else:
            return {"status": "info", "message": "Tin tức đã có trong danh sách yêu thích"}
            
    except Exception as e:
        logger.error(f"Error bookmarking news: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/news/{news_id}")
async def unbookmark_news(
    news_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove news bookmark"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                DELETE FROM user_bookmarks_news
                WHERE user_id = %s AND news_id = %s
                RETURNING id
            """, (current_user['id'], news_id))
            
            result = cur.fetchone()
            conn.commit()
            cur.close()
        
        if result:
            return {"status": "success", "message": "Đã xóa khỏi yêu thích"}
        else:
            raise HTTPException(status_code=404, detail="Bookmark not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news")
async def get_bookmarked_news(
    current_user: dict = Depends(get_current_user)
):
    """Get all bookmarked news for current user"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT 
                    n.*,
                    b.note,
                    b.created_at as bookmarked_at
                FROM user_bookmarks_news b
                JOIN station_news n ON b.news_id = n.id
                WHERE b.user_id = %s
                ORDER BY b.created_at DESC
            """, (current_user['id'],))
            
            bookmarks = cur.fetchall()
            cur.close()
        
        return bookmarks
        
    except Exception as e:
        logger.error(f"Error fetching bookmarked news: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/check/{news_id}")
async def check_news_bookmarked(
    news_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Check if a news article is bookmarked"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT id FROM user_bookmarks_news
                WHERE user_id = %s AND news_id = %s
            """, (current_user['id'], news_id))
            
            result = cur.fetchone()
            cur.close()
        
        return {"bookmarked": result is not None}
        
    except Exception as e:
        logger.error(f"Error checking bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/businesses")
async def bookmark_business(
    request: BookmarkBusinessRequest,
    current_user: dict = Depends(get_current_user)
):
    """Bookmark a business"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO user_bookmarks_businesses (user_id, business_id, note)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, business_id) DO NOTHING
                RETURNING id
            """, (current_user['id'], request.business_id, request.note))
            
            result = cur.fetchone()
            conn.commit()
            cur.close()
        
        if result:
            return {"status": "success", "message": "Đã thêm vào yêu thích"}
        else:
            return {"status": "info", "message": "Doanh nghiệp đã có trong danh sách yêu thích"}
            
    except Exception as e:
        logger.error(f"Error bookmarking business: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/businesses/{business_id}")
async def unbookmark_business(
    business_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove business bookmark"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                DELETE FROM user_bookmarks_businesses
                WHERE user_id = %s AND business_id = %s
                RETURNING id
            """, (current_user['id'], business_id))
            
            result = cur.fetchone()
            conn.commit()
            cur.close()
        
        if result:
            return {"status": "success", "message": "Đã xóa khỏi yêu thích"}
        else:
            raise HTTPException(status_code=404, detail="Bookmark not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/businesses")
async def get_bookmarked_businesses(
    current_user: dict = Depends(get_current_user)
):
    """Get all bookmarked businesses for current user"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT 
                    bus.*,
                    b.note,
                    b.created_at as bookmarked_at
                FROM user_bookmarks_businesses b
                JOIN businesses_demo bus ON b.business_id = bus.id
                WHERE b.user_id = %s
                ORDER BY b.created_at DESC
            """, (current_user['id'],))
            
            bookmarks = cur.fetchall()
            cur.close()
        
        return bookmarks
        
    except Exception as e:
        logger.error(f"Error fetching bookmarked businesses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/businesses/check/{business_id}")
async def check_business_bookmarked(
    business_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Check if a business is bookmarked"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT id FROM user_bookmarks_businesses
                WHERE user_id = %s AND business_id = %s
            """, (current_user['id'], business_id))
            
            result = cur.fetchone()
            cur.close()
        
        return {"bookmarked": result is not None}
        
    except Exception as e:
        logger.error(f"Error checking bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_bookmark_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get bookmark statistics for current user"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT COUNT(*) FROM user_bookmarks_news WHERE user_id = %s
            """, (current_user['id'],))
            news_count = cur.fetchone()[0]
            
            cur.execute("""
                SELECT COUNT(*) FROM user_bookmarks_businesses WHERE user_id = %s
            """, (current_user['id'],))
            business_count = cur.fetchone()[0]
            
            cur.close()
        
        return {
            "status": "success",
            "data": {
                "news_count": news_count,
                "business_count": business_count,
                "total": news_count + business_count
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
