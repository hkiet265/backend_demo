"""
Retrieval Planning layer.

Takes a QueryUnderstanding and decides WHICH data sources are needed —
it never calls a retriever itself. That separation is the whole point:
this is where "does this need SQL, vector search, or both" gets decided,
instead of being buried in if/elif branches next to the SQL calls
(as it was in HybridChatService.process_message / _handle_*_query).
"""
from pydantic import BaseModel

from app.ai.understanding.schemas import QueryUnderstanding


class RetrievalPlan(BaseModel):
    need_sql_exact: bool = False       # phone / exact company name lookup
    need_business_vector: bool = False  # semantic business search
    need_news_vector: bool = False      # semantic news search (RAG)
    need_conversation_context: bool = False  # reuse businesses/news from last turn
    top_k: int = 10
    threshold: float = 0.35


class RetrievalPlanner:
    def plan(self, understanding: QueryUnderstanding) -> RetrievalPlan:
        topic = understanding.topic
        operation = understanding.operation

        if operation in ("followup_reasoning", "followup_lookup"):
            return RetrievalPlan(need_conversation_context=True, top_k=understanding.constraints.limit)

        if topic == "conversation" or operation in ("greeting", "smalltalk"):
            return RetrievalPlan()

        if operation == "lookup_exact" and topic == "business":
            return RetrievalPlan(need_sql_exact=True, top_k=understanding.constraints.limit)

        need_business = topic in ("business", "mixed") and operation in ("search", "recommend", "compare")
        need_news = topic in ("news", "mixed") and operation in ("search", "recommend", "compare")

        return RetrievalPlan(
            need_business_vector=need_business,
            need_news_vector=need_news,
            top_k=understanding.constraints.limit,
        )


_retrieval_planner: RetrievalPlanner = None


def get_retrieval_planner() -> RetrievalPlanner:
    global _retrieval_planner
    if _retrieval_planner is None:
        _retrieval_planner = RetrievalPlanner()
    return _retrieval_planner
