"""
Structured output of the Query Understanding layer.

This replaces the free-text "complexity" heuristic that used to live in
HybridChatService._classify_query(). Every downstream layer (planning,
retrieval, fusion, generation) consumes this object instead of re-parsing
the raw message.
"""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

Topic = Literal["business", "jobs", "news", "conversation", "mixed"]

Operation = Literal[
    "lookup_exact",       # exact company name / phone lookup
    "search",             # fuzzy/semantic search (industry, region, quality)
    "recommend",          # "gợi ý", "tư vấn"
    "compare",            # "so sánh X và Y"
    "followup_reasoning", # "cái nào tốt nhất trong đó" referring to prior turn
    "followup_lookup",    # "số điện thoại của nó" referring to prior turn
    "greeting",
    "smalltalk",
]


class Entities(BaseModel):
    industry: Optional[str] = None
    location: Optional[str] = None
    region: Optional[str] = None  # Bắc / Trung / Nam
    company_name: Optional[str] = None
    phone: Optional[str] = None
    # Populated for operation="compare" ("so sánh X và Y") — company_name
    # alone can't hold two names, and generic semantic search over the raw
    # question text isn't reliable for surfacing two SPECIFIC named
    # companies (see retrieval_planner.py's compare branch).
    company_names: List[str] = Field(default_factory=list)


class Constraints(BaseModel):
    limit: int = 10
    criteria: List[str] = Field(default_factory=list)  # e.g. "reputation", "salary", "stability"


class QueryUnderstanding(BaseModel):
    raw_query: str
    topic: Topic
    operation: Operation
    entities: Entities = Field(default_factory=Entities)
    constraints: Constraints = Field(default_factory=Constraints)
    is_followup: bool = False
    confidence: float = 0.5
    parsed_by: Literal["heuristic", "llm"] = "heuristic"
