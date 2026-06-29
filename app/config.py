"""
Application Configuration
Centralized configuration management for the entire application.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv(override=True)


class Settings(BaseSettings):
    """Application settings with environment variables"""

    APP_NAME: str = "News Chatbot with RAG"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "postgres")
    DB_SSLMODE: str = os.getenv("DB_SSLMODE", "require")

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    EMBEDDING_DIMENSION: int = 3072
    CHAT_MODEL: str = "gemini-2.5-flash"

    GROQ_API_KEY_1: str = os.getenv("GROQ_API_KEY_1", "")
    GROQ_API_KEY_2: str = os.getenv("GROQ_API_KEY_2", "")
    GROQ_API_KEY_3: str = os.getenv("GROQ_API_KEY_3", "")
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    LOGFIRE_TOKEN: str = os.getenv("LOGFIRE_TOKEN", "")
    LOGFIRE_READ_TOKEN: str = os.getenv("LOGFIRE_READ_TOKEN", "")

    USE_GROQ_FOR_GENERATION: bool = os.getenv("USE_GROQ_FOR_GENERATION", "true").lower() == "true"
    FALLBACK_TO_GEMINI: bool = os.getenv("FALLBACK_TO_GEMINI", "true").lower() == "true"

    RAG_TOP_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.3
    RAG_ENABLE_HYBRID_SEARCH: bool = True

    ENABLE_CASUAL_CHAT_AI: bool = True
    MAX_CASUAL_MESSAGE_LENGTH: int = 15 

    HOST: str = "127.0.0.1"
    PORT: int = 8000
    RELOAD: bool = True
    
    @property
    def database_url(self) -> dict:
        """Get database connection config"""
        return {
            "host": self.DB_HOST,
            "port": self.DB_PORT,
            "user": self.DB_USER,
            "password": self.DB_PASSWORD,
            "database": self.DB_NAME,
            "sslmode": self.DB_SSLMODE
        }
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
    
settings = get_settings()
DATABASE_URL = settings.database_url
GEMINI_API_KEY = settings.GEMINI_API_KEY

