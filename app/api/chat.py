"""
Chat API Routes
Clean and simple chat endpoints with rate limiting
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from app.models.chat import ChatRequest, ChatResponse, NewsItem
from app.services import ChatService
from app.dependencies import get_chat_service
from app.middleware.rate_limiter import limiter, CHAT_RATE_LIMIT
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/message", response_model=ChatResponse)
@limiter.limit(CHAT_RATE_LIMIT)
async def send_message(
    request: Request,
    chat_request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service)
) -> ChatResponse:
    """
    Send a chat message and get AI response with RAG
    
    - **message**: User message text
    - **action_button_id**: Optional action button ID if clicked
    
    Returns:
    - AI-generated answer
    - Suggested news articles (if relevant)
    - Action buttons for quick responses
    - RAG metrics (tokens saved, response time)
    """
    try:
        logger.info(f"Chat request: {chat_request.message[:50]}...")

        result = chat_service.process_message(
            message=chat_request.message,
            action_button_id=chat_request.action_button_id
        )

        response = ChatResponse(
            answer=result['answer'],
            suggested_news=[
                NewsItem(
                    tieu_de=doc['title'],
                    tom_tat=doc['summary'],
                    chuyen_muc=doc['category'],
                    nha_dai=doc.get('source'),
                    similarity=doc.get('similarity')
                )
                for doc in result.get('documents', [])
            ],
            suggested_businesses=result.get('suggested_businesses', []),
            action_buttons=result.get('action_buttons', []),
            rag_used=result.get('rag_used', False),
            tokens_saved=result.get('tokens_saved'),
            response_time_ms=result.get('response_time_ms')
        )
        
        logger.info(f"Response sent: RAG={response.rag_used}, tokens_saved={response.tokens_saved}")
        return response
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    from app.services.api_key_manager import get_api_key_manager
    
    api_key_manager = get_api_key_manager()
    stats = api_key_manager.get_stats()
    
    return {
        "status": "healthy",
        "service": "chat",
        "rag_enabled": True,
        "api_key_rotation": {
            "enabled": True,
            "stats": stats
        }
    }
