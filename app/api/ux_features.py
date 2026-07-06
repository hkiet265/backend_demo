"""
UX Features API Routes
Endpoints for audit logs, alerts, and advanced search
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional
import logging
from app.dependencies import get_current_user
from app.services.audit_log_service import get_audit_service
from app.services.alert_system_service import get_alert_service
# from app.services.nlp_search_service import get_nlp_search_service  # REMOVED - duplicate với semantic
from app.services.notification_service import get_notification_service
from app.database import get_db_connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ux", tags=["ux-features"])


# ==================== AUDIT LOGS ====================

@router.get("/audit-logs")
async def get_audit_logs(
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy danh sách audit logs với filters
    
    Filters:
    - resource_type: BUSINESS, NEWS, USER, etc.
    - resource_id: ID của resource
    - user_id: ID người dùng
    - action: CREATE, UPDATE, DELETE, etc.
    
    Note: LOGIN/LOGOUT actions are excluded by default
    """
    try:
        audit_service = get_audit_service()
        
        with get_db_connection() as conn:
            offset = (page - 1) * page_size
            
            logs = await audit_service.get_audit_logs(
                conn,
                resource_type=resource_type,
                resource_id=resource_id,
                user_id=user_id,
                action=action,
                limit=page_size,
                offset=offset,
                exclude_actions=['LOGIN', 'LOGOUT']
            )
            
            return {
                "status": "success",
                "data": logs,
                "page": page,
                "page_size": page_size,
                "count": len(logs)
            }
        
    except Exception as e:
        logger.error(f"Get audit logs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit-logs/resource/{resource_type}/{resource_id}")
