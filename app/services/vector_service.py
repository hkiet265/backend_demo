"""
Vector Database Service
PostgreSQL + pgvector operations for similarity search
"""
import psycopg2
from typing import List, Dict, Optional
import logging
from .embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class VectorService:
    """Service for vector database operations"""
    
    def __init__(self, db_config: dict, embedding_service: EmbeddingService):
        """
        Initialize vector service
        
        Args:
            db_config: Database connection config
            embedding_service: Embedding service instance
        """
        self.db_config = db_config
        self.embedding_service = embedding_service
        logger.info("VectorService initialized")
    
    def similarity_search(
        self,
        query: str,
        table: str = "station_news",
        top_k: int = 5,
        threshold: float = 0.3
    ) -> List[Dict]:
        """
        Search for similar documents using vector similarity
        
        Args:
            query: Search query
            table: Table name to search
            top_k: Number of results to return
            threshold: Minimum similarity score (0-1)
        
        Returns:
            List of similar documents with metadata
        """
        try:
            
            query_embedding = self.embedding_service.generate_query_embedding(query)
            embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'

            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()

            cur.execute(f"""
                SELECT 
                    id,
                    tieu_de,
                    tom_tat,
                    chuyen_muc,
                    nha_dai,
                    created_at,
                    1 - (embedding_vector <=> %s::vector) as similarity
                FROM {table}
                WHERE embedding_vector IS NOT NULL
                ORDER BY 
                    embedding_vector <=> %s::vector,
                    created_at DESC
                LIMIT %s;
            """, (embedding_str, embedding_str, top_k))
            
            results = cur.fetchall()
            cur.close()
            conn.close()

            documents = []
            for row in results:
                similarity = row[6]
                if similarity >= threshold:
                    documents.append({
                        'id': row[0],
                        'title': row[1],
                        'summary': row[2],
                        'category': row[3],
                        'source': row[4],
                        'created_at': row[5].isoformat() if row[5] else None,
                        'similarity': round(similarity, 2)
                    })
            
            logger.info(f"Found {len(documents)} similar documents for query: {query[:50]}")
            return documents
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    def save_embedding(
        self,
        doc_id: int,
        embedding: List[float],
        table: str = "station_news"
    ) -> bool:
        """
        Save embedding vector to database
        
        Args:
            doc_id: Document ID
            embedding: Embedding vector
            table: Table name
        
        Returns:
            Success status
        """
        try:
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'
            
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()
            
            cur.execute(f"""
                UPDATE {table}
                SET embedding_vector = %s::vector
                WHERE id = %s;
            """, (embedding_str, doc_id))
            
            conn.commit()
            cur.close()
            conn.close()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to save embedding for doc {doc_id}: {e}")
            return False
    
    def get_documents_without_embeddings(
        self,
        table: str = "station_news",
        limit: int = 10
    ) -> List[Dict]:
        """
        Get documents that don't have embeddings yet
        
        Args:
            table: Table name
            limit: Max number of documents
        
        Returns:
            List of documents without embeddings
        """
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()
            
            cur.execute(f"""
                SELECT id, tieu_de, tom_tat
                FROM {table}
                WHERE embedding_vector IS NULL
                ORDER BY id
                LIMIT %s;
            """, (limit,))
            
            results = cur.fetchall()
            cur.close()
            conn.close()
            
            return [
                {'id': r[0], 'title': r[1], 'summary': r[2]}
                for r in results
            ]
            
        except Exception as e:
            logger.error(f"Failed to get documents without embeddings: {e}")
            return []
    
    def generate_missing_embeddings(self, batch_size: int = 10) -> Dict[str, int]:
        """
        Generate embeddings for documents that don't have them
        
        Args:
            batch_size: Number of documents to process
        
        Returns:
            Statistics dict with success/failure counts
        """
        docs = self.get_documents_without_embeddings(limit=batch_size)
        
        stats = {'success': 0, 'failed': 0, 'total': len(docs)}
        
        for doc in docs:
            try:
                
                text = f"{doc['title']} {doc['summary'] or ''}"

                embedding = self.embedding_service.generate_document_embedding(text)

                if self.save_embedding(doc['id'], embedding):
                    stats['success'] += 1
                    logger.info(f"✅ Generated embedding for: {doc['title'][:60]}")
                else:
                    stats['failed'] += 1
                    
            except Exception as e:
                logger.error(f"Failed for doc {doc['id']}: {e}")
                stats['failed'] += 1
        
        return stats
