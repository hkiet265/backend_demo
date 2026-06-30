"""
Admin API Routes
Dashboard metrics and statistics for admins
"""
from fastapi import APIRouter, HTTPException, Request
from app.middleware.rate_limiter import limiter, GENERAL_RATE_LIMIT
import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import settings
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
@limiter.limit(GENERAL_RATE_LIMIT)
async def get_admin_stats(request: Request):
    """
    Get admin dashboard statistics
    
    Returns:
    - Total news, businesses, users
    - Recent activity
    - System health
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT COUNT(*) as total FROM station_news")
        total_news = cur.fetchone()['total']
        
        cur.execute("SELECT COUNT(*) as total FROM businesses_demo")
        total_businesses = cur.fetchone()['total']
        
        cur.execute("SELECT COUNT(*) as total FROM app_users")
        total_users = cur.fetchone()['total']
        
        cur.execute("""
            SELECT nha_dai, COUNT(*) as count 
            FROM station_news 
            GROUP BY nha_dai 
            ORDER BY count DESC 
            LIMIT 10
        """)
        news_by_source = cur.fetchall()
        
        cur.execute("""
            SELECT vung_mien, COUNT(*) as count 
            FROM station_news 
            GROUP BY vung_mien 
            ORDER BY count DESC
        """)
        news_by_region = cur.fetchall()
        
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM station_news 
            WHERE created_at >= DATE_TRUNC('day', NOW())
        """)
        news_today = cur.fetchone()['count']
        
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM app_users 
            WHERE created_at >= NOW() - INTERVAL '7 days'
        """)
        new_users_week = cur.fetchone()['count']
        
        cur.execute("""
            SELECT tieu_de, nha_dai, chuyen_muc, created_at 
            FROM station_news 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        latest_news = cur.fetchall()
        
        cur.execute("""
            SELECT vung_mien, COUNT(*) as count 
            FROM businesses_demo 
            GROUP BY vung_mien 
            ORDER BY count DESC
        """)
        businesses_by_region = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "data": {
                "overview": {
                    "total_news": total_news,
                    "total_businesses": total_businesses,
                    "total_users": total_users,
                    "news_today": news_today,
                    "new_users_week": new_users_week
                },
                "news_stats": {
                    "by_source": news_by_source,
                    "by_region": news_by_region
                },
                "business_stats": {
                    "by_region": businesses_by_region
                },
                "latest_news": latest_news,
                "system": {
                    "app_version": settings.APP_VERSION,
                    "groq_enabled": settings.USE_GROQ_FOR_GENERATION,
                    "logfire_enabled": bool(settings.__dict__.get('LOGFIRE_TOKEN'))
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitoring")
@limiter.limit(GENERAL_RATE_LIMIT)
async def get_monitoring_stats(request: Request):
    """
    Get monitoring and performance statistics from Logfire (real-time)
    
    Returns:
    - Real API request logs from Logfire
    - Error tracking from Logfire
    - Performance metrics from Logfire
    - System health
    """
    try:
        from app.services.logfire_service import get_logfire_service
        
        logfire = get_logfire_service()
        
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as db_size
        """)
        db_info = cur.fetchone()
        
        cur.execute("""
            SELECT 
                'station_news' as table_name,
                pg_size_pretty(pg_total_relation_size('station_news')) as size
            UNION ALL
            SELECT 
                'businesses_demo',
                pg_size_pretty(pg_total_relation_size('businesses_demo'))
            UNION ALL
            SELECT 
                'app_users',
                pg_size_pretty(pg_total_relation_size('app_users'))
        """)
        table_sizes = cur.fetchall()
        
        cur.close()
        conn.close()
        
        if logfire.is_enabled():
            logger.info("📊 Fetching real-time metrics from Logfire...")
            api_metrics = await logfire.get_request_metrics(hours=24)
            recent_errors = await logfire.get_recent_errors(hours=24, limit=10)
            system_health = await logfire.get_system_health()
        else:
            logger.warning("⚠️ Logfire read token not configured, using fallback data")
            api_metrics = {
                "total_requests_today": 0,
                "avg_response_time_ms": 0,
                "error_rate": 0,
                "error_count": 0,
                "endpoints": []
            }
            recent_errors = [
                {
                    "timestamp": datetime.now().isoformat(),
                    "level": "WARNING",
                    "message": "Logfire read token not configured. Set LOGFIRE_READ_TOKEN in .env",
                    "endpoint": "Admin Dashboard"
                }
            ]
            system_health = {
                "database": "healthy",
                "groq": "healthy" if settings.USE_GROQ_FOR_GENERATION else "disabled",
                "crawler": "active",
                "uptime": "Unknown (Logfire not configured)"
            }
        
        return {
            "status": "success",
            "data": {
                "api_metrics": api_metrics,
                "database": {
                    "size": db_info['db_size'],
                    "tables": table_sizes
                },
                "recent_errors": recent_errors,
                "system_health": system_health,
                "logfire_enabled": logfire.is_enabled()
            }
        }
        
    except Exception as e:
        logger.error(f"Monitoring stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
@limiter.limit(GENERAL_RATE_LIMIT)
async def get_users(request: Request):
    """
    Get all registered users
    
    Returns:
    - List of users with id, email, full_name, role, created_at
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, email, full_name, phone, role, created_at
            FROM app_users
            ORDER BY created_at DESC
        """)
        users = cur.fetchall()
        
        cur.execute("""
            SELECT role, COUNT(*) as count
            FROM app_users
            GROUP BY role
        """)
        role_stats = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "data": {
                "users": users,
                "total": len(users),
                "role_stats": role_stats
            }
        }
        
    except Exception as e:
        logger.error(f"Get users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def admin_health():
    """Admin service health check"""
    return {
        "status": "healthy",
        "service": "admin",
        "timestamp": datetime.now().isoformat()
    }


@router.put("/users/{user_id}")
@limiter.limit(GENERAL_RATE_LIMIT)
async def update_user(user_id: int, request: Request):
    """
    Update user information
    
    Body:
    - full_name: string
    - phone: string (optional)
    - role: string (admin or user)
    """
    try:
        body = await request.json()
        
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            UPDATE app_users
            SET full_name = %s, phone = %s, role = %s
            WHERE id = %s
            RETURNING id, email, full_name, phone, role, created_at
        """, (
            body.get('full_name'),
            body.get('phone'),
            body.get('role'),
            user_id
        ))
        
        updated_user = cur.fetchone()
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "user": updated_user
        }
        
    except Exception as e:
        logger.error(f"Update user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}")
@limiter.limit(GENERAL_RATE_LIMIT)
async def delete_user(user_id: int, request: Request):
    """
    Delete a user
    
    Note: Cannot delete admin users for safety
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if user is admin
        cur.execute("SELECT role FROM app_users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user['role'] == 'admin':
            raise HTTPException(status_code=403, detail="Cannot delete admin users")
        
        cur.execute("DELETE FROM app_users WHERE id = %s", (user_id,))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "message": "User deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
