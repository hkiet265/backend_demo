"""
Chat API Routes
Clean and simple chat endpoints with rate limiting and conversation memory
Uses HYBRID architecture: Rules (fast/free) + AI (smart/flexible)
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from app.models.chat import ChatRequest, ChatResponse, NewsItem
from app.dependencies import get_hybrid_service, get_current_user, get_current_user_optional
from app.services.conversation_service import get_conversation_service
from app.middleware.rate_limiter import limiter, CHAT_RATE_LIMIT
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/message", response_model=ChatResponse)
@limiter.limit(CHAT_RATE_LIMIT)
async def send_message(
    request: Request,
    chat_request: ChatRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)  # ← Optional auth
) -> ChatResponse:
    """
    🎯 HYBRID CHAT: Intelligent routing between Rules + AI
    
    **Authentication Optional** - Works for both anonymous and logged-in users
    - Anonymous: user_id = None
    - Logged-in: user_id from JWT token
    
    Architecture:
    - SIMPLE queries (name, phone) → Direct SQL (fast, free)
    - SEMANTIC queries (industry, fuzzy) → AI embeddings + SQL  
    - COMPLEX queries (multi-step) → Full AI function calling
    - CONVERSATIONAL (greetings) → Static responses
    
    Benefits:
    - 70% cost reduction vs full AI
    - 2-3x faster for simple queries
    - Smart caching layer
    - Graceful degradation on AI failures
    
    - **message**: User message text
    - **session_id**: Optional session ID for conversation memory
    
    Returns:
    - Answer with appropriate complexity routing
    - Suggested news articles (if relevant)
    - Suggested businesses (if relevant)
    - Follow-up suggestions
    - session_id for conversation continuity
    """
    try:
        # Get user_id (None for anonymous)
        user_id = current_user.get('id') if current_user else None
        
        # Get or create session_id
        session_id = chat_request.session_id
        if not session_id:
            session_id = str(uuid.uuid4())
            if user_id:
                logger.info(f"🆕 HYBRID Chat - New session: {session_id} (User: {user_id})")
            else:
                logger.info(f"🆕 HYBRID Chat - New session: {session_id} (Anonymous)")
        
        logger.info(f"🎯 HYBRID CHAT REQUEST (Session: {session_id}, User: {user_id or 'anonymous'})")
        logger.info(f"📝 Message: {chat_request.message[:100]}")
        
        # Get conversation service
        conv_service = get_conversation_service()
        
        # Add user message to history
        conv_service.add_message(
            session_id=session_id,
            role="user",
            content=chat_request.message,
            user_id=user_id  # ← Can be None for anonymous
        )
        
        # Get conversation history for context. Past 20 turns, older messages
        # are collapsed into a cached summary instead of just falling off the
        # window entirely — see ConversationService.get_effective_history.
        history = conv_service.get_effective_history(
            session_id=session_id,
            user_id=user_id,  # ← Can be None
        )
        
        # Process with HYBRID Chat Service
        hybrid_service = get_hybrid_service()
        
        result = hybrid_service.process_message(
            message=chat_request.message,
            session_id=session_id,
            history=history,
            action_button_id=chat_request.action_button_id  # ← Pass button action!
        )
        
        # Save assistant response with context
        conv_service.add_message(
            session_id=session_id,
            role="assistant",
            content=result['answer'],
            user_id=user_id,  # ← Can be None
            context={
                'documents': result.get('documents', []),
                'suggested_businesses': result.get('suggested_businesses', []),
                'suggested_jobs': result.get('suggested_jobs', []),
                'complexity': result.get('complexity'),
                'search_method': result.get('search_method'),
                'hybrid_powered': True
            },
            complexity=result.get('complexity'),
            response_time_ms=result.get('response_time_ms')
        )
        
        logger.info(f"✅ HYBRID RESPONSE: complexity={result.get('complexity')}, "
                   f"businesses={len(result.get('suggested_businesses', []))}, "
                   f"docs={len(result.get('documents', []))}, "
                   f"time={result.get('response_time_ms')}ms")

        response = ChatResponse(
            answer=result['answer'],
            suggested_news=[
                NewsItem(
                    tieu_de=doc.get('title', ''),
                    tom_tat=doc.get('summary', ''),
                    chuyen_muc=doc.get('category', ''),
                    nha_dai=doc.get('source'),
                    similarity=doc.get('similarity')
                )
                for doc in result.get('documents', [])
            ],
            suggested_businesses=result.get('suggested_businesses', []),
            suggested_jobs=result.get('suggested_jobs', []),
            followup_suggestions=result.get('followup_suggestions', [
                'Tìm công ty khác',
                'Thông tin chi tiết',
                'Tin tức liên quan'
            ]),
            action_buttons=result.get('action_buttons', []),
            rag_used=result.get('rag_used', False),
            tokens_saved=result.get('tokens_saved'),
            response_time_ms=result.get('response_time_ms'),
            session_id=session_id
        )
        
        logger.info(f"✨ Hybrid Response sent: session={session_id}")
        return response
        
    except Exception as e:
        logger.error(f"❌ HYBRID CHAT ERROR: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Hybrid chat failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    from app.services.api_key_manager import get_api_key_manager
    from app.services.groq_service import get_groq_service
    
    api_key_manager = get_api_key_manager()
    gemini_stats = api_key_manager.get_stats()
    
    groq_service = get_groq_service()
    groq_stats = groq_service.get_stats() if groq_service else {'status': 'disabled'}
    
    return {
        "status": "healthy",
        "service": "chat",
        "architecture": "hybrid",
        "rag_enabled": True,
        "api_key_rotation": {
            "enabled": True,
            "gemini": gemini_stats,
            "groq": groq_stats
        }
    }


@router.get("/metrics")
async def get_metrics():
    """
    Get hybrid chat performance metrics
    
    Returns:
    - Query distribution by complexity
    - Cache hit rate
    - Cost savings estimate
    - Response time stats
    """
    try:
        hybrid_service = get_hybrid_service()
        metrics = hybrid_service.get_metrics()
        
        # Calculate cost savings estimate
        total = metrics.get('total_queries', 1)
        ai_queries = metrics.get('ai_queries', 0)
        ai_percent = (ai_queries / total * 100) if total > 0 else 0
        cost_savings_percent = 100 - ai_percent
        
        return {
            "status": "ok",
            "metrics": metrics,
            "insights": {
                "cost_savings_estimate": f"{cost_savings_percent:.1f}%",
                "ai_usage": f"{ai_percent:.1f}%",
                "cache_efficiency": f"{metrics.get('cache_hit_rate', 0):.1f}%"
            }
        }
    except Exception as e:
        logger.error(f"❌ Get metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/conversation/{session_id}")
async def clear_conversation(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Clear conversation history for a session
    
    Works for both anonymous and logged-in users:
    - Anonymous: Clears all messages in session
    - Logged-in: Clears only user's messages in session
    """
    try:
        user_id = current_user.get('id') if current_user else None
        conv_service = get_conversation_service()
        deleted = conv_service.clear_conversation(session_id, user_id)
        
        if user_id:
            logger.info(f"🗑️ Cleared conversation: {session_id} (User: {user_id})")
        else:
            logger.info(f"🗑️ Cleared conversation: {session_id} (Anonymous)")
        
        return {
            "message": "Conversation cleared successfully",
            "session_id": session_id,
            "deleted_messages": deleted
        }
    except Exception as e:
        logger.error(f"❌ Clear conversation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/{session_id}/stats")
