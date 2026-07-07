"""
Evidence: the normalized output of the Knowledge Fusion layer. Response
Generation consumes only this object — it never sees raw retriever output
or touches SQL/vector search itself.
"""
from typing import Dict, List
from pydantic import BaseModel, Field


class Evidence(BaseModel):
    businesses: List[Dict] = Field(default_factory=list)
    news: List[Dict] = Field(default_factory=list)
    source_methods: List[str] = Field(default_factory=list)

    @property
    def has_business(self) -> bool:
        return len(self.businesses) > 0

    @property
    def has_news(self) -> bool:
        return len(self.news) > 0

    @property
    def is_empty(self) -> bool:
        return not self.has_business and not self.has_news
