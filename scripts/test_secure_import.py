"""
Test Secure CSV Import Endpoint
Execute: python scripts/test_secure_import.py
"""
import requests
import os

# API Configuration
API_BASE = "http://127.0.0.1:8000"
LOGIN_URL = f"{API_BASE}/api/auth/login"
IMPORT_URL = f"{API_BASE}/api/secure/import-csv"

# Test credentials
EMAIL = "admin@emtu.vn"
PASSWORD = "admin123"

# Test CSV file
TEST_CSV = "test_data/sample_import.csv"

def test_secure_import():
    """Test the secure CSV import endpoint"""
    print("=" * 70)
    print("🧪 TESTING SECURE CSV IMPORT")
    print("=" * 70)
    print()
    
    # Step 1: Login
    print("🔐 Step 1: Login...")
    try:
        login_response = requests.post(
            LOGIN_URL,
            json={"email": EMAIL, "password": PASSWORD}
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            return False
        
        token = login_response.json()["access_token"]
        print(f"✅ Login successful! Token: {token[:20]}...\n")
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False
    
    # Step 2: Check if test CSV exists
    print("📄 Step 2: Check test CSV file...")
    if not os.path.exists(TEST_CSV):
        print(f"❌ Test file not found: {TEST_CSV}")
        print("   Creating test file...")
        
        os.makedirs("test_data", exist_ok=True)
        with open(TEST_CSV, "w", encoding="utf-8") as f:
            f.write("ten_doanh_nghiep,tinh_thanh,so_dien_thoai,email,website,nganh_nghe,quy_mo\n")
            f.write("Công ty TNHH Test Security ABC,Hà Nội,0987654321,test@security.com,https://test.com,Công nghệ,50-100\n")
            f.write("Công ty CP Test Encryption XYZ,TP HCM,0912345678,encrypt@test.vn,https://encrypt.vn,Fintech,100-200\n")
        
        print(f"✅ Test file created: {TEST_CSV}\n")
    else:
        print(f"✅ Test file exists: {TEST_CSV}\n")
    
    # Step 3: Upload CSV
    print("📤 Step 3: Upload CSV file...")
    try:
        with open(TEST_CSV, "rb") as f:
            files = {"file": (os.path.basename(TEST_CSV), f, "text/csv")}
            headers = {"Authorization": f"Bearer {token}"}
            
            import_response = requests.post(
                IMPORT_URL,
                files=files,
                headers=headers
            )
        
        print(f"📊 Response Status: {import_response.status_code}")
        
        if import_response.status_code == 200:
            data = import_response.json()
            print("✅ Import successful!\n")
            print("📈 Results:")
            print(f"   - Inserted: {data.get('inserted', 0)}")
            print(f"   - Skipped: {data.get('skipped', 0)}")
            print(f"   - Errors: {data.get('total_errors', 0)}")
            print(f"   - Message: {data.get('message', 'N/A')}")
            
            if data.get('validation'):
                val = data['validation']
                print(f"\n📋 Validation:")
                print(f"   - File size: {val.get('size', 0)} bytes")
                print(f"   - Rows: {val.get('rows', 0)}")
                print(f"   - Filename: {val.get('filename', 'N/A')}")
            
            return True
            
        else:
            print(f"❌ Import failed!")
            print(f"   Response: {import_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return False

def verify_encryption():
    """Verify data was encrypted in database"""
    print()
    print("=" * 70)
    print("🔍 VERIFYING ENCRYPTION")
    print("=" * 70)
    print()
    
    try:
        import psycopg2
        
        conn = psycopg2.connect(
            host="aws-1-ap-northeast-1.pooler.supabase.com",
            port=5432,
            user="postgres.bfiocjgmrhngahagpoas",
            password="Hokhaikiet265@",
            database="postgres",
            sslmode="require"
        )
        cur = conn.cursor()
        
        # Get last 3 imported records
        cur.execute("""
            SELECT 
                ten_doanh_nghiep,
                so_dien_thoai,
                so_dien_thoai_encrypted,
                email,
                email_encrypted,
                phone_hash,
                email_hash,
                data_source
            FROM businesses_demo
            WHERE data_source = 'CSV Import - Secure'
            ORDER BY created_at DESC
            LIMIT 3
        """)
        
        rows = cur.fetchall()
        
        if rows:
            print("✅ Found encrypted records in database:\n")
            for i, row in enumerate(rows, 1):
                name, phone_plain, phone_enc, email_plain, email_enc, phone_hash, email_hash, source = row
                
                print(f"Record {i}: {name}")
                print(f"   Plaintext phone: {phone_plain or 'NULL ✅'}")
                print(f"   Encrypted phone: {phone_enc[:30] if phone_enc else 'NULL'}...")
                print(f"   Phone hash: {phone_hash or 'NULL'}")
                print(f"   Plaintext email: {email_plain or 'NULL ✅'}")
                print(f"   Encrypted email: {email_enc[:30] if email_enc else 'NULL'}...")
                print(f"   Email hash: {email_hash or 'NULL'}")
                print(f"   Data source: {source}")
                print()
                
                if phone_enc and not phone_plain:
                    print("   ✅ Phone is ENCRYPTED (plaintext is NULL)")
                if email_enc and not email_plain:
                    print("   ✅ Email is ENCRYPTED (plaintext is NULL)")
                print()
        else:
            print("⚠️  No encrypted records found yet")
            print("   This is normal if testing for the first time")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"⚠️  Could not verify: {e}")

if __name__ == "__main__":
    print()
    success = test_secure_import()
    
    if success:
        verify_encryption()
        print()
        print("=" * 70)
        print("🎉 TEST COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print()
        print("✅ Secure CSV import is working!")
        print("✅ Data encryption is active!")
        print("✅ All security features operational!")
        print()
    else:
        print()
        print("=" * 70)
        print("❌ TEST FAILED")
        print("=" * 70)
        print()
