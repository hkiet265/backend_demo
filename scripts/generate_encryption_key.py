"""
Generate Fernet Encryption Key
Run once to generate encryption key for production
"""
from cryptography.fernet import Fernet

print("=" * 60)
print("🔐 Generating Fernet Encryption Key")
print("=" * 60)

key = Fernet.generate_key().decode()

print("\n✅ Encryption key generated successfully!")
print("\n📋 Add this to your .env file:")
print("-" * 60)
print(f"ENCRYPTION_KEY={key}")
print("-" * 60)

print("\n⚠️  IMPORTANT SECURITY NOTES:")
print("1. Keep this key SECRET - never commit to git")
print("2. Backup this key safely - losing it means losing encrypted data")
print("3. Use different keys for dev/staging/production")
print("4. In production, use environment variables or secret managers")
print("\n" + "=" * 60)
