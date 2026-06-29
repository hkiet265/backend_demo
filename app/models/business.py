"""
Business Models
Placeholder for business-related models
"""
from pydantic import BaseModel
from typing import Optional

class BusinessCreate(BaseModel):
    name: str

class BusinessUpdate(BaseModel):
    name: Optional[str] = None

class BusinessResponse(BaseModel):
    id: int
    name: str
