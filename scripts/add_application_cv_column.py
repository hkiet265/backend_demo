"""
Cho phép ứng viên đính kèm 1 CV/PDF riêng cho từng đơn ứng tuyển (khác với
CV mặc định trong hồ sơ) — hữu ích khi họ muốn gửi CV tùy biến theo từng vị
trí, hoặc chưa có CV nào trong hồ sơ.

    python scripts/add_application_cv_column.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS cv_file_path VARCHAR(500);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    print("job_applications.cv_file_path column ready.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
