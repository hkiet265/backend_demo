"""
Audit Log Service
Track all changes to businesses and news for compliance and history
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class AuditLogService:
    """
    Service for tracking all data changes
    
    Audit log includes:
    - Who: user_id, username, role
    - What: action (CREATE, UPDATE, DELETE, etc.)
    - When: timestamp
    - Where: resource type and ID
    - Details: old_value, new_value, changes
    """
    
    def __init__(self):
        self.action_types = {
            'CREATE': 'Tạo mới',
            'UPDATE': 'Cập nhật',
            'DELETE': 'Xóa',
            'IMPORT': 'Import',
            'EXPORT': 'Export',
            'LOGIN': 'Đăng nhập',
            'LOGOUT': 'Đăng xuất',
            'VIEW': 'Xem',
            'DOWNLOAD': 'Tải xuống'
        }
        
        self.resource_types = {
            'BUSINESS': 'Doanh nghiệp',
            'NEWS': 'Tin tức',
            'USER': 'Người dùng',
            'BOOKMARK': 'Bookmark',
            'SYSTEM': 'Hệ thống'
        }
    
    async def log_action(
        self,
        conn,
        user_id: int,
        username: str,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        old_value: Optional[Dict] = None,
        new_value: Optional[Dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[str] = None
    ) -> int:
        """
        Log một action vào database
        
        Args:
            conn: Database connection
            user_id: ID người dùng
            username: Tên người dùng
            action: Loại action (CREATE, UPDATE, DELETE...)
            resource_type: Loại resource (BUSINESS, NEWS...)
            resource_id: ID của resource (optional)
            old_value: Giá trị cũ (for UPDATE/DELETE)
            new_value: Giá trị mới (for CREATE/UPDATE)
            ip_address: IP address
            user_agent: User agent string
            details: Mô tả chi tiết
            
        Returns:
            audit_log_id
        """
        try:
            cur = conn.cursor()
            
            # Compute changes nếu có old và new value
            changes = None
            if old_value and new_value:
                changes = self._compute_changes(old_value, new_value)
            
            # Insert audit log
            cur.execute("""
                INSERT INTO audit_logs (
                    user_id, username, action, resource_type, resource_id,
                    old_value, new_value, changes, ip_address, user_agent,
                    details, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, NOW()
                )
                RETURNING id;
            """, (
                user_id, username, action, resource_type, resource_id,
                json.dumps(old_value) if old_value else None,
                json.dumps(new_value) if new_value else None,
                json.dumps(changes) if changes else None,
                ip_address, user_agent,
                details
            ))
            
            audit_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            
            logger.info(f"✅ Audit log created: {action} {resource_type} by {username}")
            return audit_id
            
        except Exception as e:
            logger.error(f"❌ Audit log error: {e}")
            return 0
    
    def _compute_changes(self, old_value: Dict, new_value: Dict) -> List[Dict]:
        """
        Tính toán các thay đổi giữa old và new value
        
        Returns:
            List of changes: [{"field": "name", "old": "A", "new": "B"}]
        """
        changes = []
        
        # Check tất cả các field trong new_value
        for key, new_val in new_value.items():
            old_val = old_value.get(key)
            
            # Skip nếu giá trị không đổi
            if old_val == new_val:
                continue
            
            # Skip các field metadata
            if key in ['updated_at', 'created_at']:
                continue
            
            changes.append({
                'field': key,
                'old': old_val,
                'new': new_val
            })
        
        return changes
    
    async def get_audit_logs(
        self,
        conn,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        exclude_actions: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Lấy audit logs với filters
        """
        try:
            cur = conn.cursor()
            
            conditions = []
            params = []
            
            if resource_type:
                conditions.append("resource_type = %s")
                params.append(resource_type)
            
            if resource_id is not None:
                conditions.append("resource_id = %s")
                params.append(resource_id)
            
            if user_id:
                conditions.append("user_id = %s")
                params.append(user_id)
            
            if action:
                conditions.append("action = %s")
                params.append(action)
            
            if exclude_actions:
                placeholders = ', '.join(['%s'] * len(exclude_actions))
                conditions.append(f"action NOT IN ({placeholders})")
                params.extend(exclude_actions)
            
            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            
            params.extend([limit, offset])
            
            query = f"""
                SELECT 
                    id, user_id, username, action, resource_type, resource_id,
                    old_value, new_value, changes, ip_address, user_agent,
                    details, created_at
                FROM audit_logs
                {where_clause}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s;
            """
            
            cur.execute(query, params)
            rows = cur.fetchall()
            cur.close()
            
            logs = []
            for row in rows:
                # Handle JSONB columns - PostgreSQL returns them as dict/list, not strings
                old_value = row[6]
                if isinstance(old_value, str):
                    old_value = json.loads(old_value) if old_value else None
                    
                new_value = row[7]
                if isinstance(new_value, str):
                    new_value = json.loads(new_value) if new_value else None
                    
                changes = row[8]
                if isinstance(changes, str):
                    changes = json.loads(changes) if changes else None
                
                logs.append({
                    'id': row[0],
                    'user_id': row[1],
                    'username': row[2],
                    'action': row[3],
                    'resource_type': row[4],
                    'resource_id': row[5],
                    'old_value': old_value,
                    'new_value': new_value,
                    'changes': changes,
                    'ip_address': row[9],
                    'user_agent': row[10],
                    'details': row[11],
                    'created_at': row[12].isoformat() if row[12] else None
                })
            
            return logs
            
        except Exception as e:
            logger.error(f"Get audit logs error: {e}")
            return []
    
    async def get_resource_history(
        self,
        conn,
        resource_type: str,
        resource_id: int
    ) -> List[Dict]:
        """
        Lấy lịch sử đầy đủ của một resource
        """
        return await self.get_audit_logs(
            conn,
            resource_type=resource_type,
            resource_id=resource_id,
            limit=1000
        )
    
    async def get_user_activity(
        self,
        conn,
        user_id: int,
        limit: int = 50
    ) -> List[Dict]:
        """
        Lấy activity log của một user
        """
        return await self.get_audit_logs(
            conn,
            user_id=user_id,
            limit=limit
        )
    
    def format_audit_log(self, log: Dict) -> str:
        """
        Format audit log thành human-readable string
        """
        action_vn = self.action_types.get(log['action'], log['action'])
        resource_vn = self.resource_types.get(log['resource_type'], log['resource_type'])
        
        msg = f"{log['username']} đã {action_vn} {resource_vn}"
        
        if log['resource_id']:
            msg += f" #{log['resource_id']}"
        
        if log['changes']:
            changes_count = len(log['changes'])
            msg += f" ({changes_count} thay đổi)"
        
        return msg


_audit_service = None

def get_audit_service() -> AuditLogService:
    """Get singleton audit service"""
    global _audit_service
    if _audit_service is None:
        _audit_service = AuditLogService()
    return _audit_service
