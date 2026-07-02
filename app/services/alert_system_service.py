"""
Alert System Service
Detect and notify about data quality issues, outdated data, and system events
Now with persistent alert history storage and unified notifications
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum
import json

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertType(Enum):
    """Types of alerts"""
    OUTDATED = "outdated"
    MISSING_FIELD = "missing_field"
    INVALID = "invalid"


class AlertSystemService:
    """
    Service for detecting and managing alerts with persistent history
    
    Features:
    - Real-time alert detection
    - Persistent alert history (stored in database)
    - Auto-resolve when issues fixed
    - Auto-cleanup old resolved alerts (15 days)
    """
    
    def __init__(self):
        # Thresholds
        self.outdated_days_threshold = 180  # 6 months
        self.required_fields = ['email', 'phone', 'address']
    
    def _create_alert_fingerprint(self, business_id: int, alert_type: str, field_name: str = None) -> str:
        """Create unique fingerprint for alert deduplication"""
        parts = [str(business_id), alert_type]
        if field_name:
            parts.append(field_name)
        return "_".join(parts)
    
    def _save_alert_to_history(self, conn, business_id: int, business_name: str,
                               alert_type: str, severity: str, message: str,
                               field_name: str = None, metadata: dict = None,
                               user_id: int = None):
        """Save alert to alert_history table and create notification"""
        try:
            cur = conn.cursor()
            
            # Check if alert already exists and is active
            fingerprint_check = f"business_{business_id}_{alert_type}"
            if field_name:
                fingerprint_check += f"_{field_name}"
            
            cur.execute("""
                SELECT id FROM alert_history
                WHERE business_id = %s
                AND alert_type = %s
                AND (field_name = %s OR (field_name IS NULL AND %s IS NULL))
                AND status = 'active'
                LIMIT 1;
            """, (business_id, alert_type, field_name, field_name))
            
            existing = cur.fetchone()
            is_new_alert = not existing
            
            if not existing:
                # Create new alert
                cur.execute("""
                    INSERT INTO alert_history
                    (business_id, alert_type, severity, message, field_name, metadata, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'active')
                    RETURNING id;
                """, (business_id, alert_type, severity, message, field_name,
                      json.dumps(metadata) if metadata else None))
                
                alert_id = cur.fetchone()[0]
                conn.commit()
                logger.debug(f"Created new alert #{alert_id} for business {business_id}")
                
                # Create notification for business owner (only for new alerts)
                if user_id:
                    try:
                        from app.services.notification_service import get_notification_service
                        notification_service = get_notification_service()
                        
                        alert_title = f"⚠️ Cảnh báo: {business_name}"
                        notification_service.notify_alert(
                            conn,
                            user_id=user_id,
                            alert_title=alert_title,
                            alert_message=message,
                            severity=severity,
                            business_id=business_id
                        )
                        logger.info(f"Created alert notification for user {user_id}")
                    except Exception as notif_error:
                        logger.error(f"Failed to create alert notification: {notif_error}")
            else:
                # Update existing alert
                cur.execute("""
                    UPDATE alert_history
                    SET message = %s,
                        severity = %s,
                        metadata = %s,
                        detected_at = NOW()
                    WHERE id = %s;
                """, (message, severity, json.dumps(metadata) if metadata else None, existing[0]))
                conn.commit()
                logger.debug(f"Updated alert #{existing[0]} for business {business_id}")
            
            cur.close()
            
        except Exception as e:
            logger.error(f"Error saving alert to history: {e}")
            conn.rollback()
    
    def _resolve_alert(self, conn, business_id: int, alert_type: str, field_name: str = None):
        """Mark alert as resolved when issue is fixed"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                UPDATE alert_history
                SET status = 'resolved',
                    resolved_at = NOW()
                WHERE business_id = %s
                AND alert_type = %s
                AND (field_name = %s OR (field_name IS NULL AND %s IS NULL))
                AND status = 'active';
            """, (business_id, alert_type, field_name, field_name))
            
            resolved_count = cur.rowcount
            conn.commit()
            cur.close()
            
            if resolved_count > 0:
                logger.info(f"Resolved {resolved_count} alerts for business {business_id}")
            
        except Exception as e:
            logger.error(f"Error resolving alert: {e}")
            conn.rollback()
    
    def check_and_sync_alerts(self, conn) -> List[Dict]:
        """
        Check for issues and sync with alert_history
        Returns active alerts
        """
        all_alerts = []
        
        try:
            cur = conn.cursor()
            
            # Get all businesses with owner info
            cur.execute("""
                SELECT id, name, email, phone, address, updated_at, user_id
                FROM businesses_demo
                ORDER BY id;
            """)
            
            businesses = cur.fetchall()
            cur.close()
            
            threshold_date = datetime.now() - timedelta(days=self.outdated_days_threshold)
            
            for biz in businesses:
                biz_id, name, email, phone, address, updated_at, user_id = biz
                
                # Check 1: Outdated data
                if updated_at and updated_at < threshold_date:
                    days_old = (datetime.now() - updated_at).days
                    severity = 'critical' if days_old > 365 else 'high' if days_old > 270 else 'medium'
                    
                    message = f"Dữ liệu chưa cập nhật {days_old} ngày"
                    
                    self._save_alert_to_history(
                        conn, biz_id, name,
                        AlertType.OUTDATED.value,
                        severity,
                        message,
                        metadata={'days_old': days_old, 'last_updated': updated_at.isoformat()},
                        user_id=user_id
                    )
                    
                    all_alerts.append({
                        'business_id': biz_id,
                        'business_name': name,
                        'alert_type': AlertType.OUTDATED.value,
                        'severity': severity,
                        'message': message
                    })
                else:
                    # Resolve if was outdated before
                    self._resolve_alert(conn, biz_id, AlertType.OUTDATED.value)
                
                # Check 2: Missing fields
                missing_fields = []
                if not email or email.strip() == '':
                    missing_fields.append('email')
                if not phone or phone.strip() == '':
                    missing_fields.append('phone')
                if not address or address.strip() == '':
                    missing_fields.append('address')
                
                for field in missing_fields:
                    severity = 'high' if field in ['email', 'phone'] else 'medium'
                    message = f"Thiếu thông tin {field}"
                    
                    self._save_alert_to_history(
                        conn, biz_id, name,
                        AlertType.MISSING_FIELD.value,
                        severity,
                        message,
                        field_name=field,
                        user_id=user_id
                    )
                    
                    all_alerts.append({
                        'business_id': biz_id,
                        'business_name': name,
                        'alert_type': AlertType.MISSING_FIELD.value,
                        'severity': severity,
                        'message': message,
                        'field_name': field
                    })
                
                # Resolve missing fields that are now filled
                for field in self.required_fields:
                    if field not in missing_fields:
                        self._resolve_alert(conn, biz_id, AlertType.MISSING_FIELD.value, field)
                
                # Check 3: Invalid data
                if email and email.strip() and '@' not in email:
                    message = f"Email không hợp lệ: {email}"
                    self._save_alert_to_history(
                        conn, biz_id, name,
                        AlertType.INVALID.value,
                        'high',
                        message,
                        field_name='email',
                        user_id=user_id,
                        metadata={'invalid_value': email}
                    )
                    
                    all_alerts.append({
                        'business_id': biz_id,
                        'business_name': name,
                        'alert_type': AlertType.INVALID.value,
                        'severity': 'high',
                        'message': message
                    })
                else:
                    self._resolve_alert(conn, biz_id, AlertType.INVALID.value, 'email')
                
                if phone and phone.strip():
                    digits = ''.join(filter(str.isdigit, phone))
                    if len(digits) < 10 or len(digits) > 15:
                        message = f"Số điện thoại không hợp lệ: {phone}"
                        self._save_alert_to_history(
                            conn, biz_id, name,
                            AlertType.INVALID.value,
                            'high',
                            message,
                            field_name='phone',
                            metadata={'invalid_value': phone}
                        )
                        
                        all_alerts.append({
                            'business_id': biz_id,
                            'business_name': name,
                            'alert_type': AlertType.INVALID.value,
                            'severity': 'high',
                            'message': message
                        })
                    else:
                        self._resolve_alert(conn, biz_id, AlertType.INVALID.value, 'phone')
            
            logger.info(f"✅ Synced alerts: {len(all_alerts)} active alerts")
            return all_alerts
            
        except Exception as e:
            logger.error(f"Error checking and syncing alerts: {e}")
            return []
    
    def get_active_alerts(self, conn, business_ids: List[int] = None) -> List[Dict]:
        """Get active alerts from alert_history table"""
        try:
            cur = conn.cursor()
            
            query = """
                SELECT ah.id, ah.business_id, b.name, ah.alert_type, ah.severity,
                       ah.message, ah.field_name, ah.detected_at, ah.metadata
                FROM alert_history ah
                JOIN businesses b ON b.id = ah.business_id
                WHERE ah.status = 'active'
            """
            
            params = []
            if business_ids:
                query += " AND ah.business_id = ANY(%s)"
                params.append(business_ids)
            
            query += " ORDER BY ah.severity DESC, ah.detected_at DESC;"
            
            cur.execute(query, params if params else None)
            rows = cur.fetchall()
            cur.close()
            
            alerts = []
            for row in rows:
                alerts.append({
                    'id': row[0],
                    'business_id': row[1],
                    'business_name': row[2],
                    'alert_type': row[3],
                    'severity': row[4],
                    'message': row[5],
                    'field_name': row[6],
                    'detected_at': row[7].isoformat() if row[7] else None,
                    'metadata': row[8]
                })
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error getting active alerts: {e}")
            return []
    
    def cleanup_old_alerts(self, conn) -> int:
        """Delete resolved alerts older than 15 days"""
        try:
            cur = conn.cursor()
            
            # Call the PostgreSQL function
            cur.execute("SELECT cleanup_old_alert_history();")
            deleted_count = cur.fetchone()[0]
            
            conn.commit()
            cur.close()
            
            logger.info(f"🗑️ Cleaned up {deleted_count} old resolved alerts")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up old alerts: {e}")
            conn.rollback()
            return 0
    
    def get_alert_stats(self, conn) -> Dict:
        """Get alert statistics"""
        try:
            cur = conn.cursor()
            
            # Total active alerts
            cur.execute("SELECT COUNT(*) FROM alert_history WHERE status = 'active';")
            total_active = cur.fetchone()[0]
            
            # By severity
            cur.execute("""
                SELECT severity, COUNT(*)
                FROM alert_history
                WHERE status = 'active'
                GROUP BY severity;
            """)
            by_severity = dict(cur.fetchall())
            
            # By type
            cur.execute("""
                SELECT alert_type, COUNT(*)
                FROM alert_history
                WHERE status = 'active'
                GROUP BY alert_type;
            """)
            by_type = dict(cur.fetchall())
            
            # Recent resolutions (last 7 days)
            cur.execute("""
                SELECT COUNT(*)
                FROM alert_history
                WHERE status = 'resolved'
                AND resolved_at > NOW() - INTERVAL '7 days';
            """)
            recent_resolutions = cur.fetchone()[0]
            
            cur.close()
            
            return {
                'total_active': total_active,
                'by_severity': by_severity,
                'by_type': by_type,
                'recent_resolutions': recent_resolutions,
                'critical_high_count': by_severity.get('critical', 0) + by_severity.get('high', 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting alert stats: {e}")
            return {}
    
    def get_alert_summary(self, conn) -> Dict:
        """Get alert summary for dashboard"""
        stats = self.get_alert_stats(conn)
        
        by_severity = stats.get('by_severity', {})
        by_type = stats.get('by_type', {})
        
        return {
            'total_alerts': stats.get('total_active', 0),
            'by_severity': {
                'info': by_severity.get('low', 0),
                'warning': by_severity.get('medium', 0),
                'error': by_severity.get('high', 0),
                'critical': by_severity.get('critical', 0)
            },
            'by_category': {
                'outdated': by_type.get('outdated', 0),
                'missing_fields': by_type.get('missing_field', 0),
                'invalid_data': by_type.get('invalid', 0)
            },
            'needs_attention': stats.get('critical_high_count', 0)
        }
    
    def get_all_alerts(self, conn) -> Dict:
        """Get all alerts grouped by type"""
        return {
            'outdated': self.check_outdated_businesses(conn),
            'missing_fields': self.check_missing_fields(conn, 'business'),
            'invalid_data': self.check_invalid_data(conn)
        }
    
    def check_outdated_businesses(self, conn) -> list:
        """Check for outdated businesses"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT ah.id, ah.business_id, b.name, ah.severity, ah.message,
                       ah.metadata, ah.detected_at
                FROM alert_history ah
                JOIN businesses_demo b ON b.id = ah.business_id
                WHERE ah.status = 'active'
                AND ah.alert_type = 'outdated'
                ORDER BY ah.severity DESC, ah.detected_at DESC;
            """)
            
            rows = cur.fetchall()
            cur.close()
            
            alerts = []
            for row in rows:
                import json
                metadata = row[5] if isinstance(row[5], dict) else (json.loads(row[5]) if row[5] else {})
                
                alerts.append({
                    'id': row[0],
                    'resource_id': row[1],
                    'resource_name': row[2],
                    'severity': row[3],
                    'message': row[4],
                    'details': metadata,
                    'detected_at': row[6].isoformat() if row[6] else None,
                    'recommended_action': 'Cập nhật thông tin doanh nghiệp'
                })
            
            return alerts
            
        except Exception as e:
            logger.error(f"Check outdated businesses error: {e}")
            return []
    
    def check_missing_fields(self, conn, resource_type: str) -> list:
        """Check for missing required fields"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT ah.id, ah.business_id, b.name, ah.severity, ah.message,
                       ah.field_name, ah.detected_at
                FROM alert_history ah
                JOIN businesses_demo b ON b.id = ah.business_id
                WHERE ah.status = 'active'
                AND ah.alert_type = 'missing_field'
                ORDER BY ah.severity DESC, ah.detected_at DESC;
            """)
            
            rows = cur.fetchall()
            cur.close()
            
            alerts = []
            for row in rows:
                alerts.append({
                    'id': row[0],
                    'resource_id': row[1],
                    'resource_name': row[2],
                    'severity': row[3],
                    'message': row[4],
                    'field_name': row[5],
                    'detected_at': row[6].isoformat() if row[6] else None,
                    'recommended_action': f'Điền thông tin {row[5]}'
                })
            
            return alerts
            
        except Exception as e:
            logger.error(f"Check missing fields error: {e}")
            return []
    
    def check_invalid_data(self, conn) -> list:
        """Check for invalid data"""
        try:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT ah.id, ah.business_id, b.name, ah.severity, ah.message,
                       ah.field_name, ah.detected_at
                FROM alert_history ah
                JOIN businesses_demo b ON b.id = ah.business_id
                WHERE ah.status = 'active'
                AND ah.alert_type = 'invalid'
                ORDER BY ah.severity DESC, ah.detected_at DESC;
            """)
            
            rows = cur.fetchall()
            cur.close()
            
            alerts = []
            for row in rows:
                alerts.append({
                    'id': row[0],
                    'resource_id': row[1],
                    'resource_name': row[2],
                    'severity': row[3],
                    'message': row[4],
                    'field_name': row[5],
                    'detected_at': row[6].isoformat() if row[6] else None,
                    'recommended_action': f'Sửa lại {row[5]} cho đúng định dạng'
                })
            
            return alerts
            
        except Exception as e:
            logger.error(f"Check invalid data error: {e}")
            return []


_alert_service = None

def get_alert_service() -> AlertSystemService:
    """Get singleton alert service"""
    global _alert_service
    if _alert_service is None:
        _alert_service = AlertSystemService()
    return _alert_service
