"""
Crawler API Routes
Endpoints để quản lý crawling tin tức với rate limiting
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import Optional
import logging
from app.services.news_crawler_service import get_crawler_service
from app.middleware.rate_limiter import limiter, CRAWLER_RATE_LIMIT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/crawler", tags=["crawler"])
crawler_service = get_crawler_service()


class CrawlResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None


@router.post("/start")
@limiter.limit(CRAWLER_RATE_LIMIT)  # 1 request/minute (prevent spam crawling)
async def start_crawling(request: Request, background_tasks: BackgroundTasks):
    """
    Bắt đầu crawl tin tức từ RSS feeds
    Chạy background để không block request
    """
    try:
        # Chạy crawling trong background
        background_tasks.add_task(crawler_service.crawl_all_sources)
        
        return CrawlResponse(
            status="success",
            message="Crawler đã được kích hoạt và đang chạy trong background"
        )
        
    except Exception as e:
        logger.error(f"Start crawling error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start-sync")
@limiter.limit(CRAWLER_RATE_LIMIT)  # 1 request/minute
async def start_crawling_sync(request: Request):
    """
    Crawl đồng bộ (chờ kết quả)
    Dùng để test hoặc chạy thủ công
    """
    try:
        result = crawler_service.crawl_all_sources()
        
        return CrawlResponse(
            status="success",
            message=f"Crawl hoàn tất: {result['total_inserted']} tin mới, {result['total_skipped']} tin trùng",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Crawl sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources")
async def get_crawler_sources():
    """Lấy danh sách các nguồn RSS đang crawl"""
    try:
        sources = []
        for source_name, rss_urls in crawler_service.RSS_SOURCES.items():
            sources.append({
                "name": source_name,
                "urls": rss_urls,
                "count": len(rss_urls)
            })
        
        return {
            "status": "success",
            "data": sources,
            "total_sources": len(sources),
            "total_feeds": sum(len(urls) for urls in crawler_service.RSS_SOURCES.values())
        }
        
    except Exception as e:
        logger.error(f"Get sources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_crawler_stats():
    """Thống kê tin tức đã crawl"""
    try:
        import psycopg2
        from app.config import settings
        
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        # Tổng tin từ RSS
        cur.execute("SELECT COUNT(*) FROM station_news WHERE nha_dai IN ('VTV', 'VTC', 'VOV');")
        total = cur.fetchone()[0]
        
        # Theo nhà đài
        cur.execute("""
            SELECT nha_dai, COUNT(*) as count 
            FROM station_news 
            WHERE nha_dai IN ('VTV', 'VTC', 'VOV')
            GROUP BY nha_dai
            ORDER BY count DESC;
        """)
        by_source = [{"source": row[0], "count": row[1]} for row in cur.fetchall()]
        
        # Theo vùng miền
        cur.execute("""
            SELECT vung_mien, COUNT(*) as count 
            FROM station_news 
            WHERE nha_dai IN ('VTV', 'VTC', 'VOV')
            GROUP BY vung_mien
            ORDER BY count DESC;
        """)
        by_region = [{"region": row[0], "count": row[1]} for row in cur.fetchall()]
        
        # Tin mới nhất
        cur.execute("""
            SELECT tieu_de, nha_dai, created_at 
            FROM station_news 
            WHERE nha_dai IN ('VTV', 'VTC', 'VOV')
            ORDER BY created_at DESC 
            LIMIT 5;
        """)
        latest = [
            {"title": row[0], "source": row[1], "created_at": str(row[2])} 
            for row in cur.fetchall()
        ]
        
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "data": {
                "total": total,
                "by_source": by_source,
                "by_region": by_region,
                "latest": latest
            }
        }
        
    except Exception as e:
        logger.error(f"Get stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check cho crawler service"""
    return {"status": "healthy", "service": "crawler"}
