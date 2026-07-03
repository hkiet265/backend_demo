"""
Migrate Existing Plaintext Data to Encrypted Format
Run once: python scripts/migrate_existing_data.py

WARNING: This script will:
1. Encrypt all plaintext phone/email/address in businesses_demo
2. Create hashes for search/deduplication
3. Optionally clear plaintext columns after verification

BACKUP YOUR DATABASE BEFORE RUNNING!
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from app.config import settings
from app.services.encryption_service import get_encryption_service
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_to_encrypted(clear_plaintext=False):
    """
    Migrate plaintext sensitive data to encrypted format
    
    Args:
        clear_plaintext: If True, clear plaintext columns after encryption
    """
    logger.info("🔄 Starting data migration to encrypted format...")
    
    enc_service = get_encryption_service()
    
    # Connect to database
    try:
        conn = psycopg2.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            sslmode=settings.DB_SSLMODE
        )
        cur = conn.cursor()
        logger.info("✅ Connected to database")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return
    
    # Check if encrypted columns exist
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'businesses_demo' 
        AND column_name IN ('so_dien_thoai_encrypted', 'email_encrypted', 'phone_hash')
    """)
    encrypted_cols = [row[0] for row in cur.fetchall()]
    
    if not encrypted_cols:
        logger.error("❌ Encrypted columns not found! Run SQL migration first:")
        logger.error("   scripts/add_encryption_columns.sql")
        cur.close()
        conn.close()
        return
    
    logger.info(f"✅ Found encrypted columns: {encrypted_cols}")
    
    # Get all businesses with plaintext data that haven't been encrypted yet
    cur.execute("""
        SELECT id, so_dien_thoai, email, dia_chi
        FROM businesses_demo
        WHERE (so_dien_thoai IS NOT NULL OR email IS NOT NULL OR dia_chi IS NOT NULL)
        AND so_dien_thoai_encrypted IS NULL
    """)
    
    rows = cur.fetchall()
    total = len(rows)
    
    if total == 0:
        logger.info("✅ No plaintext data to migrate. All data is already encrypted.")
        cur.close()
        conn.close()
        return
    
    logger.info(f"📊 Found {total} records with plaintext data to encrypt")
    
    encrypted_count = 0
    error_count = 0
    
    for row in rows:
        business_id, phone, email, address = row
        
        try:
            # Encrypt sensitive fields
            phone_enc = enc_service.encrypt_phone(phone) if phone else None
            email_enc = enc_service.encrypt_email(email) if email else None
            address_enc = enc_service.encrypt(address) if address else None
            
            # Create hashes for search/deduplication
            phone_hash = enc_service.hash_for_search(phone) if phone else None
            email_hash = enc_service.hash_for_search(email) if email else None
            
            # Update with encrypted values
            cur.execute("""
                UPDATE businesses_demo
                SET so_dien_thoai_encrypted = %s,
                    email_encrypted = %s,
                    dia_chi_encrypted = %s,
                    phone_hash = %s,
                    email_hash = %s
                WHERE id = %s
            """, (phone_enc, email_enc, address_enc, phone_hash, email_hash, business_id))
            
            encrypted_count += 1
            
            if encrypted_count % 100 == 0:
                logger.info(f"⏳ Progress: {encrypted_count}/{total} records encrypted...")
                conn.commit()  # Commit every 100 records
            
        except Exception as e:
            logger.error(f"❌ Error encrypting business ID {business_id}: {e}")
            error_count += 1
    
    # Final commit
    conn.commit()
    logger.info(f"✅ Migration completed: {encrypted_count} records encrypted, {error_count} errors")
    
    # Optional: Clear plaintext columns
    if clear_plaintext and encrypted_count > 0:
        logger.warning("⚠️  Clearing plaintext columns...")
        logger.warning("⚠️  This is IRREVERSIBLE! Press Ctrl+C within 5 seconds to cancel...")
        
        import time
        for i in range(5, 0, -1):
            logger.warning(f"⏰ {i}...")
            time.sleep(1)
        
        cur.execute("""
            UPDATE businesses_demo
            SET so_dien_thoai = NULL,
                email = NULL,
                dia_chi = NULL
            WHERE so_dien_thoai_encrypted IS NOT NULL
        """)
        conn.commit()
        logger.info("✅ Plaintext columns cleared")
    elif clear_plaintext:
        logger.info("ℹ️  No plaintext to clear (no records were encrypted)")
    
    # Verify encryption
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(so_dien_thoai_encrypted) as encrypted_phones,
            COUNT(email_encrypted) as encrypted_emails,
            COUNT(phone_hash) as phone_hashes,
            COUNT(email_hash) as email_hashes
        FROM businesses_demo
    """)
    stats = cur.fetchone()
    
    logger.info("\n📊 Database Statistics:")
    logger.info(f"   Total businesses: {stats[0]}")
    logger.info(f"   Encrypted phones: {stats[1]}")
    logger.info(f"   Encrypted emails: {stats[2]}")
    logger.info(f"   Phone hashes: {stats[3]}")
    logger.info(f"   Email hashes: {stats[4]}")
    
    cur.close()
    conn.close()
    logger.info("\n✅ Migration completed successfully!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate plaintext data to encrypted format')
    parser.add_argument(
        '--clear-plaintext',
        action='store_true',
        help='Clear plaintext columns after encryption (DANGEROUS!)'
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 70)
    logger.info("📦 Data Migration Script - Plaintext to Encrypted")
    logger.info("=" * 70)
    
    if args.clear_plaintext:
        logger.warning("⚠️  WARNING: --clear-plaintext flag is set!")
        logger.warning("⚠️  Plaintext data will be PERMANENTLY DELETED after encryption")
        logger.warning("⚠️  Make sure you have a database backup!")
        
        response = input("\nType 'YES' to confirm: ")
        if response != "YES":
            logger.info("❌ Migration cancelled")
            sys.exit(0)
    
    migrate_to_encrypted(clear_plaintext=args.clear_plaintext)
