"""
Embedding Service
Generate embeddings using Google Gemini with API Key Manager
"""
import google.generativeai as genai
from typing import List
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text embeddings"""
    
    def __init__(self, api_key: str = None, model: str = "gemini-embedding-2", dimension: int = 768):
        """
        Initialize embedding service
        
        Args:
            api_key: Google Gemini API key (legacy, dùng api_key_manager thay thế)
            model: Embedding model name (gemini-embedding-2 or gemini-embedding-001)
            dimension: Vector dimension size (768 recommended for storage optimization)
        """
        # Use API Key Manager for rotation support
        from app.services.api_key_manager import get_api_key_manager
        self.api_key_manager = get_api_key_manager()
        self.api_key_manager.configure_genai()
        
        self.genai = genai
        self.model = model
        self.dimension = dimension
        logger.info(f"✅ EmbeddingService initialized: model={model}, dim={dimension}, with API Key Manager")
    
    def generate(self, text: str, task_type: str = "retrieval_document") -> List[float]:
        """
        Generate embedding for text using Gemini Embedding 2
        
        Args:
            text: Input text
            task_type: Task type (ignored for gemini-embedding-2)
        
        Returns:
            Embedding vector (list of floats)
        """
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                # For gemini-embedding-2, format text with task instruction
                if self.model == "gemini-embedding-2":
                    formatted_text = f"task: search result | query: {text}"
                else:
                    formatted_text = text
                
                # Use simple embed_content call (no config parameter for old API)
                result = self.genai.embed_content(
                    model=self.model,
                    content=formatted_text
                )
                
                # Extract embedding from result
                if isinstance(result, dict) and 'embedding' in result:
                    embedding = result['embedding']
                elif hasattr(result, 'embedding'):
                    embedding = result.embedding
                else:
                    logger.error(f"Unexpected result format: {type(result)}")
                    return [0.0] * self.dimension
                
                # Truncate to desired dimension if needed
                if len(embedding) > self.dimension:
                    embedding = embedding[:self.dimension]
                elif len(embedding) < self.dimension:
                    # Pad with zeros if too short
                    embedding = embedding + [0.0] * (self.dimension - len(embedding))
                
                return embedding
                
            except Exception as e:
                error_str = str(e).lower()
                
                # Handle quota errors with key rotation
                if "quota" in error_str or "429" in error_str or "resource_exhausted" in error_str:
                    if attempt < max_retries - 1:
                        logger.warning(f"⚠️ Embedding quota exceeded, rotating key...")
                        
                        # Mark current key as exhausted and rotate
                        current_key = self.api_key_manager.get_current_key()
                        self.api_key_manager.mark_key_quota_exceeded(current_key, retry_after=60)
                        
                        # Reconfigure with new key
                        self.api_key_manager.configure_genai()
                        
                        logger.info(f"🔄 Retrying with new key...")
                        continue
                
                logger.error(f"Embedding generation failed: {e}")
                
                if attempt < max_retries - 1:
                    continue
                    
                # Return zero vector on final failure
                return [0.0] * self.dimension
        
        return [0.0] * self.dimension
    
    def generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for search query"""
        return self.generate(query, task_type="retrieval_query")
    
    def generate_document_embedding(self, text: str) -> List[float]:
        """Generate embedding for document"""
        return self.generate(text, task_type="retrieval_document")
    
    def generate_embeddings(self, text: str) -> List[float]:
        """Alias for generate_document_embedding (compatibility)"""
        return self.generate_document_embedding(text)


# Singleton instance
_embedding_service = None


def get_embedding_service():
    """Get or create embedding service singleton"""
    global _embedding_service
    if _embedding_service is None:
        from app.config import settings
        _embedding_service = EmbeddingService(
            api_key=None,  # Use API Key Manager instead
            model=settings.EMBEDDING_MODEL,
            dimension=768  # Standard dimension for embeddings
        )
    return _embedding_service
