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
    RAGService,
    ChatService
)
 
_embedding_service = None
_vector_service = None
_rag_service = None
_chat_service = None


@lru_cache()
def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service singleton"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService(
            api_key=settings.GEMINI_API_KEY,
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


@lru_cache()
def get_chat_service() -> ChatService:
    """Get or create chat service singleton"""
    global _chat_service
    if _chat_service is None:
        rag_service = get_rag_service()
        _chat_service = ChatService(rag_service=rag_service)
    return _chat_service



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
