"""
Notifications API Routes
Endpoints for unified notification system
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional
import logging
from app.dependencies import get_current_user
from app.services.notification_service import get_notification_service
from app.database import get_db_connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/")
async def get_notifications(
    type: Optional[str] = Query(None, description="Filter by type: alert, news, social, system"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's notifications with filters
    """
    try:
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            notifications = notification_service.get_user_notifications(
                conn,
                user_id=current_user['id'],
                type=type,
                is_read=is_read,
                limit=limit,
                offset=offset
            )
            
            return {
                "status": "success",
                "notifications": notifications,
                "count": len(notifications)
            }
        
    except Exception as e:
        logger.error(f"Get notifications error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count")
async def get_unread_count(
    by_type: bool = Query(False, description="Group count by type"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get count of unread notifications
    """
    try:
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            counts = notification_service.get_unread_count(
                conn,
                user_id=current_user['id'],
                by_type=by_type
            )
            
            return {
                "status": "success",
                "counts": counts
            }
        
    except Exception as e:
        logger.error(f"Get unread count error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a notification as read
    """
    try:
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            success = notification_service.mark_as_read(
                conn,
                notification_id=notification_id,
                user_id=current_user['id']
            )
            
            if not success:
                raise HTTPException(status_code=404, detail="Notification not found")
            
            return {
                "status": "success",
                "message": "Marked as read"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mark as read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/mark-all-read")
async def mark_all_read(
    type: Optional[str] = Query(None, description="Mark all of specific type"),
    current_user: dict = Depends(get_current_user)
):
    """
    Mark all notifications as read
    """
    try:
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            count = notification_service.mark_all_as_read(
                conn,
                user_id=current_user['id'],
                type=type
            )
            
            return {
                "status": "success",
                "marked_count": count,
                "message": f"Marked {count} notifications as read"
            }
        
    except Exception as e:
        logger.error(f"Mark all as read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a notification
    """
    try:
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            success = notification_service.delete_notification(
                conn,
                notification_id=notification_id,
                user_id=current_user['id']
            )
            
            if not success:
                raise HTTPException(status_code=404, detail="Notification not found")
            
            return {
                "status": "success",
                "message": "Notification deleted"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preferences")
async def get_preferences(
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's notification preferences
    """
    try:
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            preferences = notification_service.get_user_preferences(
                conn,
                user_id=current_user['id']
            )
            
            return {
                "status": "success",
                "preferences": preferences
            }
        
    except Exception as e:
        logger.error(f"Get preferences error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/preferences")
async def update_preferences(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Update user's notification preferences
    """
    try:
        body = await request.json()
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            success = notification_service.update_preferences(
                conn,
                user_id=current_user['id'],
                preferences=body
            )
            
            if not success:
                raise HTTPException(status_code=400, detail="Failed to update preferences")
            
            return {
                "status": "success",
                "message": "Preferences updated"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update preferences error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def create_test_notification(
    current_user: dict = Depends(get_current_user)
):
    """
    Create test notifications (for development)
    """
    try:
        notification_service = get_notification_service()
        
        with get_db_connection() as conn:
            # Create various test notifications
            notification_service.notify_new_news(
                conn,
                user_id=current_user['id'],
                news_title="Test News Article",
                news_id=1
            )
            
            notification_service.notify_alert(
                conn,
                user_id=current_user['id'],
                alert_title="⚠️ Cảnh báo test",
                alert_message="Đây là cảnh báo test",
                severity="high",
                business_id=1
            )
            
            return {
                "status": "success",
                "message": "Test notifications created"
            }
        
    except Exception as e:
        logger.error(f"Create test notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for notifications API"""
    return {
        "status": "healthy",
        "service": "notifications"
    }
