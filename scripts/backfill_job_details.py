"""
Backfill mô tả công việc, địa điểm, hình thức làm việc, kinh nghiệm yêu cầu,
ngày đăng và hạn nộp cho các tin tuyển dụng đã crawl trước khi
extract_job_detail tồn tại (0/250 dòng có mo_ta_cong_viec/dia_diem trước
script này). Re-visit từng job_listings.url đã lưu sẵn, lấy dữ liệu từ
JSON-LD JobPosting của chính trang đó.

    python scripts/backfill_job_details.py
"""
import sys
import time

sys.path.insert(0, ".")

import psycopg2
import psycopg2.extras
from app.config import settings
from app.services.ai_enrichment_service import get_enrichment_service, looks_non_vietnamese
from app.services.business_listing_crawler_service import BusinessListingCrawlerService, DELAY_BETWEEN_REQUESTS_SEC


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT id, url, ten_doanh_nghiep, tieu_de FROM job_listings
        WHERE trang_thai = 'Da_duyet' AND url IS NOT NULL
          AND mo_ta_cong_viec IS NULL AND dia_diem IS NULL
        ORDER BY id;
        """
    )
    jobs = cur.fetchall()
    print(f"{len(jobs)} jobs need detail backfill")

    crawler = BusinessListingCrawlerService()
    enrichment_service = get_enrichment_service()
    updated, not_found, errors = 0, 0, 0

    for i, job in enumerate(jobs, 1):
        try:
            detail = crawler.extract_job_detail(job["url"])
        except Exception as e:
            print(f"  [{i}/{len(jobs)}] ERROR #{job['id']} {job['ten_doanh_nghiep']}: {e}")
            errors += 1
            time.sleep(DELAY_BETWEEN_REQUESTS_SEC)
            continue

        if not detail:
            not_found += 1
            print(f"  [{i}/{len(jobs)}] #{job['id']} {job['ten_doanh_nghiep']} -> (không tìm thấy JobPosting JSON-LD)")
            time.sleep(DELAY_BETWEEN_REQUESTS_SEC)
            continue

        description = detail.get("description")
        if looks_non_vietnamese(description):
            description = enrichment_service.translate_job_description_to_vietnamese(description)

        cur.execute(
            """
            UPDATE job_listings
            SET mo_ta_cong_viec = %s, dia_diem = %s, hinh_thuc_lam_viec = %s,
                kinh_nghiem_thang = %s, ngay_dang = %s, han_nop = %s
            WHERE id = %s;
            """,
            (
                description, detail.get("location"), detail.get("employment_type"),
                detail.get("months_of_experience"), detail.get("date_posted"), detail.get("valid_through"),
                job["id"],
            ),
        )
        conn.commit()
        updated += 1
        print(f"  [{i}/{len(jobs)}] #{job['id']} {job['ten_doanh_nghiep']} - {job['tieu_de'][:50]} -> OK")

        time.sleep(DELAY_BETWEEN_REQUESTS_SEC)

    print(f"\nDone. updated={updated} not_found={not_found} errors={errors}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
