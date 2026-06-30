"""
News API Routes
Endpoints for news management
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import settings
from app.database import get_db_connection
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
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)

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

            cur.execute(f"SELECT COUNT(*) FROM station_news {where_clause};", params)
            total = cur.fetchone()['count']

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
        
        news_list = []
        for r in rows:
            news_list.append({
                "id": r['id'],
                "title": r['tieu_de'],
                "summary": r['tom_tat'],
                "source": r['nha_dai'],
                "region": r['vung_mien'],
                "category": r['chuyen_muc'],
                "created_at": r['created_at'].isoformat() if r['created_at'] else None,
                "url": r['url'],
                "image": r['anh_dai_dien'],
                "published_at": r['thoi_gian_dang'].isoformat() if r['thoi_gian_dang'] else None,
                "keywords": r['tu_khoa'] if r['tu_khoa'] else [],
                "trust_score": r['do_tin_cay'],
                "status": r['trang_thai']
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

        cur.execute(f"SELECT COUNT(*) FROM station_news {where_clause};", params)
        total = cur.fetchone()[0]

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


@router.put("/{news_id}")
async def update_news(news_id: int, news_data: dict):
    """Update news by ID"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        update_fields = []
        params = []
        
        if 'tieu_de' in news_data:
            update_fields.append("tieu_de = %s")
            params.append(news_data['tieu_de'])
        if 'tom_tat' in news_data:
            update_fields.append("tom_tat = %s")
            params.append(news_data['tom_tat'])
        if 'chuyen_muc' in news_data:
            update_fields.append("chuyen_muc = %s")
            params.append(news_data['chuyen_muc'])
        if 'nha_dai' in news_data:
            update_fields.append("nha_dai = %s")
            params.append(news_data['nha_dai'])
        if 'vung_mien' in news_data:
            update_fields.append("vung_mien = %s")
            params.append(news_data['vung_mien'])
        if 'url' in news_data:
            update_fields.append("url = %s")
            params.append(news_data['url'])
        if 'anh_dai_dien' in news_data:
            update_fields.append("anh_dai_dien = %s")
            params.append(news_data['anh_dai_dien'])
        if 'do_tin_cay' in news_data:
            update_fields.append("do_tin_cay = %s")
            params.append(news_data['do_tin_cay'])
        if 'trang_thai' in news_data:
            update_fields.append("trang_thai = %s")
            params.append(news_data['trang_thai'])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.append(news_id)
        query = f"""
            UPDATE station_news 
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id;
        """
        
        cur.execute(query, params)
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="News not found")
        
        return {"status": "success", "message": "News updated", "id": result[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update news error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{news_id}")
async def delete_news(news_id: int):
    """Delete news by ID"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        cur.execute("DELETE FROM station_news WHERE id = %s RETURNING id;", (news_id,))
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="News not found")
        
        return {"status": "success", "message": "News deleted", "id": result[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete news error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
