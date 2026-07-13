"""
Phase 2 (Nhà tuyển dụng): thêm cột để nhà tuyển dụng tự đăng tin và xử lý
ứng viên (ATS cơ bản).

    python scripts/add_employer_job_columns.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS mo_ta_cong_viec TEXT;
ALTER TABLE job_listings ALTER COLUMN url DROP NOT NULL;

ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS employer_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_job_listings_created_by_user_id ON job_listings(created_by_user_id);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    print("job_listings.created_by_user_id / mo_ta_cong_viec, job_applications.employer_notes ready.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
