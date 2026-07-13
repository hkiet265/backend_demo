"""
Backfill: translate job_listings.ky_nang / phuc_loi to Vietnamese for jobs
whose original ITviec posting was entirely in English (common for foreign-
owned companies), so "Yêu cầu công việc"/"Phúc lợi" reads consistently
across the job list instead of switching language card to card.

    python scripts/backfill_job_language.py
"""
import sys
import time

sys.path.insert(0, ".")

import psycopg2
import psycopg2.extras
from app.config import settings
from app.services.ai_enrichment_service import get_enrichment_service, looks_non_vietnamese

DELAY_BETWEEN_CALLS_SEC = 1.0


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT id, ten_doanh_nghiep, tieu_de, ky_nang, phuc_loi
        FROM job_listings
        WHERE trang_thai = 'Da_duyet'
        ORDER BY id;
        """
    )
    jobs = cur.fetchall()

    to_translate = [
        j for j in jobs
        if looks_non_vietnamese(j["ky_nang"]) or looks_non_vietnamese(j["phuc_loi"])
    ]
    print(f"{len(to_translate)}/{len(jobs)} jobs need translation")

    service = get_enrichment_service()
    translated, errors = 0, 0
    for i, job in enumerate(to_translate, 1):
        try:
            new_skills = job["ky_nang"]
            new_benefits = job["phuc_loi"]
            if looks_non_vietnamese(job["ky_nang"]):
                new_skills = service.translate_job_text_to_vietnamese(job["ky_nang"])
            if looks_non_vietnamese(job["phuc_loi"]):
                new_benefits = service.translate_job_text_to_vietnamese(job["phuc_loi"])

            cur.execute(
                "UPDATE job_listings SET ky_nang = %s, phuc_loi = %s WHERE id = %s",
                (new_skills, new_benefits, job["id"]),
            )
            conn.commit()
            translated += 1
            print(f"  [{i}/{len(to_translate)}] #{job['id']} {job['ten_doanh_nghiep']} - {job['tieu_de']}")
        except Exception as e:
            print(f"  [{i}/{len(to_translate)}] ERROR #{job['id']}: {e}")
            errors += 1
        time.sleep(DELAY_BETWEEN_CALLS_SEC)

    print(f"\nDone. translated={translated} errors={errors}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
