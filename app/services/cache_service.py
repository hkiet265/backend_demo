"""
Cache Service
Redis-backed cache with automatic fallback to an in-memory dict when
Redis is not configured or unreachable. Callers don't need to know which
backend is active.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CacheService:
    """Get/set cache entries via Redis, falling back to in-memory storage."""

    def __init__(self, redis_url: str = "", memory_max_size: int = 100):
        self._redis = None
        self._memory_cache: dict = {}
        self._memory_max_size = memory_max_size

        if redis_url:
            try:
                import redis
                client = redis.Redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                client.ping()
                self._redis = client
                logger.info("✅ CacheService using Redis backend")
            except Exception as e:
                logger.warning(f"⚠️ Redis unavailable ({e}), falling back to in-memory cache")
                self._redis = None
        else:
            logger.info("ℹ️ REDIS_URL not set, CacheService using in-memory cache")

    def get(self, key: str) -> Optional[Any]:
        if self._redis:
            try:
                raw = self._redis.get(key)
                return json.loads(raw) if raw is not None else None
            except Exception as e:
                logger.warning(f"Redis GET failed ({e}), falling back to in-memory for this call")

        entry = self._memory_cache.get(key)
        if not entry:
            return None
        if datetime.now() >= entry['expires_at']:
            del self._memory_cache[key]
            return None
        return entry['value']

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if self._redis:
            try:
                self._redis.setex(key, ttl_seconds, json.dumps(value))
                return
            except Exception as e:
                logger.warning(f"Redis SET failed ({e}), falling back to in-memory for this call")

        self._memory_cache[key] = {
            'value': value,
            'expires_at': datetime.now() + timedelta(seconds=ttl_seconds),
        }
        if len(self._memory_cache) > self._memory_max_size:
            oldest_key = min(self._memory_cache.items(), key=lambda kv: kv[1]['expires_at'])[0]
            del self._memory_cache[oldest_key]

    @property
    def backend(self) -> str:
        return "redis" if self._redis else "memory"


_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get or create cache service singleton"""
    global _cache_service
    if _cache_service is None:
        from app.config import settings
        _cache_service = CacheService(redis_url=settings.REDIS_URL)
    return _cache_service
