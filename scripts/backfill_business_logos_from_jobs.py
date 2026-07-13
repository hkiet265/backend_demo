"""
94 businesses were created straight from job_listings data (name + AI-
classified industry only — see rebuild_businesses_from_jobs.py) and have no
logo. Their company profile page was never crawled, but each one has at
least one job posting page, whose og:image meta tag is the company's own
logo (same fallback business_listing_crawler_service.parse_company_page
already uses for company pages).

    python scripts/backfill_business_logos_from_jobs.py
"""
import sys
import time

sys.path.insert(0, ".")

import psycopg2
import psycopg2.extras
from app.config import settings
from app.services.business_listing_crawler_service import (
    BusinessListingCrawlerService, DELAY_BETWEEN_REQUESTS_SEC,
)


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT b.id, b.ten_doanh_nghiep, (array_agg(j.url))[1] as sample_job_url
        FROM businesses_demo b
        JOIN job_listings j ON j.business_id = b.id
        WHERE b.logo_url IS NULL
        GROUP BY b.id, b.ten_doanh_nghiep
        ORDER BY b.id;
        """
    )
    businesses = cur.fetchall()
    print(f"{len(businesses)} businesses missing a logo")

    crawler = BusinessListingCrawlerService()
    updated, not_found, errors = 0, 0, 0
    for i, biz in enumerate(businesses, 1):
        try:
            logo_url = crawler.logo_from_job_page(biz["sample_job_url"])
        except Exception as e:
            print(f"  [{i}/{len(businesses)}] ERROR {biz['ten_doanh_nghiep']}: {e}")
            errors += 1
            time.sleep(DELAY_BETWEEN_REQUESTS_SEC)
            continue

        if logo_url:
            cur.execute("UPDATE businesses_demo SET logo_url = %s WHERE id = %s", (logo_url, biz["id"]))
            conn.commit()
            updated += 1
            print(f"  [{i}/{len(businesses)}] {biz['ten_doanh_nghiep']} -> {logo_url[:80]}")
        else:
            not_found += 1
            print(f"  [{i}/{len(businesses)}] {biz['ten_doanh_nghiep']} -> (không tìm thấy logo)")

        time.sleep(DELAY_BETWEEN_REQUESTS_SEC)

    print(f"\nDone. updated={updated} not_found={not_found} errors={errors}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
