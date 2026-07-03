"""
Main FastAPI Application
Clean, professional entry point with proper configuration
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
from slowapi.errors import RateLimitExceeded
import logfire

from app.config import settings
from app.api import chat, business, news, auth, crawler, admin, bookmarks, enrichment, ux_features, notifications, secure_csv_import
from app.middleware import limiter, rate_limit_exceeded_handler
from app.database import init_db_pool, close_db_pool
 
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
 
scheduler = None
 
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="RAG-powered news chatbot with vector search",
    docs_url="/docs",
    redoc_url="/redoc"
)
 
try:
    if settings.LOGFIRE_TOKEN:
        logfire.configure(token=settings.LOGFIRE_TOKEN)
        
        logger.info("🔥 Logfire monitoring enabled (instrumentation disabled)")
        logger.info(f"🔗 Logfire project: https://logfire-us.pydantic.dev/kiethk/emtu")
    else:
        logger.info("💡 Logfire not configured (set LOGFIRE_TOKEN to enable)")
except Exception as e:
    logger.warning(f"⚠️ Logfire initialization failed: {e}")
    logger.info("💡 App will continue without Logfire monitoring")
 
app.state.limiter = limiter
 
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
 
app.include_router(chat.router)
app.include_router(business.router)
app.include_router(news.router)
app.include_router(auth.router)
app.include_router(crawler.router)
app.include_router(admin.router)
app.include_router(bookmarks.router)
app.include_router(enrichment.router)
app.include_router(ux_features.router)
app.include_router(notifications.router)
app.include_router(secure_csv_import.router)
 
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "rag_enabled": True
    }
 
@app.get("/health")
async def health():
    """Health check endpoint"""
    scheduler_status = "running" if scheduler and scheduler.running else "stopped"
    next_run = None
    
    if scheduler and scheduler.running:
        jobs = scheduler.get_jobs()
        if jobs:
            job = jobs[0]
            next_run = job.next_run_time.isoformat() if job.next_run_time else None
    
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "auto_crawler": {
            "status": scheduler_status,
            "next_run": next_run,
            "interval": "30 minutes"
        }
    }
 
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Global error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An error occurred"
        }
    )
 
@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    global scheduler
    
    logger.info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting up...")
    
    try:
        init_db_pool(settings.database_url, minconn=5, maxconn=20)
        logger.info("✅ Database connection pool initialized (5-20 connections)")
    except Exception as e:
        logger.error(f"❌ Failed to initialize database pool: {e}")
        raise
    
    logger.info(f"📊 RAG enabled with {settings.RAG_TOP_K} top results")
    logger.info(f"🔍 Embedding model: {settings.EMBEDDING_MODEL}")
    logger.info(f"💬 Chat model: {settings.CHAT_MODEL}")

    try:
        scheduler = BackgroundScheduler(timezone="Asia/Ho_Chi_Minh")

        scheduler.add_job(
            func=auto_crawl_news,
            trigger=IntervalTrigger(minutes=30),
            id='news_crawler',
            name='Auto News Crawler',
            replace_existing=True,
            next_run_time=datetime.now()
        )
        
        scheduler.start()
        logger.info("✅ Auto-crawling enabled: News every 30 minutes")
        
    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {e}")
 
@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    global scheduler
    
    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("⏹️ Scheduler stopped")
    
    close_db_pool()
    logger.info(f"👋 {settings.APP_NAME} shutting down...")


def auto_crawl_news():
    """
    Background job: Auto-crawl news from RSS feeds
    Chạy định kỳ, miễn phí, KHÔNG tốn token AI
    """
    try:
        logger.info("🤖 [AUTO-CRAWL] Starting news crawl...")
        
        from app.services.news_crawler_service import get_crawler_service
        crawler_service = get_crawler_service()
        
        result = crawler_service.crawl_all_sources()
        
        logger.info(
            f"✅ [AUTO-CRAWL] Completed - "
            f"Found: {result['total_found']}, "
            f"Inserted: {result['total_inserted']}, "
            f"Skipped: {result['total_skipped']}"
        )
        
        if result['errors']:
            logger.warning(f"⚠️ [AUTO-CRAWL] Errors: {result['errors'][:3]}")
        
    except Exception as e:
        logger.error(f"❌ [AUTO-CRAWL] Failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )
