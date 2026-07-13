"""
Phase 4 (AI gợi ý việc làm): thêm cột embedding vector(768) cho job_listings
và candidate_profiles — dùng pgvector cosine similarity để gợi ý job phù
hợp với hồ sơ ứng viên. 768 chiều khớp với EMBEDDING_DIMENSION hiện tại của
project (Gemini embedding), không phải 1536 như businesses_demo.embedding
(cột đó dùng model embedding cũ, không liên quan tới tính năng này).

    python scripts/add_job_suggestion_embeddings.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS embedding vector(768);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    print("job_listings.embedding / candidate_profiles.embedding ready.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
