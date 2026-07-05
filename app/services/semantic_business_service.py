"""
Semantic Business Search Service
Search companies using vector embeddings for semantic matching
Reuses existing embedding_service infrastructure
"""
import logging
from typing import Dict, List, Optional
import numpy as np

logger = logging.getLogger(__name__)


class SemanticBusinessService:
    """
    Semantic search for businesses using vector embeddings
    Similar to news RAG but for company data
    """
    
    def __init__(self, embedding_service):
        """
        Initialize semantic business service
        
        Args:
            embedding_service: Existing embedding service instance
        """
        self.embedding_service = embedding_service
        self._business_cache = {}  # {company_id: vector}
        self._indexed = False
        logger.info("SemanticBusinessService initialized")
    
    def semantic_search(
        self,
        query: str,
        top_k: int = 10,
        threshold: float = 0.3,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Semantic search for businesses
        
        Args:
            query: Search query
            top_k: Number of results
            threshold: Minimum similarity score
            filters: Optional filters (region, industry)
            
        Returns:
            List of matching businesses with similarity scores
        """
        try:
            logger.info(f"Semantic business search: {query}")
            
            # Get all businesses from database
            businesses = self._get_all_businesses(filters)
            
            if not businesses:
                return []
            
            # Generate query embedding
            query_vector = self.embedding_service.generate_embeddings(query)
            if query_vector is None:
                logger.error("Failed to generate query embedding")
                return []
            
            # Calculate similarities
            results = []
            for business in businesses:
                # Generate business text representation
                business_text = self._business_to_text(business)
                
                # Get or generate business vector
                business_vector = self._get_business_vector(business['id'], business_text)
                
                if business_vector is not None:
                    # Calculate cosine similarity
                    similarity = self._cosine_similarity(query_vector, business_vector)
                    
                    if similarity >= threshold:
                        results.append({
                            'id': business['id'],
                            'name': business['name'],
                            'phone': business.get('phone'),
                            'location': business.get('location'),
                            'region': business.get('region'),
                            'industry': business.get('industry'),
                            'description': business.get('description', ''),
                            'similarity': float(similarity)
                        })
            
            # Sort by similarity (descending)
            results.sort(key=lambda x: x['similarity'], reverse=True)
            
            logger.info(f"Found {len(results)} businesses above threshold {threshold}")
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Semantic business search failed: {e}", exc_info=True)
            return []
    
    def _get_all_businesses(self, filters: Optional[Dict] = None) -> List[Dict]:
        """Get all businesses from database with optional filters"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            from app.config import settings
            
            conn = psycopg2.connect(**settings.database_url)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            sql = """
                SELECT 
                    id,
                    ten_doanh_nghiep as name,
                    so_dien_thoai as phone,
                    tinh_thanh as location,
                    vung_mien as region,
                    nganh_nghe as industry,
                    website,
                    email,
                    dia_chi as address
                FROM businesses_demo
                WHERE 1=1
            """
            params = []
            
            # Apply filters
            if filters:
                if filters.get('region'):
                    sql += " AND vung_mien = %s"
                    params.append(filters['region'])
                
                if filters.get('industry'):
                    sql += " AND nganh_nghe ILIKE %s"
                    params.append(f"%{filters['industry']}%")
            
            sql += " ORDER BY updated_at DESC LIMIT 500"  # Limit for performance
            
            cur.execute(sql, params)
            businesses = cur.fetchall()
            
            cur.close()
            conn.close()
            
            logger.info(f"Retrieved {len(businesses)} businesses from database")
            return businesses
            
        except Exception as e:
            logger.error(f"Failed to get businesses: {e}")
            return []
    
    def _business_to_text(self, business: Dict) -> str:
        """
        Convert business data to text representation for embedding
        
        Args:
            business: Business dict
            
        Returns:
            Text representation
        """
        parts = []
        
        # Company name (most important)
        if business.get('name'):
            parts.append(f"Công ty: {business['name']}")
        
        # Industry
        if business.get('industry'):
            parts.append(f"Ngành nghề: {business['industry']}")
        
        # Location
        if business.get('location'):
            parts.append(f"Địa điểm: {business['location']}")
        
        if business.get('region'):
            parts.append(f"Khu vực: {business['region']}")
        
        # Contact info
        if business.get('phone'):
            parts.append(f"Điện thoại: {business['phone']}")
        
        if business.get('email'):
            parts.append(f"Email: {business['email']}")
        
        # Address
        if business.get('address'):
            parts.append(f"Địa chỉ: {business['address']}")
        
        return ". ".join(parts)
    
    def _get_business_vector(self, business_id: int, business_text: str) -> Optional[np.ndarray]:
        """
        Get or generate vector for business
        Uses cache to avoid regenerating
        """
        # Check cache
        if business_id in self._business_cache:
            return self._business_cache[business_id]
        
        # Generate new vector
        vector = self.embedding_service.generate_embeddings(business_text)
        
        if vector is not None:
            # Cache it
            self._business_cache[business_id] = vector
        
        return vector
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Returns:
            Similarity score (0-1)
        """
        try:
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return max(0.0, min(1.0, similarity))  # Clamp to [0, 1]
            
        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0
    
    def clear_cache(self):
        """Clear vector cache"""
        self._business_cache.clear()
        logger.info("Business vector cache cleared")
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        return {
            'cached_businesses': len(self._business_cache),
            'cache_size_mb': len(str(self._business_cache)) / (1024 * 1024)
        }


# Global instance
_semantic_business_service = None


def get_semantic_business_service():
    """Get or create semantic business service singleton"""
    global _semantic_business_service
    if _semantic_business_service is None:
        from app.services.embedding_service import get_embedding_service
        embedding_service = get_embedding_service()
        _semantic_business_service = SemanticBusinessService(embedding_service)
    return _semantic_business_service
