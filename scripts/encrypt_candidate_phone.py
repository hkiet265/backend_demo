"""
GDPR/data-protection: encrypt candidate_profiles.phone at rest, reusing the
existing EncryptionService (Fernet, same one already used for business
phone/email) instead of storing candidate PII in plaintext.

    python scripts/encrypt_candidate_phone.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings
from app.services.encryption_service import get_encryption_service


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()

    cur.execute("ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS phone_encrypted TEXT")
    conn.commit()

    encryption_service = get_encryption_service()
    cur.execute("SELECT user_id, phone FROM candidate_profiles WHERE phone IS NOT NULL AND phone_encrypted IS NULL")
    rows = cur.fetchall()
    print(f"Encrypting {len(rows)} existing plaintext phone numbers...")

    for user_id, phone in rows:
        encrypted = encryption_service.encrypt_phone(phone)
        cur.execute(
            "UPDATE candidate_profiles SET phone_encrypted = %s, phone = NULL WHERE user_id = %s",
            (encrypted, user_id),
        )
    conn.commit()

    cur.close()
    conn.close()
    print("Done. candidate_profiles.phone is now cleared; phone_encrypted holds the encrypted value.")


if __name__ == "__main__":
    main()
