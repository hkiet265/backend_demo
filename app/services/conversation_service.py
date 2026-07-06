"""
Conversation Memory Service
Manages conversation history for contextual chat
UPDATED: Uses PostgreSQL for persistent storage
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import json

logger = logging.getLogger(__name__)


class ConversationService:
    """
    Manages conversation history for users
    Uses PostgreSQL for persistent, per-user storage
    """
    
    def __init__(self, db_config: Dict):
        """
        Initialize conversation service with PostgreSQL
        
        Args:
            db_config: Database connection configuration
        """
        self.db_config = db_config
        self.max_messages = 20  # Keep last 20 messages per user
        logger.info("✅ ConversationService initialized (PostgreSQL)")
    
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        user_id: Optional[int] = None,
        context: Optional[Dict] = None,
        complexity: Optional[str] = None,
        response_time_ms: Optional[int] = None
    ) -> None:
        """
        Add message to conversation history
        
        Args:
            session_id: Session identifier (UUID)
            role: 'user' or 'assistant'
            content: Message content
            user_id: User ID (nullable for anonymous)
            context: Optional context data (businesses, documents)
            complexity: Query complexity (simple/semantic/complex)
            response_time_ms: Response time in milliseconds
        """
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO chat_conversations 
                (user_id, session_id, role, content, context, complexity, response_time_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                session_id,
                role,
                content,
                json.dumps(context) if context else '{}',
                complexity,
                response_time_ms
            ))
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.debug(f"💾 Saved {role} message: session={session_id}, user={user_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save message: {e}")
    
    def get_conversation_history(
        self,
        session_id: str,
        user_id: Optional[int] = None,
        max_messages: Optional[int] = None
    ) -> List[Dict]:
        """
        Get conversation history for a session
        
        Args:
            session_id: Session identifier
            user_id: Optional user ID filter
            max_messages: Limit number of messages (default: self.max_messages)
            
        Returns:
            List of messages ordered by time (oldest first)
        """
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            limit = max_messages or self.max_messages
            
            # Query with optional user_id filter
            if user_id:
                cur.execute("""
                    SELECT id, user_id, session_id, role, content, context, 
                           complexity, response_time_ms, created_at
                    FROM chat_conversations
                    WHERE session_id = %s AND user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (session_id, user_id, limit))
            else:
                cur.execute("""
                    SELECT id, user_id, session_id, role, content, context,
                           complexity, response_time_ms, created_at
                    FROM chat_conversations
                    WHERE session_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (session_id, limit))
            
            messages = cur.fetchall()
            cur.close()
            conn.close()
            
            # Reverse to get chronological order (oldest first)
            messages.reverse()
            
            # Convert to dict and parse context JSON
            result = []
            for msg in messages:
                result.append({
                    'id': msg['id'],
                    'role': msg['role'],
                    'content': msg['content'],
                    'context': msg['context'] if isinstance(msg['context'], dict) else {},
                    'timestamp': msg['created_at'].isoformat() if msg['created_at'] else None,
                    'complexity': msg['complexity'],
                    'response_time_ms': msg['response_time_ms']
                })
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to get conversation history: {e}")
            return []
    
    def get_user_conversations(
        self,
        user_id: int,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get list of conversations for a user (grouped by session)
        
        Args:
            user_id: User ID
            limit: Number of recent sessions
            
        Returns:
            List of sessions with preview
        """
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT 
                    session_id,
                    MAX(created_at) as last_message_at,
                    COUNT(*) as message_count,
                    (
                        SELECT content
                        FROM chat_conversations c2
                        WHERE c2.session_id = c1.session_id 
                          AND c2.user_id = %s
                          AND c2.role = 'user'
                        ORDER BY c2.created_at ASC
                        LIMIT 1
                    ) as first_message
                FROM chat_conversations c1
                WHERE user_id = %s
                GROUP BY session_id
                ORDER BY last_message_at DESC
                LIMIT %s
            """, (user_id, user_id, limit))
            
            sessions = cur.fetchall()
            cur.close()
            conn.close()
            
            return [dict(s) for s in sessions]
            
        except Exception as e:
            logger.error(f"❌ Failed to get user conversations: {e}")
            return []
    
    def get_last_context(
        self,
        session_id: str,
        user_id: Optional[int] = None
    ) -> Dict:
        """
        Get context from last assistant message
        
        Args:
            session_id: Session identifier
            user_id: Optional user ID
            
        Returns:
            Last context dict or empty dict
        """
        messages = self.get_conversation_history(session_id, user_id, max_messages=5)
        
        # Find last assistant message with context
        for message in reversed(messages):
            if message['role'] == 'assistant' and message.get('context'):
                return message['context']
        
        return {}
    
    def format_for_ai(
        self,
        session_id: str,
        user_id: Optional[int] = None,
        max_messages: int = 10
    ) -> List[Dict]:
        """
        Format conversation history for AI (Gemini format)
        
        Args:
            session_id: Session identifier
            user_id: Optional user ID
            max_messages: Maximum messages to include
            
        Returns:
            List of messages in AI format
        """
        messages = self.get_conversation_history(session_id, user_id, max_messages)
        
        # Format for Gemini: [{"role": "user", "parts": ["text"]}, ...]
        formatted = []
        for msg in messages:
            formatted.append({
                'role': msg['role'],
                'parts': [msg['content']]
            })
        
        return formatted
    
    def clear_conversation(
        self,
        session_id: str,
        user_id: Optional[int] = None
    ) -> int:
        """
        Clear conversation history for a session
        
        Args:
            session_id: Session identifier
            user_id: Optional user ID filter
            
        Returns:
            Number of messages deleted
        """
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()
            
            if user_id:
                cur.execute("""
                    DELETE FROM chat_conversations
                    WHERE session_id = %s AND user_id = %s
                """, (session_id, user_id))
            else:
                cur.execute("""
                    DELETE FROM chat_conversations
                    WHERE session_id = %s
                """, (session_id,))
            
            deleted = cur.rowcount
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"🗑️ Deleted {deleted} messages from session: {session_id}")
            return deleted
            
        except Exception as e:
            logger.error(f"❌ Failed to clear conversation: {e}")
            return 0
    
    def cleanup_old_conversations(self, days: int = 30) -> int:
        """
        Delete conversations older than specified days
        
        Args:
            days: Age threshold in days
            
        Returns:
            Number of messages deleted
        """
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()
            
            cur.execute("""
                DELETE FROM chat_conversations
                WHERE created_at < NOW() - INTERVAL '%s days'
            """, (days,))
            
            deleted = cur.rowcount
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"🧹 Cleaned up {deleted} old messages (>{days} days)")
            return deleted
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup old conversations: {e}")
            return 0
    
    def get_stats(self, user_id: Optional[int] = None) -> Dict:
        """
        Get conversation statistics
        
        Args:
            user_id: Optional user ID filter
            
        Returns:
            Statistics dict
        """
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            if user_id:
                cur.execute("""
                    SELECT 
                        COUNT(DISTINCT session_id) as total_sessions,
                        COUNT(*) as total_messages,
                        AVG(response_time_ms) as avg_response_time,
                        COUNT(CASE WHEN complexity = 'simple' THEN 1 END) as simple_queries,
                        COUNT(CASE WHEN complexity = 'semantic' THEN 1 END) as semantic_queries,
                        COUNT(CASE WHEN complexity = 'complex' THEN 1 END) as complex_queries
                    FROM chat_conversations
                    WHERE user_id = %s
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT 
                        COUNT(DISTINCT session_id) as total_sessions,
                        COUNT(DISTINCT user_id) as total_users,
                        COUNT(*) as total_messages,
                        AVG(response_time_ms) as avg_response_time,
                        COUNT(CASE WHEN complexity = 'simple' THEN 1 END) as simple_queries,
                        COUNT(CASE WHEN complexity = 'semantic' THEN 1 END) as semantic_queries,
                        COUNT(CASE WHEN complexity = 'complex' THEN 1 END) as complex_queries
                    FROM chat_conversations
                """)
            
            stats = cur.fetchone()
            cur.close()
            conn.close()
            
            return dict(stats) if stats else {}
            
        except Exception as e:
            logger.error(f"❌ Failed to get stats: {e}")
            return {}


# Global instance
_conversation_service = None


def get_conversation_service() -> ConversationService:
    """Get or create conversation service singleton"""
    global _conversation_service
    if _conversation_service is None:
        from app.config import settings
        _conversation_service = ConversationService(settings.database_url)
    return _conversation_service
