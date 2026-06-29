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
 
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="memory://",
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
 
CHAT_RATE_LIMIT = "10/minute"
NEWS_RATE_LIMIT = "30/minute"
AUTH_RATE_LIMIT = "5/minute"
CRAWLER_RATE_LIMIT = "1/minute"
GENERAL_RATE_LIMIT = "60/minute"
