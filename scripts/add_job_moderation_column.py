"""
Phase 3 (Admin): thêm cột duyệt tin cho job_listings. Tin cào từ ITviec đã
qua nguồn uy tín nên tự động 'Da_duyet'; tin nhà tuyển dụng tự đăng trên
chính hệ thống ('Đăng trực tiếp') cần admin duyệt trước khi công khai.

    python scripts/add_job_moderation_column.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS trang_thai VARCHAR(20) DEFAULT 'Da_duyet';

UPDATE job_listings SET trang_thai = 'Cho_duyet'
WHERE nguon = 'Đăng trực tiếp' AND trang_thai = 'Da_duyet';

CREATE INDEX IF NOT EXISTS idx_job_listings_trang_thai ON job_listings(trang_thai);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()

    cur.execute("SELECT trang_thai, COUNT(*) FROM job_listings GROUP BY trang_thai")
    for row in cur.fetchall():
        print(row)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
