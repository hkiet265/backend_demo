"""
Chat Models
Request/Response models for chat functionality
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class ActionButton(BaseModel):
    """Action button for quick responses"""
    id: str = Field(..., description="Button ID")
    label: str = Field(..., description="Button label")
    emoji: str = Field(..., description="Button emoji")


class ChatRequest(BaseModel):
    """Chat request from user"""
    message: str = Field(..., min_length=1, description="User message")
    session_id: Optional[str] = Field(None, description="Conversation session ID")
    action_button_id: Optional[str] = Field(None, description="Clicked action button ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "tin về vàng",
                "session_id": "uuid-here",
                "action_button_id": None
            }
        }


class NewsItem(BaseModel):
    """Single news item"""
    tieu_de: str
    tom_tat: str
    chuyen_muc: str
    nha_dai: Optional[str] = None
    similarity: Optional[float] = None


class BusinessItem(BaseModel):
    """Single business item"""
    id: int
    name: str
    phone: Optional[str] = None
    region: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None


class JobItem(BaseModel):
    """Single job-listing item (job_vector_retriever.py result shape)"""
    id: int
    title: str
    company_name: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    industry: Optional[str] = None
    similarity: Optional[float] = None


class ChatResponse(BaseModel):
    """Chat response with RAG information and conversation memory"""
    answer: str = Field(..., description="AI-generated answer")
    suggested_news: List[NewsItem] = Field(default_factory=list)
    suggested_businesses: List[BusinessItem] = Field(default_factory=list)
    suggested_jobs: List[JobItem] = Field(default_factory=list)
    followup_suggestions: List[str] = Field(default_factory=list, description="Follow-up question suggestions")
    action_buttons: List[ActionButton] = Field(default_factory=list)
    
    # RAG Metrics
    rag_used: bool = Field(default=False, description="Whether RAG was used")
    tokens_saved: Optional[int] = Field(None, description="Estimated tokens saved by RAG")
    response_time_ms: Optional[float] = Field(None, description="Response time in milliseconds")
    
    # Conversation
    session_id: Optional[str] = Field(None, description="Conversation session ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "answer": "Theo 3 nguồn tin gần đây, giá vàng...",
                "suggested_news": [],
                "suggested_businesses": [],
                "followup_suggestions": ["Giá vàng hôm nay?", "Dự báo giá vàng"],
                "action_buttons": [],
                "rag_used": True,
                "tokens_saved": 498500,
                "session_id": "uuid-here"
            }
        }
