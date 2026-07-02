"""
AI Enrichment API Routes
Endpoints for AI-powered data enrichment
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
import logging
from app.dependencies import get_current_user
from app.services.website_scraper_service import get_scraper_service
from app.services.lead_scoring_service import get_scoring_service
from app.services.ner_service import get_ner_service
from app.services.news_clustering_service import get_clustering_service
from app.database import get_db_connection
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])


@router.post("/scrape-website")
async def scrape_website(
    url: str = Query(..., description="Website URL to scrape"),
    current_user: dict = Depends(get_current_user)
):
    """
    Thu thập thông tin từ website doanh nghiệp
    
    Returns:
    - title: Website title
    - description: Meta description
    - emails: List of emails found
    - phones: List of phones found
    - facebook, zalo, linkedin: Social links
    """
    try:
        scraper = get_scraper_service()
        result = scraper.scrape_website(url)
        
        return {
            "status": "success" if result['success'] else "error",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Scrape website error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enrich-business/{business_id}")
async def enrich_business_from_website(
    business_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Làm giàu thông tin doanh nghiệp từ website
    Tự động scrape và cập nhật vào DB
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Lấy business
            cur.execute("""
                SELECT id, website, email, so_dien_thoai, facebook, linkedin
                FROM businesses_demo
                WHERE id = %s;
            """, (business_id,))
            
            business = cur.fetchone()
            
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
            
            if not business['website']:
                raise HTTPException(status_code=400, detail="Business has no website")
            
            # Scrape website
            scraper = get_scraper_service()
            scraped = scraper.scrape_website(business['website'])
            
            if not scraped['success']:
                raise HTTPException(status_code=400, detail=f"Scrape failed: {scraped.get('error')}")
            
            # Update fields nếu chưa có
            updates = []
            params = []
            
            if scraped.get('emails') and not business['email']:
                updates.append("email = %s")
                params.append(scraped['emails'][0])
            
            if scraped.get('phones') and not business['so_dien_thoai']:
                updates.append("so_dien_thoai = %s")
                params.append(scraped['phones'][0])
            
            if scraped.get('facebook') and not business['facebook']:
                updates.append("facebook = %s")
                params.append(scraped['facebook'])
            
            if scraped.get('linkedin') and not business['linkedin']:
                updates.append("linkedin = %s")
                params.append(scraped['linkedin'])
            
            if updates:
                params.append(business_id)
                query = f"""
                    UPDATE businesses_demo
                    SET {', '.join(updates)}, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id;
                """
                cur.execute(query, params)
                conn.commit()
            
            cur.close()
            
            return {
                "status": "success",
                "message": f"Enriched {len(updates)} fields",
                "scraped_data": scraped
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrich business error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lead-score/{business_id}")
async def get_business_lead_score(
    business_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Tính lead score cho 1 doanh nghiệp
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT * FROM businesses_demo WHERE id = %s;
            """, (business_id,))
            
            business = cur.fetchone()
            cur.close()
            
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
            
            # Tính lead score
            scoring_service = get_scoring_service()
            score_info = scoring_service.calculate_lead_score(dict(business))
            
            return {
                "status": "success",
                "business_id": business_id,
                "business_name": business['ten_doanh_nghiep'],
                "lead_score": score_info
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lead score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rank-businesses")
async def rank_businesses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    min_score: int = Query(0, ge=0, le=100, description="Minimum lead score"),
    current_user: dict = Depends(get_current_user)
):
    """
    Xếp hạng doanh nghiệp theo lead score
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Lấy tất cả businesses
            cur.execute("""
                SELECT * FROM businesses_demo
                ORDER BY updated_at DESC;
            """)
            
            businesses = cur.fetchall()
            cur.close()
            
            # Rank businesses
            scoring_service = get_scoring_service()
            businesses_list = [dict(b) for b in businesses]
            
            if min_score > 0:
                ranked = scoring_service.filter_by_score(businesses_list, min_score)
            else:
                ranked = scoring_service.rank_businesses(businesses_list)
            
            # Pagination
            total = len(ranked)
            start = (page - 1) * page_size
            end = start + page_size
            page_data = ranked[start:end]
            
            return {
                "status": "success",
                "data": page_data,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
        
    except Exception as e:
        logger.error(f"Rank businesses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-entities")
async def extract_news_entities(
    news_id: int = Query(..., description="News ID"),
    use_ai: bool = Query(False, description="Use AI for better extraction"),
    current_user: dict = Depends(get_current_user)
):
    """
    Trích xuất thực thể từ tin tức
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT id, tieu_de, tom_tat, noi_dung_gon
                FROM station_news
                WHERE id = %s;
            """, (news_id,))
            
            news = cur.fetchone()
            
            if not news:
                raise HTTPException(status_code=404, detail="News not found")
            
            # Extract entities
            ner_service = get_ner_service()
            
            content = ""
            if news['tieu_de']:
                content += news['tieu_de'] + ". "
            if news['tom_tat']:
                content += news['tom_tat'] + ". "
            if news['noi_dung_gon']:
                content += news['noi_dung_gon']
            
            entities = ner_service.extract_entities(content, use_ai=use_ai)
            
            # Update DB
            cur.execute("""
                UPDATE station_news
                SET thuc_the = %s
                WHERE id = %s;
            """, (str(entities), news_id))
            
            conn.commit()
            cur.close()
            
            return {
                "status": "success",
                "news_id": news_id,
                "entities": entities
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extract entities error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cluster-news")
async def cluster_similar_news(
    time_window_hours: int = Query(48, ge=1, le=168, description="Time window in hours"),
    similarity_threshold: float = Query(0.7, ge=0.5, le=1.0, description="Similarity threshold"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """
    Gom cụm tin tức tương tự
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Lấy tin tức gần đây
            cur.execute("""
                SELECT id, tieu_de, tom_tat, nha_dai, vung_mien, chuyen_muc,
                       created_at, thoi_gian_dang, url
                FROM station_news
                ORDER BY created_at DESC
                LIMIT 500;
            """)
            
            news_list = [dict(row) for row in cur.fetchall()]
            cur.close()
            
            # Cluster
            clustering_service = get_clustering_service()
            clustering_service.similarity_threshold = similarity_threshold
            clustering_service.time_window_hours = time_window_hours
            
            duplicate_clusters = clustering_service.get_duplicate_clusters(news_list)
            
            # Tạo summaries
            cluster_summaries = []
            for cluster in duplicate_clusters:
                summary = clustering_service.create_cluster_summary(cluster)
                cluster_summaries.append(summary)
            
            # Pagination
            total = len(cluster_summaries)
            start = (page - 1) * page_size
            end = start + page_size
            page_data = cluster_summaries[start:end]
            
            # Stats
            stats = clustering_service.get_clustering_stats(news_list)
            
            return {
                "status": "success",
                "data": page_data,
                "stats": stats,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
        
    except Exception as e:
        logger.error(f"Cluster news error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/find-similar-news/{news_id}")
async def find_similar_news(
    news_id: int,
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Tìm tin tức tương tự với 1 tin cụ thể
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Lấy tin mục tiêu
            cur.execute("""
                SELECT id, tieu_de, tom_tat, nha_dai, chuyen_muc, thoi_gian_dang
                FROM station_news
                WHERE id = %s;
            """, (news_id,))
            
            target_news = cur.fetchone()
            
            if not target_news:
                raise HTTPException(status_code=404, detail="News not found")
            
            # Lấy tin khác cùng category trong 7 ngày
            cur.execute("""
                SELECT id, tieu_de, tom_tat, nha_dai, chuyen_muc, thoi_gian_dang, url
                FROM station_news
                WHERE id != %s
                  AND chuyen_muc = %s
                  AND thoi_gian_dang >= NOW() - INTERVAL '7 days'
                ORDER BY thoi_gian_dang DESC
                LIMIT 100;
            """, (news_id, target_news['chuyen_muc']))
            
            candidate_news = [dict(row) for row in cur.fetchall()]
            cur.close()
            
            # Find similar
            clustering_service = get_clustering_service()
            similar_news = clustering_service.find_similar_news(
                dict(target_news),
                candidate_news
            )
            
            # Giới hạn kết quả
            similar_news = similar_news[:limit]
            
            return {
                "status": "success",
                "target_news_id": news_id,
                "target_title": target_news['tieu_de'],
                "similar_news": similar_news,
                "count": len(similar_news)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Find similar news error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for enrichment API"""
    return {
        "status": "healthy",
        "service": "enrichment",
        "features": [
            "website_scraper",
            "lead_scoring",
            "ner",
            "news_clustering"
        ]
    }
