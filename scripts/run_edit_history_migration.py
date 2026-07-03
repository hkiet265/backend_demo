"""
Script to create business_edit_history table on Supabase
Run: python scripts/run_edit_history_migration.py
"""
import psycopg2
import os
from pathlib import Path

# Supabase connection
SUPABASE_URL = "postgresql://postgres.bfiocjgmrhngahagpoas:Hokhaikiet265%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

def run_migration():
    print("🚀 Starting business_edit_history table creation...")
    
    # Read SQL file
    sql_file = Path(__file__).parent / "create_business_edit_history.sql"
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_script = f.read()
    
    try:
        # Connect to Supabase
        conn = psycopg2.connect(SUPABASE_URL)
        cur = conn.cursor()
        
        # Execute SQL
        print("📝 Creating table and indexes...")
        cur.execute(sql_script)
        
        conn.commit()
        
        # Verify table created
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'business_edit_history'
            ORDER BY ordinal_position;
        """)
        
        columns = cur.fetchall()
        print(f"\n✅ Table 'business_edit_history' created successfully!")
        print(f"📋 Columns ({len(columns)}):")
        for col_name, col_type in columns:
            print(f"   - {col_name}: {col_type}")
        
        # Check indexes
        cur.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'business_edit_history';
        """)
        indexes = cur.fetchall()
        print(f"\n📊 Indexes ({len(indexes)}):")
        for idx in indexes:
            print(f"   - {idx[0]}")
        
        # Check function exists
        cur.execute("""
            SELECT proname 
            FROM pg_proc 
            WHERE proname = 'delete_old_edit_history';
        """)
        func = cur.fetchone()
        if func:
            print(f"\n🔧 Function 'delete_old_edit_history' created successfully!")
        
        cur.close()
        conn.close()
        
        print("\n🎉 Migration completed successfully!")
        print("\n📌 Next steps:")
        print("   1. Backend API đã được cập nhật để lưu lịch sử khi edit")
        print("   2. Frontend đã có dropdown menu 3 chấm với nút Edit và Delete")
        print("   3. Lịch sử tự động xóa sau 15 ngày")
        print("   4. Có thể xem lịch sử qua: GET /api/businesses/{id}/edit-history")
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        print(f"   Error code: {e.pgcode}")
        print(f"   Details: {e.pgerror}")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    run_migration()
