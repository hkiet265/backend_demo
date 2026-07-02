"""
Unified Notification Service
Manages all types of notifications: alerts, news, social interactions
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Service for creating and managing notifications
    
    Notification Types:
    - alert: Data quality alerts, system warnings
    - news: New articles, trending news
    - social: Bookmarks, comments, mentions
    - system: System updates, maintenance
    """
    
    def create_notification(
        self,
        conn,
        user_id: int,
        type: str,
        title: str,
        message: str,
        category: str = None,
        link: str = None,
        icon: str = '🔔',
        priority: str = 'medium',
        related_type: str = None,
        related_id: int = None,
        metadata: dict = None,
        expires_in_days: int = None
    ) -> int:
        """Create a new notification"""
        try:
            cur = conn.cursor()
            
            expires_at = None
            if expires_in_days:
                expires_at = datetime.now() + timedelta(days=expires_in_days)
            
            cur.execute("""
                INSERT INTO notifications
                (user_id, type, category, title, message, link, icon, priority,
                 related_type, related_id, metadata, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (user_id, type, category, title, message, link, icon, priority,
                  related_type, related_id, json.dumps(metadata) if metadata else None,
                  expires_at))
            
            notification_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            
            logger.info(f"Created notification #{notification_id} for user {user_id}")
            return notification_id
            
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            conn.rollback()
            return None
    
    def get_user_notifications(
        self,
        conn,
        user_id: int,
        type: str = None,
        is_read: bool = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """Get notifications for a user with filters"""
        try:
            cur = conn.cursor()
            
            query = """
                SELECT id, type, category, title, message, link, icon, priority,
                       is_read, read_at, related_type, related_id, metadata, created_at
                FROM notifications
                WHERE user_id = %s
            """
            params = [user_id]
            
            if type:
                query += " AND type = %s"
                params.append(type)
            
            if is_read is not None:
                query += " AND is_read = %s"
                params.append(is_read)
            
            query += " ORDER BY created_at DESC LIMIT %s OFFSET %s;"
            params.extend([limit, offset])
            
            cur.execute(query, params)
            rows = cur.fetchall()
            cur.close()
            
            notifications = []
            for row in rows:
                notifications.append({
                    'id': row[0],
                    'type': row[1],
                    'category': row[2],
                    'title': row[3],
                    'message': row[4],
                    'link': row[5],
                    'icon': row[6],
                    'priority': row[7],
                    'is_read': row[8],
                    'read_at': row[9].isoformat() if row[9] else None,
                    'related_type': row[10],
                    'related_id': row[11],
                    'metadata': row[12],
                    'created_at': row[13].isoformat() if row[13] else None
                })
            
            return notifications
            
        except Exception as e:
            logger.error(f"Error getting notifications: {e}")
            return []
    
    def mark_as_read(self, conn, notification_id: int, user_id: int) -> bool:
        """Mark a notification as read"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                UPDATE notifications
                SET is_read = TRUE
                WHERE id = %s AND user_id = %s;
            """, (notification_id, user_id))
            
            updated = cur.rowcount > 0
            conn.commit()
            cur.close()
            
            return updated
            
        except Exception as e:
            logger.error(f"Error marking notification as read: {e}")
            conn.rollback()
            return False
    
    def mark_all_as_read(self, conn, user_id: int, type: str = None) -> int:
        """Mark all notifications as read for a user"""
        try:
            cur = conn.cursor()
            
            query = "UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE"
            params = [user_id]
            
            if type:
                query += " AND type = %s"
                params.append(type)
            
            query += ";"
            cur.execute(query, params)
            
            count = cur.rowcount
            conn.commit()
            cur.close()
            
            logger.info(f"Marked {count} notifications as read for user {user_id}")
            return count
            
        except Exception as e:
            logger.error(f"Error marking all as read: {e}")
            conn.rollback()
            return 0
    
    def delete_notification(self, conn, notification_id: int, user_id: int) -> bool:
        """Delete a notification"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                DELETE FROM notifications
                WHERE id = %s AND user_id = %s;
            """, (notification_id, user_id))
            
            deleted = cur.rowcount > 0
            conn.commit()
            cur.close()
            
            return deleted
            
        except Exception as e:
            logger.error(f"Error deleting notification: {e}")
            conn.rollback()
            return False
    
    def get_unread_count(self, conn, user_id: int, by_type: bool = False) -> Dict:
        """Get count of unread notifications"""
        try:
            cur = conn.cursor()
            
            if by_type:
                cur.execute("""
                    SELECT type, COUNT(*)
                    FROM notifications
                    WHERE user_id = %s AND is_read = FALSE
                    GROUP BY type;
                """, (user_id,))
                
                rows = cur.fetchall()
                counts = {row[0]: row[1] for row in rows}
                counts['total'] = sum(counts.values())
            else:
                cur.execute("""
                    SELECT COUNT(*)
                    FROM notifications
                    WHERE user_id = %s AND is_read = FALSE;
                """, (user_id,))
                
                counts = {'total': cur.fetchone()[0]}
            
            cur.close()
            return counts
            
        except Exception as e:
            logger.error(f"Error getting unread count: {e}")
            return {'total': 0}
    
    def cleanup_expired(self, conn) -> int:
        """Delete expired notifications"""
        try:
            cur = conn.cursor()
            cur.execute("SELECT cleanup_expired_notifications();")
            count = cur.fetchone()[0]
            conn.commit()
            cur.close()
            
            logger.info(f"Cleaned up {count} expired notifications")
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning up expired notifications: {e}")
            conn.rollback()
            return 0
    
    def get_user_preferences(self, conn, user_id: int) -> Dict:
        """Get user notification preferences"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT enable_alerts, enable_news, enable_social, enable_system,
                       alert_data_quality, alert_outdated, alert_missing_fields,
                       news_new_articles, news_trending, news_related_businesses,
                       social_bookmarks, social_comments, social_mentions,
                       auto_mark_read_after_days, max_notifications
                FROM user_notification_preferences
                WHERE user_id = %s;
            """, (user_id,))
            
            row = cur.fetchone()
            cur.close()
            
            if not row:
                # Create default preferences
                return self.create_default_preferences(conn, user_id)
            
            return {
                'enable_alerts': row[0],
                'enable_news': row[1],
                'enable_social': row[2],
                'enable_system': row[3],
                'alert_data_quality': row[4],
                'alert_outdated': row[5],
                'alert_missing_fields': row[6],
                'news_new_articles': row[7],
                'news_trending': row[8],
                'news_related_businesses': row[9],
                'social_bookmarks': row[10],
                'social_comments': row[11],
                'social_mentions': row[12],
                'auto_mark_read_after_days': row[13],
                'max_notifications': row[14]
            }
            
        except Exception as e:
            logger.error(f"Error getting preferences: {e}")
            return {}
    
    def create_default_preferences(self, conn, user_id: int) -> Dict:
        """Create default notification preferences for user"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO user_notification_preferences (user_id)
                VALUES (%s)
                ON CONFLICT (user_id) DO NOTHING;
            """, (user_id,))
            
            conn.commit()
            cur.close()
            
            return self.get_user_preferences(conn, user_id)
            
        except Exception as e:
            logger.error(f"Error creating default preferences: {e}")
            conn.rollback()
            return {}
    
    def update_preferences(self, conn, user_id: int, preferences: Dict) -> bool:
        """Update user notification preferences"""
        try:
            cur = conn.cursor()
            
            # Build update query dynamically
            fields = []
            values = []
            
            for key, value in preferences.items():
                fields.append(f"{key} = %s")
                values.append(value)
            
            if not fields:
                return False
            
            values.append(user_id)
            query = f"""
                UPDATE user_notification_preferences
                SET {', '.join(fields)}
                WHERE user_id = %s;
            """
            
            cur.execute(query, values)
            updated = cur.rowcount > 0
            conn.commit()
            cur.close()
            
            return updated
            
        except Exception as e:
            logger.error(f"Error updating preferences: {e}")
            conn.rollback()
            return False
    
    # ==================== NOTIFICATION CREATORS ====================
    
    def notify_new_news(self, conn, user_id: int, news_title: str, news_id: int):
        """Create notification for new news article"""
        return self.create_notification(
            conn,
            user_id=user_id,
            type='news',
            category='new_article',
            title='📰 Tin tức mới',
            message=f'Có tin tức mới: {news_title}',
            link=f'/news/{news_id}',
            icon='📰',
            priority='medium',
            related_type='news',
            related_id=news_id,
            expires_in_days=7
        )
    
    def notify_business_bookmarked(self, conn, user_id: int, bookmarker_name: str, business_name: str, business_id: int):
        """Create notification when someone bookmarks user's business"""
        return self.create_notification(
            conn,
            user_id=user_id,
            type='social',
            category='bookmark',
            title='❤️ Yêu thích mới',
            message=f'{bookmarker_name} đã thêm "{business_name}" vào yêu thích',
            link=f'/businesses/{business_id}',
            icon='❤️',
            priority='low',
            related_type='business',
            related_id=business_id,
            expires_in_days=14
        )
    
    def notify_alert(self, conn, user_id: int, alert_title: str, alert_message: str, severity: str, business_id: int = None):
        """Create notification from alert"""
        priority_map = {'critical': 'urgent', 'high': 'high', 'medium': 'medium', 'low': 'low'}
        
        return self.create_notification(
            conn,
            user_id=user_id,
            type='alert',
            category='data_quality',
            title=alert_title,
            message=alert_message,
            link=f'/my-businesses' if business_id else None,
            icon='⚠️',
            priority=priority_map.get(severity, 'medium'),
            related_type='business' if business_id else None,
            related_id=business_id,
            expires_in_days=15
        )


_notification_service = None

def get_notification_service() -> NotificationService:
    """Get singleton notification service"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
