"""
Dependency Injection
Provide services to API routes
"""
from functools import lru_cache
from fastapi import Header, HTTPException
from typing import Optional
import jwt
from app.config import settings
from app.services import (
    EmbeddingService,
    VectorService,
    RAGService
)
from app.services.hybrid_chat_service import get_hybrid_chat_service, HybridChatService
 
_embedding_service = None
_vector_service = None
_rag_service = None
_hybrid_chat_service = None


@lru_cache()
def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service singleton"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService(
            api_key=None,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION
        )
    return _embedding_service


@lru_cache()
def get_vector_service() -> VectorService:
    """Get or create vector service singleton"""
    global _vector_service
    if _vector_service is None:
        embedding_service = get_embedding_service()
        _vector_service = VectorService(
            db_config=settings.database_url,
            embedding_service=embedding_service
        )
    return _vector_service


@lru_cache()
def get_rag_service() -> RAGService:
    """Get or create RAG service singleton"""
    global _rag_service
    if _rag_service is None:
        vector_service = get_vector_service()
        _rag_service = RAGService(
            vector_service=vector_service,
            gemini_api_key=settings.GEMINI_API_KEY,
            chat_model=settings.CHAT_MODEL,
            use_groq=True
        )
    return _rag_service


def get_hybrid_service() -> HybridChatService:
    """Get or create hybrid chat service singleton"""
    global _hybrid_chat_service
    if _hybrid_chat_service is None:
        rag_service = get_rag_service()
        _hybrid_chat_service = get_hybrid_chat_service(rag_service)
    return _hybrid_chat_service



async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Get current authenticated user from JWT token
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if not authorization:
        logger.error("❌ No authorization header provided")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        else:
            token = authorization
        
        logger.info(f"🔑 Token received (first 20 chars): {token[:20]}...")
        
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("user_id")
        email = payload.get("email")
        
        logger.info(f"✅ Token decoded successfully - User: {email} (ID: {user_id})")
        
        if not user_id or not email:
            logger.error("❌ Token missing user_id or email")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {
            "id": user_id,
            "email": email,
            "full_name": payload.get("full_name"),
            "role": payload.get("role", "user")
        }
        
    except jwt.ExpiredSignatureError as e:
        logger.error(f"❌ Token expired: {e}")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"❌ Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"❌ Authentication failed: {e}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def get_current_user_optional(authorization: Optional[str] = Header(None)):
    """
    Get current user if authenticated, None if not
    Used for endpoints that work for both anonymous and logged-in users
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if not authorization:
        logger.info("📭 No auth token - anonymous user")
        return None
    
    try:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        else:
            token = authorization
        
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("user_id")
        email = payload.get("email")
        
        if not user_id or not email:
            logger.warning("⚠️ Invalid token - treating as anonymous")
            return None
        
        logger.info(f"✅ Authenticated user: {email} (ID: {user_id})")
        
        return {
            "id": user_id,
            "email": email,
            "full_name": payload.get("full_name"),
            "role": payload.get("role", "user")
        }
        
    except jwt.ExpiredSignatureError:
        logger.warning("⚠️ Token expired - treating as anonymous")
        return None
    except jwt.InvalidTokenError:
        logger.warning("⚠️ Invalid token - treating as anonymous")
        return None
    except Exception as e:
        logger.warning(f"⚠️ Auth error: {e} - treating as anonymous")
        return None
