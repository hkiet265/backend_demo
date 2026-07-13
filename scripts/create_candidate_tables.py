"""
Phase 1 (Ứng viên): tạo 3 bảng — hồ sơ ứng viên, đơn ứng tuyển, việc làm đã lưu.

    python scripts/create_candidate_tables.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
CREATE TABLE IF NOT EXISTS candidate_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    headline VARCHAR(255),
    experience_summary TEXT,
    education_summary TEXT,
    skills TEXT,
    cv_file_path TEXT,
    is_open_to_work BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    cover_letter TEXT,
    status VARCHAR(30) DEFAULT 'Moi_nop',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(job_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_jobs (
    user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()

    for table in ("candidate_profiles", "job_applications", "saved_jobs"):
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"{table} ready. Current rows: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
