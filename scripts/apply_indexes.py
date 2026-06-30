"""
Apply database indexes for performance optimization
Chạy script này để thêm indexes vào database
"""
import sys
sys.path.append('d:\\workspace\\backend_demo')

import psycopg2
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def apply_indexes():
    """Apply all database indexes"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        logger.info("🔍 Applying database indexes...")
        
        indexes = [
            # Station_news indexes
            ("idx_news_created", "CREATE INDEX IF NOT EXISTS idx_news_created ON station_news(created_at DESC)"),
            ("idx_news_vung_mien", "CREATE INDEX IF NOT EXISTS idx_news_vung_mien ON station_news(vung_mien)"),
            ("idx_news_chuyen_muc", "CREATE INDEX IF NOT EXISTS idx_news_chuyen_muc ON station_news(chuyen_muc)"),
            ("idx_news_nha_dai", "CREATE INDEX IF NOT EXISTS idx_news_nha_dai ON station_news(nha_dai)"),
            ("idx_news_hash", "CREATE INDEX IF NOT EXISTS idx_news_hash ON station_news(hash_noi_dung)"),
            
            # Composite indexes
            ("idx_news_vung_created", "CREATE INDEX IF NOT EXISTS idx_news_vung_created ON station_news(vung_mien, created_at DESC)"),
            ("idx_news_category_created", "CREATE INDEX IF NOT EXISTS idx_news_category_created ON station_news(chuyen_muc, created_at DESC)"),
            
            # Businesses_demo indexes
            ("idx_business_vung_mien", "CREATE INDEX IF NOT EXISTS idx_business_vung_mien ON businesses_demo(vung_mien)"),
            ("idx_business_nganh_nghe", "CREATE INDEX IF NOT EXISTS idx_business_nganh_nghe ON businesses_demo(nganh_nghe)"),
            ("idx_business_trust", "CREATE INDEX IF NOT EXISTS idx_business_trust ON businesses_demo(do_tin_cay DESC NULLS LAST)"),
            ("idx_business_updated", "CREATE INDEX IF NOT EXISTS idx_business_updated ON businesses_demo(updated_at DESC)"),
            ("idx_business_name", "CREATE INDEX IF NOT EXISTS idx_business_name ON businesses_demo(ten_doanh_nghiep)"),
            ("idx_business_region_trust", "CREATE INDEX IF NOT EXISTS idx_business_region_trust ON businesses_demo(vung_mien, do_tin_cay DESC)"),
            
            # App_users indexes
            ("idx_users_email", "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON app_users(email)"),
            ("idx_users_created", "CREATE INDEX IF NOT EXISTS idx_users_created ON app_users(created_at DESC)"),
            ("idx_users_role", "CREATE INDEX IF NOT EXISTS idx_users_role ON app_users(role)"),
        ]
        
        success_count = 0
        for idx_name, sql in indexes:
            try:
                cur.execute(sql)
                conn.commit()
                logger.info(f"  ✅ {idx_name}")
                success_count += 1
            except Exception as e:
                logger.warning(f"  ⚠️ {idx_name}: {e}")
                conn.rollback()
        
        logger.info(f"\n📊 Applied {success_count}/{len(indexes)} indexes")
        
        # Analyze tables
        logger.info("\n📈 Analyzing tables for query planner...")
        cur.execute("ANALYZE station_news")
        cur.execute("ANALYZE businesses_demo")
        cur.execute("ANALYZE app_users")
        conn.commit()
        logger.info("  ✅ Tables analyzed")
        
        # Show results
        logger.info("\n📋 Existing indexes:")
        cur.execute("""
            SELECT tablename, indexname
            FROM pg_indexes 
            WHERE tablename IN ('station_news', 'businesses_demo', 'app_users')
            ORDER BY tablename, indexname
        """)
        
        current_table = None
        for row in cur.fetchall():
            table, index = row
            if table != current_table:
                logger.info(f"\n  {table}:")
                current_table = table
            logger.info(f"    - {index}")
        
        cur.close()
        conn.close()
        
        logger.info("\n✅ Done! Queries should be 10-100x faster now!")
        
    except Exception as e:
        logger.error(f"❌ Failed to apply indexes: {e}")
        raise


if __name__ == "__main__":
    apply_indexes()
