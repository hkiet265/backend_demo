"""
RAG Service
Orchestrates Retrieval-Augmented Generation for chat
"""
import google.generativeai as genai
from typing import List, Dict, Optional
import logging
import time
from .vector_service import VectorService
from .api_key_manager import get_api_key_manager

logger = logging.getLogger(__name__)


class RAGService:
    """RAG (Retrieval-Augmented Generation) Service"""
    
    def __init__(
        self,
        vector_service: VectorService,
        gemini_api_key: str,
        chat_model: str = "gemini-2.5-flash",
        use_groq: bool = False
    ):
        """
        Initialize RAG service
        
        Args:
            vector_service: Vector database service
            gemini_api_key: Google Gemini API key (legacy, không dùng nữa)
            chat_model: Chat model name
            use_groq: Use Groq for generation (ultra-fast)
        """
        # Sử dụng API Key Manager thay vì key trực tiếp
        self.api_key_manager = get_api_key_manager()
        self.api_key_manager.configure_genai()
        
        self.chat_model = chat_model
        self.model = genai.GenerativeModel(chat_model)
        self.vector_service = vector_service
        self.use_groq = use_groq
        
        # Initialize Groq service if enabled
        if use_groq:
            from .groq_service import get_groq_service
            self.groq_service = get_groq_service()
            if self.groq_service:
                logger.info(f"🚀 RAG using Groq for generation (ultra-fast)")
            else:
                logger.warning("⚠️ Groq service unavailable, falling back to Gemini")
                self.use_groq = False
        else:
            self.groq_service = None
            logger.info("🐢 RAG using Gemini for generation")
        
        logger.info(f"RAGService initialized with model: {chat_model}")
        logger.info(f"API Key Manager stats: {self.api_key_manager.get_stats()}")
    
    def chat(
        self,
        query: str,
        top_k: int = 5,
        threshold: float = 0.3
    ) -> Dict:
        """
        Process chat query with RAG
        
        Args:
            query: User query
            top_k: Number of documents to retrieve
            threshold: Minimum similarity threshold
        
        Returns:
            Dict with answer, documents, and metrics
        """
        start_time = time.time()
        
        # Step 1: Retrieve relevant documents
        logger.info(f"RAG Query: {query}")
        documents = self.vector_service.similarity_search(
            query=query,
            top_k=top_k,
            threshold=threshold
        )
        
        if not documents:
            return {
                'answer': "Em Tư không tìm thấy thông tin liên quan",
                'documents': [],
                'rag_used': True,
                'tokens_saved': 0,
                'response_time_ms': (time.time() - start_time) * 1000
            }
        
        # Step 2: Build compact context
        context = self._build_context(documents)
        
        # Step 3: Generate response
        answer = self._generate_response(query, context)
        
        # Step 4: Calculate metrics
        tokens_saved = self._estimate_token_savings(len(documents))
        response_time = (time.time() - start_time) * 1000
        
        return {
            'answer': answer,
            'documents': documents,
            'rag_used': True,
            'tokens_saved': tokens_saved,
            'response_time_ms': round(response_time, 2)
        }
    
    def _build_context(self, documents: List[Dict]) -> str:
        """
        Build compact context from retrieved documents
        
        Args:
            documents: List of retrieved documents
        
        Returns:
            Formatted context string
        """
        context_parts = []
        for i, doc in enumerate(documents, 1):
            context_parts.append(
                f"Tin {i}: {doc['title']}\n"
                f"Nội dung: {doc['summary'][:200] if doc['summary'] else ''}\n"
                f"Nguồn: {doc['source']}, Chuyên mục: {doc['category']}"
            )
        return "\n\n".join(context_parts)
    
    def _generate_response(self, query: str, context: str) -> str:
        """
        Generate AI response using query + context
        AUTO-RETRY with Groq (fast) → Gemini (fallback)
        
        Args:
            query: User query
            context: Retrieved context
        
        Returns:
            Generated answer
        """
        # System prompt định nghĩa nhân cách AI
        system_prompt = """Bạn là Em Tư, trợ lý AI thông minh và thân thiện của hệ thống tin tức.

Nhiệm vụ:
1. Trả lời câu hỏi người dùng dựa trên thông tin tin tức được cung cấp
2. Tóm tắt ngắn gọn, dễ hiểu, tự nhiên như người thật
3. Nếu có nhiều tin liên quan, liệt kê ngắn gọn
4. Luôn thân thiện, dùng emoji phù hợp

Quy tắc:
- KHÔNG bịa thông tin không có trong context
- KHÔNG trả lời câu hỏi ngoài phạm vi tin tức
- Nếu không có thông tin, nói rõ "Em không tìm thấy tin tức về..."
- Độ dài: 2-4 câu ngắn gọn
"""
        
        # User prompt với context
        user_prompt = f"""Câu hỏi: {query}

Thông tin tin tức liên quan:
{context}

Hãy trả lời câu hỏi dựa trên thông tin trên."""

        # Try Groq first (nhanh, miễn phí)
        if self.use_groq and self.groq_service:
            logger.info("🚀 Using Groq for generation...")
            answer = self.groq_service.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.7,
                max_tokens=2048
            )
            
            if answer:
                return answer
            
            logger.warning("⚠️ Groq failed, falling back to Gemini...")
        
        # Fallback to Gemini (chậm nhưng reliable)
        logger.info("🐢 Using Gemini for generation...")
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(
                    [system_prompt, user_prompt],
                    generation_config={
                        'temperature': 0.7,
                        'max_output_tokens': 2048,
                        'top_p': 0.9,
                    }
                )
                
                answer = response.text.strip()
                
                # Fallback nếu AI không trả lời
                if not answer or len(answer) < 10:
                    return "Dưới đây là thông tin bạn muốn tìm kiếm:"
                
                return answer
                
            except Exception as e:
                error_str = str(e)
                
                # Check nếu là quota exceeded
                if "429" in error_str or "quota" in error_str.lower():
                    logger.warning(f"⚠️ Quota exceeded (attempt {attempt + 1}/{max_retries})")
                    
                    # Extract retry_after nếu có
                    retry_after = 60  # Default 60s
                    if "retry in" in error_str.lower():
                        try:
                            import re
                            match = re.search(r'(\d+\.?\d*)s', error_str)
                            if match:
                                retry_after = int(float(match.group(1)))
                        except:
                            pass
                    
                    # Mark key và rotate
                    current_key = self.api_key_manager.get_current_key()
                    self.api_key_manager.mark_key_quota_exceeded(current_key, retry_after)
                    
                    # Reconfigure với key mới
                    self.api_key_manager.configure_genai()
                    self.model = genai.GenerativeModel(self.chat_model)
                    
                    logger.info(f"🔄 Rotated to new key, retrying...")
                    continue  # Retry với key mới
                
                # Lỗi khác (không phải quota)
                logger.error(f"AI generation error: {e}")
                if attempt < max_retries - 1:
                    logger.info(f"Retrying... (attempt {attempt + 2}/{max_retries})")
                    continue
                
                # Hết retries, fallback
                return "Dưới đây là thông tin bạn muốn tìm kiếm:"
        
        # Không nên tới đây, nhưng just in case
        return "Dưới đây là thông tin bạn muốn tìm kiếm:"
    
    def _estimate_token_savings(self, num_docs: int) -> int:
        """
        Estimate tokens saved by using RAG
        
        Args:
            num_docs: Number of documents retrieved
        
        Returns:
            Estimated tokens saved
        """
        # Assumptions:
        # - Full database: ~1000 documents
        # - Average tokens per doc: 500
        # - RAG: only send top_k docs
        
        full_db_size = 1000
        avg_tokens_per_doc = 500
        
        full_tokens = full_db_size * avg_tokens_per_doc
        rag_tokens = num_docs * avg_tokens_per_doc
        
        return full_tokens - rag_tokens
