"""
Database connection pooling
Tối ưu performance bằng cách tái sử dụng connections
"""
from psycopg2 import pool
from contextlib import contextmanager
import logging
import threading

logger = logging.getLogger(__name__)

_db_pool = None
_pool_lock = threading.Lock()


def init_db_pool(db_config: dict, minconn: int = 5, maxconn: int = 20):
    """
    Khởi tạo connection pool khi server khởi động
    
    Args:
        db_config: Database connection config
        minconn: Số connection tối thiểu luôn sẵn sàng
        maxconn: Số connection tối đa có thể tạo
    """
    global _db_pool
    
    if _db_pool is not None:
        logger.warning("⚠️ Database pool already initialized")
        return
    
    with _pool_lock:
        if _db_pool is None:
            try:
                pool_config = db_config.copy()
                pool_config['connect_timeout'] = 10
                
                _db_pool = pool.ThreadedConnectionPool(
                    minconn=minconn,
                    maxconn=maxconn,
                    **pool_config
                )
                logger.info(f"✅ Database pool initialized: {minconn}-{maxconn} connections (timeout: 10s)")
            except Exception as e:
                logger.error(f"❌ Failed to initialize database pool: {e}")
                raise


def get_db_pool():
    """Lấy database pool instance"""
    if _db_pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db_pool() first.")
    return _db_pool


@contextmanager
def get_db_connection():
    """
    Context manager để lấy và tự động trả lại connection
    
    Usage:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users")
            results = cur.fetchall()
    """
    conn = None
    try:
        conn = get_db_pool().getconn()
        yield conn
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if conn:
            get_db_pool().putconn(conn)


def close_db_pool():
    """Đóng tất cả connections khi server shutdown"""
    global _db_pool
    
    if _db_pool is not None:
        with _pool_lock:
            if _db_pool is not None:
                _db_pool.closeall()
                _db_pool = None
                logger.info("✅ Database pool closed")
