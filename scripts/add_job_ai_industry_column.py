"""
Thêm cột job_listings.ai_industry: ngành nghề do AI phân loại, dùng làm
fallback khi job không có business_id khớp với businesses_demo (nên không
có b.nganh_nghe) — trường hợp phổ biến với tin cào từ ITviec mà công ty
chưa từng được crawl vào bảng doanh nghiệp.

    python scripts/add_job_ai_industry_column.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS ai_industry VARCHAR(100);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    print("job_listings.ai_industry column ready.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
