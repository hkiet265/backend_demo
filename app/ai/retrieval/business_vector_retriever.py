"""
Semantic business search backed by real pgvector similarity search
(businesses_demo.embedding, vector(1536), HNSW cosine index) instead of
loading every row and computing cosine similarity in Python/numpy the way
SemanticBusinessService did. Text representation matches
scripts/backfill_business_embeddings.py so query-time and stored
embeddings are built the same way.
"""
import logging
from typing import Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

BUSINESS_EMBEDDING_DIMENSION = 1536  # must match businesses_demo.embedding column type


class BusinessVectorRetriever:
    def __init__(self, embedding_service: Optional[EmbeddingService] = None):
        self.embedding_service = embedding_service or EmbeddingService(
            model=settings.EMBEDDING_MODEL,
            dimension=BUSINESS_EMBEDDING_DIMENSION,
        )

    def search(
        self,
        query: str,
        top_k: int = 10,
        threshold: float = 0.35,
        filters: Optional[Dict] = None,
    ) -> List[Dict]:
        try:
            query_embedding = self.embedding_service.generate_query_embedding(query)
            embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'

            conn = psycopg2.connect(**settings.database_url)
            try:
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
                        dia_chi as address,
                        1 - (embedding <=> %s::vector) as similarity
                    FROM businesses_demo
                    WHERE embedding IS NOT NULL
                """
                params = [embedding_str]

                if filters:
                    if filters.get('region'):
                        sql += " AND vung_mien = %s"
                        params.append(filters['region'])
                    if filters.get('industry'):
                        sql += " AND nganh_nghe ILIKE %s"
                        params.append(f"%{filters['industry']}%")

                sql += " ORDER BY embedding <=> %s::vector LIMIT %s"
                params.extend([embedding_str, top_k])

                cur.execute(sql, params)
                rows = cur.fetchall()
            finally:
                conn.close()

            results = [dict(row) for row in rows if row['similarity'] >= threshold]
            logger.info(f"BusinessVectorRetriever: {len(results)}/{len(rows)} above threshold {threshold}")
            return results

        except Exception as e:
            logger.error(f"BusinessVectorRetriever search failed: {e}", exc_info=True)
            return []


_business_vector_retriever: Optional[BusinessVectorRetriever] = None


def get_business_vector_retriever() -> BusinessVectorRetriever:
    global _business_vector_retriever
    if _business_vector_retriever is None:
        _business_vector_retriever = BusinessVectorRetriever()
    return _business_vector_retriever
