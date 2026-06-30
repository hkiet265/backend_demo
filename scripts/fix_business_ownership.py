"""
Fix business ownership - assign created_by_user_id to existing businesses
This script will assign NULL created_by_user_id to a specific user
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_ownership():
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
        
        # Get user email to assign businesses to
        print("Nhập email của user để gán quyền sở hữu cho các doanh nghiệp:")
        user_email = input().strip()
        
        # Check if user exists
        cur.execute("SELECT id, email, full_name FROM users WHERE email = %s;", (user_email,))
        user = cur.fetchone()
        
        if not user:
            print(f"❌ Không tìm thấy user với email: {user_email}")
            return
        
        user_id = user[0]
        user_name = user[2]
        
        print(f"\n✅ Tìm thấy user: {user_name} (ID: {user_id})")
        
        # Count businesses without owner
        cur.execute("SELECT COUNT(*) FROM businesses_demo WHERE created_by_user_id IS NULL;")
        count = cur.fetchone()[0]
        
        print(f"📊 Có {count} doanh nghiệp chưa có chủ sở hữu")
        
        if count == 0:
            print("✅ Tất cả doanh nghiệp đã có chủ sở hữu!")
            return
        
        # Ask for confirmation
        print(f"\nBạn có muốn gán tất cả {count} doanh nghiệp này cho user '{user_name}'? (y/n)")
        confirm = input().strip().lower()
        
        if confirm != 'y':
            print("❌ Đã hủy thao tác")
            return
        
        # Update businesses
        cur.execute("""
            UPDATE businesses_demo 
            SET created_by_user_id = %s 
            WHERE created_by_user_id IS NULL;
        """, (user_id,))
        
        updated = cur.rowcount
        conn.commit()
        
        print(f"\n✅ Đã cập nhật {updated} doanh nghiệp cho user '{user_name}'")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        raise

if __name__ == "__main__":
    fix_ownership()