async def get_conversation_stats(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get conversation statistics
    
    Works for both anonymous and logged-in users
    """
    try:
        user_id = current_user.get('id') if current_user else None
        conv_service = get_conversation_service()
        history = conv_service.get_conversation_history(session_id, user_id)
        
        return {
            "session_id": session_id,
            "message_count": len(history),
            "first_message_at": history[0]['timestamp'] if history else None,
            "last_message_at": history[-1]['timestamp'] if history else None
        }
    except Exception as e:
        logger.error(f"❌ Get stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/my")
async def get_my_conversations(
    current_user: dict = Depends(get_current_user),
    limit: int = 10
):
    """
    Get MY conversation list
    
    Returns list of sessions for the authenticated user
    """
    try:
        user_id = current_user.get('id')
        conv_service = get_conversation_service()
        sessions = conv_service.get_user_conversations(user_id, limit)
        
        return {
            "user_id": user_id,
            "sessions": sessions,
            "count": len(sessions)
        }
    except Exception as e:
        logger.error(f"❌ Get my conversations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/user/{user_id}")
async def get_user_conversations(
    user_id: int,
    limit: int = 10
):
    """
    Get list of conversations for a user
    
    Returns list of sessions with preview
    """
    try:
        conv_service = get_conversation_service()
        sessions = conv_service.get_user_conversations(user_id, limit)
        
        return {
            "user_id": user_id,
            "sessions": sessions,
            "count": len(sessions)
        }
    except Exception as e:
        logger.error(f"❌ Get user conversations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/cleanup")
async def cleanup_old_conversations(days: int = 30):
    """
    Cleanup conversations older than specified days
    
    Admin endpoint
    """
    try:
        conv_service = get_conversation_service()
        deleted = conv_service.cleanup_old_conversations(days)
        
        return {
            "status": "success",
            "deleted_messages": deleted,
            "threshold_days": days
        }
    except Exception as e:
        logger.error(f"❌ Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/global")
async def get_global_stats():
    """Get global chat statistics"""
    try:
        conv_service = get_conversation_service()
        stats = conv_service.get_stats()
        
        return {
            "status": "success",
            "stats": stats
        }
    except Exception as e:
        logger.error(f"❌ Get global stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