async def get_resource_history(
    resource_type: str,
    resource_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy lịch sử đầy đủ của một resource
    """
    try:
        audit_service = get_audit_service()
        
        with get_db_connection() as conn:
            history = await audit_service.get_resource_history(
                conn,
                resource_type=resource_type.upper(),
                resource_id=resource_id
            )
            
            return {
                "status": "success",
                "resource_type": resource_type,
                "resource_id": resource_id,
                "history": history,
                "count": len(history)
            }
        
    except Exception as e:
        logger.error(f"Get resource history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit-logs/user/{user_id}/activity")
async def get_user_activity(
    user_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy activity log của một user
    """
    try:
        # Check permission: user can only see their own activity, unless admin
        if current_user['id'] != user_id and current_user['role'] != 'admin':
            raise HTTPException(status_code=403, detail="Forbidden")
        
        audit_service = get_audit_service()
        
        with get_db_connection() as conn:
            activity = await audit_service.get_user_activity(
                conn,
                user_id=user_id,
                limit=limit
            )
            
            return {
                "status": "success",
                "user_id": user_id,
                "activity": activity,
                "count": len(activity)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user activity error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ALERTS ====================

@router.post("/alerts/detect")
async def detect_and_sync_alerts(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Detect and sync alerts to database
    Returns active alerts from alert_history table
    Also creates notifications for business owners
    """
    try:
        body = await request.json() if request.headers.get("content-type") == "application/json" else {}
        threshold_days = body.get("threshold_days", 180)
        
        alert_service = get_alert_service()
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            # Check and sync alerts (saves to database)
            all_alerts = alert_service.check_and_sync_alerts(conn)
            
            # Create notifications for business owners with alerts
            try:
                for alert in all_alerts:
                    # Get business owner
                    cur = conn.cursor()
                    cur.execute("""
                        SELECT user_id FROM businesses_demo WHERE id = %s
                    """, (alert.get('business_id'),))
                    owner = cur.fetchone()
                    cur.close()
                    
                    if owner and owner[0]:
                        notification_service.notify_alert(
                            conn,
                            user_id=owner[0],
                            alert_title=alert.get('title', '⚠️ Cảnh báo'),
                            alert_message=alert.get('message', 'Có vấn đề cần xử lý'),
                            severity=alert.get('severity', 'medium'),
                            business_id=alert.get('business_id')
                        )
                
                logger.info(f"Created notifications for {len(all_alerts)} alerts")
            except Exception as notif_error:
                logger.error(f"Failed to create alert notifications: {notif_error}")
            
            # Get stats
            stats = alert_service.get_alert_stats(conn)
            
            return {
                "status": "success",
                "alerts": all_alerts,
                "total_alerts": len(all_alerts),
                "critical_high_count": stats.get('critical_high_count', 0),
                "stats": stats
            }
        
    except Exception as e:
        logger.error(f"Detect alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/active")
async def get_active_alerts(
    business_ids: Optional[str] = Query(None, description="Comma-separated business IDs"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get active alerts from database
    Optionally filter by business_ids
    """
    try:
        alert_service = get_alert_service()
        
        # Parse business_ids if provided
        biz_ids = None
        if business_ids:
            biz_ids = [int(id.strip()) for id in business_ids.split(',')]
        
        with get_db_connection() as conn:
            alerts = alert_service.get_active_alerts(conn, business_ids=biz_ids)
            
            return {
                "status": "success",
                "alerts": alerts,
                "count": len(alerts)
            }
        
    except Exception as e:
        logger.error(f"Get active alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/cleanup")
async def cleanup_old_alerts(
    current_user: dict = Depends(get_current_user)
):
    """
    Cleanup old resolved alerts (older than 15 days)
    Admin only
    """
    try:
        # Check admin permission
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin only")
        
        alert_service = get_alert_service()
        
        with get_db_connection() as conn:
            deleted_count = alert_service.cleanup_old_alerts(conn)
            
            return {
                "status": "success",
                "deleted_count": deleted_count,
                "message": f"Cleaned up {deleted_count} old resolved alerts"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/summary")
async def get_alerts_summary(
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy tóm tắt tất cả alerts
    """
    try:
        alert_service = get_alert_service()
        
        with get_db_connection() as conn:
            summary = alert_service.get_alert_summary(conn)
            
            return {
                "status": "success",
                "summary": summary
            }
        
    except Exception as e:
        logger.error(f"Get alerts summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/all")
async def get_all_alerts(
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy tất cả alerts chi tiết
    """
    try:
        alert_service = get_alert_service()
        
        with get_db_connection() as conn:
            alerts = alert_service.get_all_alerts(conn)
            
            # Count totals
            total = sum(len(alerts_list) for alerts_list in alerts.values())
            
            return {
                "status": "success",
                "alerts": alerts,
                "total": total
            }
        
    except Exception as e:
        logger.error(f"Get all alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/outdated")
async def get_outdated_data_alerts(
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy alerts về dữ liệu cũ (outdated)
    """
    try:
        alert_service = get_alert_service()
        
        with get_db_connection() as conn:
            alerts = alert_service.check_outdated_businesses(conn)
            
            return {
                "status": "success",
                "alerts": alerts,
                "count": len(alerts)
            }
        
    except Exception as e:
        logger.error(f"Get outdated alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/missing-fields")
async def get_missing_fields_alerts(
    resource_type: str = Query("business", description="Resource type to check"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy alerts về dữ liệu thiếu field
    """
    try:
        alert_service = get_alert_service()
        
        with get_db_connection() as conn:
            alerts = alert_service.check_missing_fields(conn, resource_type)
            
            return {
                "status": "success",
                "alerts": alerts,
                "count": len(alerts)
            }
        
    except Exception as e:
        logger.error(f"Get missing fields alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/invalid-data")
async def get_invalid_data_alerts(
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy alerts về dữ liệu không hợp lệ
    """
    try:
        alert_service = get_alert_service()
        
        with get_db_connection() as conn:
            alerts = alert_service.check_invalid_data(conn)
            
            return {
                "status": "success",
                "alerts": alerts,
                "count": len(alerts)
            }
        
    except Exception as e:
        logger.error(f"Get invalid data alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== NLP SEARCH ====================
# DISABLED - Use /api/chat/message with hybrid service instead

@router.get("/search/nlp")
async def nlp_search(
    q: str = Query(..., description="Natural language query"),
    use_semantic: bool = Query(True, description="Use semantic search"),
    current_user: dict = Depends(get_current_user)
):
    """
    Advanced NLP-powered search
    
    DEPRECATED: Use /api/chat/message for better hybrid search
    """
    return {
        "status": "deprecated",
        "message": "NLP search đã được thay thế bằng Hybrid Chat Service. Vui lòng dùng /api/chat/message",
        "redirect_to": "/api/chat/message",
        "query": q
    }


@router.get("/search/semantic/businesses")
async def semantic_search_businesses(
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Semantic search for businesses using embeddings
    
    DEPRECATED: Use /api/chat/message for better results
    """
    return {
        "status": "deprecated",
        "message": "Semantic search đã tích hợp vào Hybrid Chat. Dùng /api/chat/message để có kết quả tốt hơn.",
        "redirect_to": "/api/chat/message",
        "query": q
    }


@router.get("/health")
async def health_check():
    """Health check for UX features API"""
    return {
        "status": "healthy",
        "service": "ux-features",
        "features": [
            "audit_logs",
            "alert_system",
            "hybrid_chat"
        ]
    }
