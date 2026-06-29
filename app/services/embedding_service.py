"""
Embedding Service
Generate embeddings using Google Gemini
"""
import google.generativeai as genai
from typing import List
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text embeddings"""
    
    def __init__(self, api_key: str, model: str = "models/gemini-embedding-001", dimension: int = 3072):
        """
        Initialize embedding service
        
        Args:
            api_key: Google Gemini API key
            model: Embedding model name
            dimension: Vector dimension size
        """
        genai.configure(api_key=api_key)
        self.genai = genai
        self.model = model
        self.dimension = dimension
        logger.info(f"EmbeddingService initialized: model={model}, dim={dimension}")
    
    def generate(self, text: str, task_type: str = "retrieval_document") -> List[float]:
        """
        Generate embedding for text
        
        Args:
            text: Input text
            task_type: "retrieval_document" or "retrieval_query"
        
        Returns:
            Embedding vector (list of floats)
        """
        try:
            result = self.genai.embed_content(
                model=self.model,
                content=text,
                task_type=task_type
            )
            return result['embedding']
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")

            return [0.0] * self.dimension
    
    def generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for search query"""
        return self.generate(query, task_type="retrieval_query")
    
    def generate_document_embedding(self, text: str) -> List[float]:
        """Generate embedding for document"""
        return self.generate(text, task_type="retrieval_document")
