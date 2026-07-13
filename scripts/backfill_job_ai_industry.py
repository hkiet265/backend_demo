"""
Backfill job_listings.ai_industry for jobs whose company was never crawled
into businesses_demo (business_id NULL → no b.nganh_nghe to show as a tag).
Groups by company name so each company is only classified once (same
answer for every job of theirs), instead of once per job row.

    python scripts/backfill_job_ai_industry.py
"""
import sys
import time

sys.path.insert(0, ".")

import psycopg2
import psycopg2.extras
from app.config import settings
from app.services.ai_enrichment_service import get_enrichment_service

DELAY_BETWEEN_CALLS_SEC = 1.0


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT ten_doanh_nghiep, (array_agg(tieu_de))[1] as sample_title, count(*) as job_count
        FROM job_listings
        WHERE business_id IS NULL AND ai_industry IS NULL
        GROUP BY ten_doanh_nghiep
        ORDER BY job_count DESC;
        """
    )
    companies = cur.fetchall()
    print(f"{len(companies)} companies to classify ({sum(c['job_count'] for c in companies)} jobs)")

    service = get_enrichment_service()
    classified, unknown, errors = 0, 0, 0
    for i, company in enumerate(companies, 1):
        try:
            industry = service.classify_job_industry(company["ten_doanh_nghiep"], company["sample_title"])
        except Exception as e:
            print(f"  [{i}/{len(companies)}] ERROR {company['ten_doanh_nghiep']}: {e}")
            errors += 1
            continue

        if industry:
            cur.execute(
                "UPDATE job_listings SET ai_industry = %s WHERE ten_doanh_nghiep = %s AND business_id IS NULL",
                (industry, company["ten_doanh_nghiep"]),
            )
            conn.commit()
            classified += 1
        else:
            unknown += 1
        print(f"  [{i}/{len(companies)}] {company['ten_doanh_nghiep']} -> {industry or '(không rõ)'}")
        time.sleep(DELAY_BETWEEN_CALLS_SEC)

    print(f"\nDone. classified={classified} unknown={unknown} errors={errors}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
