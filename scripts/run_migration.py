"""
Run SQL Migration to add encryption columns
Execute: python scripts/run_migration.py
"""
import psycopg2
import sys
import os

# Database credentials
DB_HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
DB_PORT = 5432
DB_USER = "postgres.bfiocjgmrhngahagpoas"
DB_PASSWORD = "Hokhaikiet265@"
DB_NAME = "postgres"
DB_SSLMODE = "require"

SQL_MIGRATION = """
-- Migration: Add encryption columns for sensitive data

-- Add encrypted columns
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS so_dien_thoai_encrypted TEXT;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS email_encrypted TEXT;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS dia_chi_encrypted TEXT;

-- Add hash columns for search/deduplication
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(16);
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS email_hash VARCHAR(16);

-- Add GDPR/PDPA compliance columns
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS consent_obtained BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS consent_date TIMESTAMP;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'Manual Input';
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS deletion_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create indexes for hash columns (faster search)
CREATE INDEX IF NOT EXISTS idx_businesses_phone_hash ON businesses_demo(phone_hash);
CREATE INDEX IF NOT EXISTS idx_businesses_email_hash ON businesses_demo(email_hash);
CREATE INDEX IF NOT EXISTS idx_businesses_deletion_requested ON businesses_demo(deletion_requested);
"""

def run_migration():
    """Execute SQL migration"""
    print("=" * 70)
    print("🗄️  SQL MIGRATION - Add Encryption Columns")
    print("=" * 70)
    print()
    
    try:
        # Connect to database
        print(f"📡 Connecting to database: {DB_HOST}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            sslmode=DB_SSLMODE
        )
        cur = conn.cursor()
        print("✅ Connected successfully!\n")
        
        # Execute migration
        print("⚙️  Executing SQL migration...")
        cur.execute(SQL_MIGRATION)
        conn.commit()
        print("✅ SQL migration executed successfully!\n")
        
        # Verify columns were added
        print("🔍 Verifying new columns...")
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'businesses_demo'
            AND column_name IN (
                'so_dien_thoai_encrypted',
                'email_encrypted',
                'dia_chi_encrypted',
                'phone_hash',
                'email_hash',
                'consent_obtained',
                'data_source',
                'deletion_requested'
            )
            ORDER BY column_name
        """)
        
        columns = cur.fetchall()
        
        if columns:
            print("✅ Columns added successfully:\n")
            print(f"{'Column Name':<30} {'Type':<20} {'Nullable':<10}")
            print("-" * 60)
            for col in columns:
                print(f"{col[0]:<30} {col[1]:<20} {col[2]:<10}")
            print()
        else:
            print("⚠️  Warning: Could not verify columns")
        
        # Verify indexes
        print("🔍 Verifying indexes...")
        cur.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'businesses_demo'
            AND indexname LIKE 'idx_businesses_%hash%'
            OR indexname LIKE 'idx_businesses_deletion%'
            ORDER BY indexname
        """)
        
        indexes = cur.fetchall()
        
        if indexes:
            print("✅ Indexes created successfully:\n")
            for idx in indexes:
                print(f"   - {idx[0]}")
            print()
        
        # Get table statistics
        print("📊 Table Statistics:")
        cur.execute("SELECT COUNT(*) FROM businesses_demo")
        total = cur.fetchone()[0]
        print(f"   Total businesses: {total}")
        
        cur.close()
        conn.close()
        
        print()
        print("=" * 70)
        print("🎉 MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("1. Test CSV upload with: test_data/sample_import.csv")
        print("2. Verify encrypted data in database")
        print("3. (Optional) Run data migration: python scripts/migrate_existing_data.py")
        print()
        
        return True
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        print(f"Error code: {e.pgcode}")
        return False
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
