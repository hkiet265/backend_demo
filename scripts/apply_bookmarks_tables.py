import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def apply_bookmarks_tables():
    """Apply bookmarks tables to database"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        logger.info("📚 Creating bookmarks tables...")
        
        with open('scripts/create_bookmarks_tables.sql', 'r', encoding='utf-8') as f:
            sql = f.read()
            cur.execute(sql)
        
        conn.commit()
        logger.info("✅ Bookmarks tables created successfully!")
        
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    apply_bookmarks_tables()
