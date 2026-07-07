"""
Thin adapter over the existing VectorService (already pgvector-backed for
station_news) so the pipeline talks to a NewsVectorRetriever like it talks
to BusinessVectorRetriever, without reimplementing news vector search.
"""
import logging
from typing import Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)


class NewsVectorRetriever:
    def __init__(self, vector_service: VectorService):
        self.vector_service = vector_service

    def search(self, query: str, top_k: int = 5, threshold: float = 0.3) -> List[Dict]:
        return self.vector_service.similarity_search(query=query, top_k=top_k, threshold=threshold)

    def list_recent(self, limit: int = 5) -> List[Dict]:
        """
        Plain "most recent news" listing, no embeddings — for generic
        requests like "hôm nay có tin gì thú vị" that carry no topical
        content for vector similarity to match against (every article
        scores similarly low, so the threshold filters everything out even
        though the site clearly has news). Same fallback shape as
        SQLBusinessRetriever.list_by_filters() for businesses.
        """
        try:
            conn = psycopg2.connect(**settings.database_url)
            try:
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("""
                    SELECT id, tieu_de, tom_tat, chuyen_muc, nha_dai, created_at
                    FROM station_news
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (limit,))
                rows = cur.fetchall()
            finally:
                conn.close()

            return [
                {
                    'id': r['id'],
                    'title': r['tieu_de'],
                    'summary': r['tom_tat'],
                    'category': r['chuyen_muc'],
                    'source': r['nha_dai'],
                    'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                }
                for r in rows
            ]
        except Exception as e:
            logger.error(f"NewsVectorRetriever.list_recent failed: {e}")
            return []


NEWS_EMBEDDING_DIMENSION = 3072  # must match station_news.embedding_vector column type

_news_vector_retriever: Optional[NewsVectorRetriever] = None


def get_news_vector_retriever() -> NewsVectorRetriever:
    global _news_vector_retriever
    if _news_vector_retriever is None:
        # NOT app.dependencies.get_vector_service() — that one is wired to the
        # shared EmbeddingService at settings.EMBEDDING_DIMENSION (768), but
        # station_news.embedding_vector is vector(3072). Every query through
        # the shared instance raised "different vector dimensions 3072 and
        # 768" and silently returned [] — news vector search has never
        # actually worked. Dedicated instance here, same fix pattern as
        # BusinessVectorRetriever's dedicated 1536-dim EmbeddingService.
        from app.services.embedding_service import EmbeddingService
        from app.config import settings as app_settings

        embedding_service = EmbeddingService(
            model=app_settings.EMBEDDING_MODEL,
            dimension=NEWS_EMBEDDING_DIMENSION,
        )
        vector_service = VectorService(
            db_config=app_settings.database_url,
            embedding_service=embedding_service,
        )
        _news_vector_retriever = NewsVectorRetriever(vector_service)
    return _news_vector_retriever
