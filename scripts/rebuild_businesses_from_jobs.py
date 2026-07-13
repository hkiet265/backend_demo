"""
Danh mục doanh nghiệp (businesses_demo, ~996 dòng) là một crawl độc lập,
gần như không giao với dữ liệu tin tuyển dụng thật (job_listings) — chỉ
17/996 doanh nghiệp có tin tuyển dụng thật gắn với nó. Việc này khiến trang
chủ/điều hướng dẫn người dùng vào những trang doanh nghiệp trống rỗng
("Vị trí đang tuyển: 0"), đọc như dữ liệu ảo.

Script này:
1. Xoá mọi doanh nghiệp KHÔNG có tin tuyển dụng thật nào gắn với nó (không
   xoá doanh nghiệp có bookmark/lịch sử chỉnh sửa thật — đã kiểm tra trước
   khi chạy, xem log của phiên làm việc).
2. Với mỗi công ty CÓ tin tuyển dụng (job_listings) nhưng business_id NULL
   (94 công ty, không match được với danh mục cũ) — tạo bản ghi doanh
   nghiệp mới từ chính dữ liệu tin tuyển dụng (tên, ngành nghề AI đã phân
   loại, số vị trí đang tuyển), rồi gắn business_id ngược lại cho các tin
   tuyển dụng của công ty đó.

    python scripts/rebuild_businesses_from_jobs.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
import psycopg2.extras
from app.config import settings


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Step 1: delete businesses with zero real job postings.
    cur.execute(
        """
        DELETE FROM businesses_demo
        WHERE id NOT IN (
            SELECT DISTINCT business_id FROM job_listings
            WHERE business_id IS NOT NULL AND trang_thai = 'Da_duyet'
        )
        RETURNING id;
        """
    )
    deleted = cur.rowcount
    conn.commit()
    print(f"Deleted {deleted} businesses with no real job postings.")

    # Step 2: create a business record for each company that has job
    # postings but no business_id match, then link its jobs back to it.
    cur.execute(
        """
        SELECT ten_doanh_nghiep,
               (array_agg(ai_industry) FILTER (WHERE ai_industry IS NOT NULL))[1] as industry,
               count(*) as job_count
        FROM job_listings
        WHERE business_id IS NULL AND trang_thai = 'Da_duyet'
        GROUP BY ten_doanh_nghiep
        ORDER BY job_count DESC;
        """
    )
    companies = cur.fetchall()
    print(f"{len(companies)} companies need a new business record.")

    created = 0
    for company in companies:
        cur.execute(
            """
            INSERT INTO businesses_demo (ten_doanh_nghiep, nganh_nghe, nguon_du_lieu, dang_tuyen, trang_thai)
            VALUES (%s, %s, 'ITviec', %s, 'Hoat_dong')
            RETURNING id;
            """,
            (company["ten_doanh_nghiep"], company["industry"], company["job_count"]),
        )
        new_id = cur.fetchone()["id"]
        cur.execute(
            "UPDATE job_listings SET business_id = %s WHERE ten_doanh_nghiep = %s AND business_id IS NULL",
            (new_id, company["ten_doanh_nghiep"]),
        )
        created += 1
        print(f"  [{created}/{len(companies)}] {company['ten_doanh_nghiep']} -> business #{new_id} ({company['job_count']} jobs)")

    conn.commit()
    print(f"\nDone. Deleted {deleted} empty businesses, created {created} new businesses backed by real jobs.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
