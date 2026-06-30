"""
Apply created_by_user_id column to businesses_demo table
Run this script to add user ownership tracking to businesses
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def apply_migration():
    try:
        # Get database connection from environment
        db_url = {
            'host': os.getenv('DB_HOST'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME'),
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'sslmode': os.getenv('DB_SSLMODE', 'require')
        }
        
        conn = psycopg2.connect(**db_url)
        cur = conn.cursor()
        
        print("Adding created_by_user_id column to businesses_demo table...")
        
        # Read SQL file
        with open('scripts/add_created_by_column.sql', 'r', encoding='utf-8') as f:
            sql = f.read()
        
        # Execute SQL
        cur.execute(sql)
        conn.commit()
        
        print("✅ Migration applied successfully!")
        print("Column 'created_by_user_id' added to businesses_demo table")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        raise

if __name__ == "__main__":
    apply_migration()
