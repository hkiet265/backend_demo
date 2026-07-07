"""
Backfill embeddings for businesses_demo.embedding (vector(1536), already exists in schema).
Mirrors the text representation used by SemanticBusinessService._business_to_text so that
query-time and backfill embeddings are generated the same way.
"""
import sys
import time
import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings
from app.services.embedding_service import EmbeddingService

BUSINESS_EMBEDDING_DIMENSION = 1536  # must match businesses_demo.embedding column type


def business_to_text(business: dict) -> str:
    parts = []
    if business.get('name'):
        parts.append(f"Công ty: {business['name']}")
    if business.get('industry'):
        parts.append(f"Ngành nghề: {business['industry']}")
    if business.get('location'):
        parts.append(f"Địa điểm: {business['location']}")
    if business.get('region'):
        parts.append(f"Khu vực: {business['region']}")
    if business.get('phone'):
        parts.append(f"Điện thoại: {business['phone']}")
    if business.get('email'):
        parts.append(f"Email: {business['email']}")
    if business.get('address'):
        parts.append(f"Địa chỉ: {business['address']}")
    return ". ".join(parts)


def backfill(batch_pause_every: int = 50, batch_pause_seconds: int = 30):
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, ten_doanh_nghiep as name, so_dien_thoai as phone,
               tinh_thanh as location, vung_mien as region,
               nganh_nghe as industry, email, dia_chi as address
        FROM businesses_demo
        WHERE embedding IS NULL
        ORDER BY id
    """)
    businesses = cur.fetchall()
    total = len(businesses)
    print(f"Found {total} businesses without embedding")

    if total == 0:
        cur.close()
        conn.close()
        return {'success': 0, 'failed': 0, 'total': 0}

    embedding_service = EmbeddingService(
        model=settings.EMBEDDING_MODEL,
        dimension=BUSINESS_EMBEDDING_DIMENSION,
    )

    success, failed = 0, 0
    for idx, business in enumerate(businesses, 1):
        try:
            text = business_to_text(business)
            embedding = embedding_service.generate_document_embedding(text)

            cur.execute(
                "UPDATE businesses_demo SET embedding = %s::vector WHERE id = %s",
                ('[' + ','.join(map(str, embedding)) + ']', business['id']),
            )
            conn.commit()
            success += 1
            print(f"  [{idx}/{total}] OK: {business['name']}")

            if idx % batch_pause_every == 0 and idx < total:
                print(f"  Pausing {batch_pause_seconds}s (rate limit)...")
                time.sleep(batch_pause_seconds)
            else:
                time.sleep(0.3)
        except Exception as e:
            failed += 1
            print(f"  [{idx}/{total}] FAILED ({business.get('name')}): {e}")

    cur.close()
    conn.close()
    return {'success': success, 'failed': failed, 'total': total}


if __name__ == "__main__":
    auto_confirm = '--yes' in sys.argv
    if not auto_confirm:
        answer = input("Generate embeddings for businesses_demo without embedding? (y/n): ")
        if answer.lower() != 'y':
            print("Cancelled")
            sys.exit(0)

    stats = backfill()
    print(f"\nDone: {stats['success']} success, {stats['failed']} failed, {stats['total']} total")
