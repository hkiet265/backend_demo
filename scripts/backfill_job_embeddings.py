"""
Backfill embeddings for job_listings.embedding (vector(768)) — needed so
the AI job-suggestion feature has something to rank against for jobs
crawled before this feature existed.

    python scripts/backfill_job_embeddings.py
"""
import sys

sys.path.insert(0, ".")

from app.config import settings
from app.database import init_db_pool, close_db_pool, get_db_connection
from app.services.embedding_service import EmbeddingService


def main():
    init_db_pool(settings.database_url, minconn=1, maxconn=3)
    embedding_service = EmbeddingService(model=settings.EMBEDDING_MODEL, dimension=settings.EMBEDDING_DIMENSION)

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, tieu_de, ky_nang, phuc_loi FROM job_listings "
                "WHERE embedding IS NULL AND trang_thai = 'Da_duyet'"
            )
            jobs = cur.fetchall()
            print(f"Found {len(jobs)} jobs without embedding")

            done, errors = 0, 0
            for job_id, tieu_de, ky_nang, phuc_loi in jobs:
                text = " | ".join(p for p in (tieu_de, ky_nang, phuc_loi) if p)
                if not text.strip():
                    continue
                try:
                    embedding = embedding_service.generate_document_embedding(text)
                    cur.execute(
                        "UPDATE job_listings SET embedding = %s::vector WHERE id = %s",
                        ("[" + ",".join(map(str, embedding)) + "]", job_id),
                    )
                    done += 1
                    if done % 25 == 0:
                        conn.commit()
                        print(f"  ...{done}/{len(jobs)}")
                except Exception as e:
                    print(f"  Error embedding job {job_id}: {e}")
                    errors += 1

            conn.commit()
            cur.close()

        print(f"Done. Embedded: {done} | Errors: {errors}")
    finally:
        close_db_pool()


if __name__ == "__main__":
    main()
