"""
RAG Setup Script
Professional setup script for RAG system
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from app.config import settings
from app.services import EmbeddingService, VectorService
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def setup_pgvector():
    """Enable pgvector extension"""
    logger.info("Enabling pgvector extension...")
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        cur.close()
        conn.close()
        logger.info("✅ pgvector enabled")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to enable pgvector: {e}")
        return False


def create_vector_column():
    """Create vector column in database"""
    logger.info(f"Creating vector column ({settings.EMBEDDING_DIMENSION} dimensions)...")
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        # Drop existing column
        cur.execute("ALTER TABLE station_news DROP COLUMN IF EXISTS embedding_vector;")
        
        # Create new column
        cur.execute(f"ALTER TABLE station_news ADD COLUMN embedding_vector vector({settings.EMBEDDING_DIMENSION});")
        
        conn.commit()
        cur.close()
        conn.close()
        logger.info("✅ Vector column created")
        logger.info("ℹ️  No index (pgvector limit: 2000 dims)")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create vector column: {e}")
        return False


def generate_embeddings(batch_size: int = 10):
    """Generate embeddings for documents"""
    logger.info(f"Generating embeddings (batch size: {batch_size})...")
    try:
        embedding_service = EmbeddingService(
            api_key=settings.GEMINI_API_KEY,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION
        )
        vector_service = VectorService(
            db_config=settings.database_url,
            embedding_service=embedding_service
        )
        
        stats = vector_service.generate_missing_embeddings(batch_size=batch_size)
        
        logger.info(f"✅ Embeddings generated:")
        logger.info(f"   - Success: {stats['success']}")
        logger.info(f"   - Failed: {stats['failed']}")
        logger.info(f"   - Total: {stats['total']}")
        
        return stats['success'] > 0
    except Exception as e:
        logger.error(f"❌ Failed to generate embeddings: {e}")
        return False


def test_rag():
    """Test RAG system"""
    logger.info("Testing RAG system...")
    try:
        from app.services import RAGService
        
        embedding_service = EmbeddingService(
            api_key=settings.GEMINI_API_KEY,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION
        )
        vector_service = VectorService(
            db_config=settings.database_url,
            embedding_service=embedding_service
        )
        rag_service = RAGService(
            vector_service=vector_service,
            gemini_api_key=settings.GEMINI_API_KEY,
            chat_model=settings.CHAT_MODEL
        )
        
        result = rag_service.chat("tin tức", top_k=3)
        
        logger.info(f"✅ RAG test passed:")
        logger.info(f"   - Found {len(result['documents'])} documents")
        logger.info(f"   - Tokens saved: ~{result['tokens_saved']:,}")
        
        return True
    except Exception as e:
        logger.error(f"❌ RAG test failed: {e}")
        return False


def main():
    """Main setup process"""
    print("\n" + "="*80)
    print("🚀 RAG SYSTEM SETUP")
    print("="*80)
    print(f"\nApp: {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"Embedding Model: {settings.EMBEDDING_MODEL}")
    print(f"Dimension: {settings.EMBEDDING_DIMENSION}")
    print(f"Chat Model: {settings.CHAT_MODEL}")
    print("="*80 + "\n")
    
    # Step 1: Enable pgvector
    if not setup_pgvector():
        sys.exit(1)
    
    # Step 2: Create vector column
    if not create_vector_column():
        sys.exit(1)
    
    # Step 3: Generate embeddings
    if not generate_embeddings(batch_size=10):
        logger.warning("⚠️  Embedding generation had issues (API quota?)")
        logger.info("You can generate embeddings later when quota resets")
    
    # Step 4: Test RAG
    test_rag()
    
    print("\n" + "="*80)
    print("🎉 SETUP COMPLETE!")
    print("="*80)
    print("\nNext steps:")
    print("  1. Start server: python -m app.main")
    print("  2. Test API: curl http://127.0.0.1:8000/health")
    print("  3. Open docs: http://127.0.0.1:8000/docs")
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    main()
