"""
Dependency Injection
Provide services to API routes
"""
from functools import lru_cache
from app.config import settings
from app.services import (
    EmbeddingService,
    VectorService,
    RAGService,
    ChatService
)


# Singleton instances
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
            use_groq=True  # 🚀 Enable Groq for ultra-fast generation
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
