"""
backfill_job_details.py ran while both Groq and Gemini quota were
exhausted — translate_job_description_to_vietnamese fails soft (returns
the original text unchanged) rather than blocking the backfill, so ~48
descriptions were saved still in English. This just re-attempts the
translation step for those, no page re-fetch needed (mo_ta_cong_viec is
already in the DB).

    python scripts/translate_remaining_job_descriptions.py
"""
import sys
import time

sys.path.insert(0, ".")

import psycopg2
import psycopg2.extras
from app.config import settings
from app.services.ai_enrichment_service import get_enrichment_service, looks_non_vietnamese

DELAY_BETWEEN_CALLS_SEC = 1.5


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT id, ten_doanh_nghiep, tieu_de, mo_ta_cong_viec FROM job_listings "
        "WHERE trang_thai = 'Da_duyet' AND mo_ta_cong_viec IS NOT NULL;"
    )
    jobs = [j for j in cur.fetchall() if looks_non_vietnamese(j["mo_ta_cong_viec"])]
    print(f"{len(jobs)} descriptions still need translation")

    service = get_enrichment_service()
    translated, still_english, errors = 0, 0, 0
    for i, job in enumerate(jobs, 1):
        try:
            result = service.translate_job_description_to_vietnamese(job["mo_ta_cong_viec"])
        except Exception as e:
            print(f"  [{i}/{len(jobs)}] ERROR #{job['id']}: {e}")
            errors += 1
            time.sleep(DELAY_BETWEEN_CALLS_SEC)
            continue

        if result and not looks_non_vietnamese(result):
            cur.execute("UPDATE job_listings SET mo_ta_cong_viec = %s WHERE id = %s", (result, job["id"]))
            conn.commit()
            translated += 1
            print(f"  [{i}/{len(jobs)}] #{job['id']} {job['ten_doanh_nghiep']} -> translated")
        else:
            still_english += 1
            print(f"  [{i}/{len(jobs)}] #{job['id']} {job['ten_doanh_nghiep']} -> still English (quota?)")

        time.sleep(DELAY_BETWEEN_CALLS_SEC)

    print(f"\nDone. translated={translated} still_english={still_english} errors={errors}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
