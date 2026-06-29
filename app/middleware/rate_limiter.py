"""
Rate Limiter Middleware
Protect API from abuse and excessive usage
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,  # Rate limit by IP address
    default_limits=["100/minute"],  # Default: 100 requests per minute
    storage_uri="memory://",  # In-memory storage (simple, no Redis needed)
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Custom handler for rate limit exceeded"""
    client_ip = get_remote_address(request)
    logger.warning(f"⚠️ Rate limit exceeded for IP: {client_ip}")
    
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
            "detail": "Too many requests. Please slow down.",
            "retry_after": "60 seconds"
        }
    )


# Rate limit decorators for different endpoints
CHAT_RATE_LIMIT = "10/minute"  # Chat: 10 requests/minute
NEWS_RATE_LIMIT = "30/minute"  # News API: 30 requests/minute
AUTH_RATE_LIMIT = "5/minute"   # Login/Register: 5 requests/minute (prevent brute force)
CRAWLER_RATE_LIMIT = "1/minute"  # Manual crawler: 1 request/minute
GENERAL_RATE_LIMIT = "60/minute"  # General API: 60 requests/minute
