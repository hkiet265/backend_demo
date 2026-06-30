"""
Auto-fix business ownership - assign created_by_user_id to existing businesses
Automatically assigns to the first non-admin user found
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_ownership_auto():
    try:
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
        
        # Get first user (prefer non-admin)
        cur.execute("""
            SELECT id, email, full_name, role 
            FROM users 
            ORDER BY CASE WHEN role != 'admin' THEN 0 ELSE 1 END, id 
            LIMIT 1;
        """)
        user = cur.fetchone()
        
        if not user:
            print("❌ Không tìm thấy user nào trong hệ thống")
            return
        
        user_id = user[0]
        user_email = user[1]
        user_name = user[2]
        user_role = user[3]
        
        print(f"✅ Sẽ gán cho user: {user_name} ({user_email}) - Role: {user_role}")
        
        # Count businesses without owner
        cur.execute("SELECT COUNT(*) FROM businesses_demo WHERE created_by_user_id IS NULL;")
        count = cur.fetchone()[0]
        
        print(f"📊 Có {count} doanh nghiệp chưa có chủ sở hữu")
        
        if count == 0:
            print("✅ Tất cả doanh nghiệp đã có chủ sở hữu!")
            cur.close()
            conn.close()
            return
        
        # Update businesses
        cur.execute("""
            UPDATE businesses_demo 
            SET created_by_user_id = %s 
            WHERE created_by_user_id IS NULL;
        """, (user_id,))
        
        updated = cur.rowcount
        conn.commit()
        
        print(f"✅ Đã cập nhật {updated} doanh nghiệp cho user '{user_name}'")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        raise

if __name__ == "__main__":
    fix_ownership_auto()
