"""
Job Flagging & Reporting: ứng viên báo cáo tin tuyển dụng lừa đảo/đa cấp/
sai sự thật/quấy rối; admin xem và xử lý.

    python scripts/create_job_reports_table.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
CREATE TABLE IF NOT EXISTS job_reports (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    reporter_user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    reason VARCHAR(30) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Cho_xu_ly',
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    UNIQUE(job_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_reports_status ON job_reports(status);
CREATE INDEX IF NOT EXISTS idx_job_reports_job_id ON job_reports(job_id);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.execute("SELECT COUNT(*) FROM job_reports")
    print(f"job_reports table ready. Current rows: {cur.fetchone()[0]}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
