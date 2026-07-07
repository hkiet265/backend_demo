"""
Knowledge Fusion layer: merge, dedupe, and rank raw retriever output into
a single Evidence object.

This replaces the manual string-concatenation that used to happen inline
in HybridChatService._handle_complex_query (building the answer text by
gluing RAG output and semantic-search output together with f-strings).
Fusion here only touches data, never text — Response Generation is the
only layer allowed to produce the final answer string.
"""
import logging
from typing import Dict, List

from .evidence import Evidence

logger = logging.getLogger(__name__)


def _dedupe_by_id(items: List[Dict], score_key: str = 'similarity') -> List[Dict]:
    best_by_id: Dict[object, Dict] = {}
    for item in items:
        item_id = item.get('id')
        if item_id is None:
            # No id to dedupe on (e.g. hand-built fallback rows) — keep as-is
            best_by_id[id(item)] = item
            continue
        existing = best_by_id.get(item_id)
        if existing is None or item.get(score_key, 0) > existing.get(score_key, 0):
            best_by_id[item_id] = item
    return list(best_by_id.values())


class KnowledgeFusion:
    def fuse(
        self,
        businesses: List[Dict] = None,
        news: List[Dict] = None,
        top_k_business: int = 10,
        top_k_news: int = 5,
        source_methods: List[str] = None,
    ) -> Evidence:
        businesses = businesses or []
        news = news or []

        deduped_businesses = _dedupe_by_id(businesses)
        deduped_businesses.sort(key=lambda b: b.get('similarity', 0), reverse=True)

        deduped_news = _dedupe_by_id(news)
        deduped_news.sort(key=lambda n: n.get('similarity', 0), reverse=True)

        evidence = Evidence(
            businesses=deduped_businesses[:top_k_business],
            news=deduped_news[:top_k_news],
            source_methods=source_methods or [],
        )
        logger.info(
            f"KnowledgeFusion: {len(evidence.businesses)} businesses, "
            f"{len(evidence.news)} news (from {len(businesses)}/{len(news)} raw)"
        )
        return evidence


_knowledge_fusion: KnowledgeFusion = None


def get_knowledge_fusion() -> KnowledgeFusion:
    global _knowledge_fusion
    if _knowledge_fusion is None:
        _knowledge_fusion = KnowledgeFusion()
    return _knowledge_fusion
