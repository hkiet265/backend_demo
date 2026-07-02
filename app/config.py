"""
Application Configuration
Centralized configuration management for the entire application.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variables"""

    APP_NAME: str = "News Chatbot with RAG"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""
    DB_NAME: str = "postgres"
    DB_SSLMODE: str = "require"

    GEMINI_API_KEY: str = ""
    
    GEMINI_API_KEY_1: str = ""
    GEMINI_API_KEY_2: str = ""
    GEMINI_API_KEY_3: str = ""
    GEMINI_API_KEY_4: str = ""
    GEMINI_API_KEY_5: str = ""
    GEMINI_API_KEY_6: str = ""
    GEMINI_API_KEY_7: str = ""
    GEMINI_API_KEY_8: str = ""
    GEMINI_API_KEY_9: str = ""
    GEMINI_API_KEY_10: str = ""
    
    EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    EMBEDDING_DIMENSION: int = 3072
    CHAT_MODEL: str = "gemini-2.5-flash"

    GROQ_API_KEY_1: str = ""
    GROQ_API_KEY_2: str = ""
    GROQ_API_KEY_3: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    LOGFIRE_TOKEN: str = ""
    LOGFIRE_READ_TOKEN: str = ""

    JWT_SECRET: str = "emtu_secret_key_2024_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 30

    USE_GROQ_FOR_GENERATION: bool = True
    FALLBACK_TO_GEMINI: bool = True

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

