"""
Creates the job_listings table — real job postings per business, so the
"Việc làm" tab can show an actual browsable list instead of just an open-
positions count on the business page.

    python scripts/create_job_listings_table.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
CREATE TABLE IF NOT EXISTS job_listings (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses_demo(id) ON DELETE CASCADE,
    ten_doanh_nghiep VARCHAR(255),
    tieu_de VARCHAR(500) NOT NULL,
    url TEXT UNIQUE NOT NULL,
    dia_diem VARCHAR(255),
    ky_nang TEXT,
    phuc_loi TEXT,
    nguon VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_listings_business_id ON job_listings(business_id);
CREATE INDEX IF NOT EXISTS idx_job_listings_created_at ON job_listings(created_at DESC);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM job_listings")
    print(f"job_listings table ready. Current rows: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
