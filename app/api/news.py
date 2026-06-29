"""
News API Routes
Endpoints for news management
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import psycopg2
from app.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("")
async def get_all_news(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    category: Optional[str] = None,
    source: Optional[str] = None,
    region: Optional[str] = None
):
    """
    Get all news with pagination and filters
    
    - **page**: Page number (starts from 1)
    - **page_size**: Number of items per page (max 1000)
    - **category**: Filter by category (optional)
    - **source**: Filter by news source (optional)
    - **region**: Filter by region (optional)
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        # Build WHERE clause
        conditions = []
        params = []
        
        if category:
            conditions.append("chuyen_muc ILIKE %s")
            params.append(f"%{category}%")
        
        if source:
            conditions.append("nha_dai ILIKE %s")
            params.append(f"%{source}%")
        
        if region:
            conditions.append("vung_mien ILIKE %s")
            params.append(f"%{region}%")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # Get total count
        cur.execute(f"SELECT COUNT(*) FROM station_news {where_clause};", params)
        total = cur.fetchone()[0]
        
        # Get paginated data
        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        
        query = f"""
            SELECT id, tieu_de, tom_tat, nha_dai, vung_mien, chuyen_muc,
                   created_at, url, anh_dai_dien, thoi_gian_dang, tu_khoa,
                   do_tin_cay, trang_thai
            FROM station_news
            {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s;
        """
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        cur.close()
        conn.close()
        
        news_list = []
        for r in rows:
            news_list.append({
                "id": r[0],
                "title": r[1],
                "summary": r[2],
                "source": r[3],
                "region": r[4],
                "category": r[5],
                "created_at": r[6].isoformat() if r[6] else None,
                "url": r[7],
                "image": r[8],
                "published_at": r[9].isoformat() if r[9] else None,
                "keywords": r[10] if r[10] else [],
                "trust_score": r[11],
                "status": r[12]
            })
        
        return {
            "status": "success",
            "data": news_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        logger.error(f"Get news error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_news(
    q: str = Query("", description="Search query"),
    category: str = Query("", description="Filter by category"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100)
):
    """
    Search news by title or summary
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        conditions = []
        params = []
        
        if q:
            conditions.append("(tieu_de ILIKE %s OR tom_tat ILIKE %s)")
            params.extend([f"%{q}%", f"%{q}%"])
        
        if category:
            conditions.append("chuyen_muc ILIKE %s")
            params.append(f"%{category}%")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # Get total
        cur.execute(f"SELECT COUNT(*) FROM station_news {where_clause};", params)
        total = cur.fetchone()[0]
        
        # Get data
        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        
        query = f"""
            SELECT id, tieu_de, tom_tat, nha_dai, vung_mien, chuyen_muc, created_at
            FROM station_news
            {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s;
        """
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        cur.close()
        conn.close()
        
        news_list = [
            {
                "id": r[0],
                "title": r[1],
                "summary": r[2],
                "source": r[3],
                "region": r[4],
                "category": r[5],
                "created_at": r[6].isoformat() if r[6] else None
            }
            for r in rows
        ]
        
        return {
            "status": "success",
            "data": news_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        logger.error(f"Search news error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{news_id}")
async def get_news(news_id: int):
    """Get single news by ID"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, tieu_de, tom_tat, nha_dai, vung_mien, chuyen_muc,
                   created_at, url, anh_dai_dien, thoi_gian_dang, tu_khoa,
                   noi_dung_gon, do_tin_cay, trang_thai, thuc_the
            FROM station_news
            WHERE id = %s;
        """, (news_id,))
        
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="News not found")
        
        return {
            "status": "success",
            "data": {
                "id": row[0],
                "title": row[1],
                "summary": row[2],
                "source": row[3],
                "region": row[4],
                "category": row[5],
                "created_at": row[6].isoformat() if row[6] else None,
                "url": row[7],
                "image": row[8],
                "published_at": row[9].isoformat() if row[9] else None,
                "keywords": row[10] if row[10] else [],
                "content": row[11],
                "trust_score": row[12],
                "status": row[13],
                "entities": row[14] if row[14] else []
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get news error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for news API"""
    return {"status": "healthy", "service": "news"}
