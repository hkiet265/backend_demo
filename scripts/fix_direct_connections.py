"""
Script to identify files that need to be updated to use connection pool
instead of direct psycopg2.connect() calls
"""

files_to_fix = {
    "app/api/business.py": "Multiple endpoints - replace all psycopg2.connect with get_db_connection()",
    "app/api/auth.py": "Auth endpoints - replace all psycopg2.connect with get_db_connection()",
    "app/api/admin.py": "Admin endpoints - replace all psycopg2.connect with get_db_connection()",
    "app/api/news.py": "News endpoints - replace all psycopg2.connect with get_db_connection()",
    "app/api/crawler.py": "Crawler endpoint - replace psycopg2.connect with get_db_connection()",
    "app/api/secure_csv_import.py": "CSV import - replace psycopg2.connect with get_db_connection()",
    "app/services/chat_service.py": "Chat service - replace all psycopg2.connect with get_db_connection()",
    "app/services/vector_service.py": "Vector service - replace all psycopg2.connect with get_db_connection()",
}

print("=" * 80)
print("FILES REQUIRING CONNECTION POOL MIGRATION")
print("=" * 80)
print()
print("All these files currently use direct psycopg2.connect() which creates")
print("new connections and doesn't release them properly, causing Supabase")
print("connection pool exhaustion.")
print()
print("Required changes:")
print("1. Add import: from app.database import get_db_connection")
print("2. Replace: conn = psycopg2.connect(**settings.database_url)")
print("   With: with get_db_connection() as conn:")
print("3. Remove conn.close() calls (automatic with context manager)")
print()

for filepath, description in files_to_fix.items():
    print(f"📄 {filepath}")
    print(f"   {description}")
    print()

print("=" * 80)
print(f"TOTAL FILES TO FIX: {len(files_to_fix)}")
print("=" * 80)
