"""
Quick script to generate embeddings for all news without embeddings
"""
import sys
sys.path.append('d:\\workspace\\backend_demo')

from app.services.vector_service import VectorService
from app.services.embedding_service import EmbeddingService
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("🚀 Starting embedding generation...")
    
    # Initialize services
    embedding_service = EmbeddingService(settings.GEMINI_API_KEY)
    vector_service = VectorService(
        db_config=settings.database_url,
        embedding_service=embedding_service
    )
    
    # Generate embeddings in batches
    total_generated = 0
    total_failed = 0
    batch_num = 0
    
    while True:
        batch_num += 1
        logger.info(f"📦 Processing batch #{batch_num}...")
        
        result = vector_service.generate_missing_embeddings(batch_size=50)
        
        total_generated += result['success']
        total_failed += result['failed']
        
        logger.info(f"Batch #{batch_num}: ✅ {result['success']} success, ❌ {result['failed']} failed")
        
        # Stop if no more documents
        if result['total'] == 0:
            logger.info("✅ All documents processed!")
            break
        
        # Stop after 10 batches to avoid quota issues
        if batch_num >= 10:
            logger.info("⚠️ Reached batch limit (10 batches = 500 embeddings)")
            break
    
    logger.info(f"🎉 Done! Total: ✅ {total_generated} generated, ❌ {total_failed} failed")
