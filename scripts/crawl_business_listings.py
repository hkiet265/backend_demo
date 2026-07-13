"""
Crawl real company data from recruitment sites (ITviec, TopCV, VietnamWorks)
into businesses_demo — dùng để thay dữ liệu mẫu/dỏm hiện tại.

Chạy thử với số lượng nhỏ trước (mặc định 5 công ty/nguồn) để kiểm tra chất
lượng dữ liệu trước khi tăng số lượng:

    python scripts/crawl_business_listings.py
    python scripts/crawl_business_listings.py --max-per-source 20
    python scripts/crawl_business_listings.py --source itviec --max-per-source 10
    python scripts/crawl_business_listings.py --dry-run   # chỉ in ra, không lưu DB
"""
import argparse
import sys

sys.path.insert(0, ".")

from app.config import settings
from app.database import init_db_pool, close_db_pool
from app.services.business_listing_crawler_service import (
    SOURCE_CONFIGS,
    get_business_listing_crawler_service,
)


def main():
    parser = argparse.ArgumentParser(description="Crawl business listings from recruitment sites")
    parser.add_argument("--source", choices=list(SOURCE_CONFIGS.keys()), default=None,
                         help="Chỉ crawl 1 nguồn (mặc định: cả 3)")
    parser.add_argument("--max-per-source", type=int, default=5,
                         help="Số công ty tối đa mỗi nguồn (mặc định 5, để test trước)")
    parser.add_argument("--dry-run", action="store_true",
                         help="Chỉ in kết quả, không lưu vào DB")
    args = parser.parse_args()

    crawler = get_business_listing_crawler_service()

    if args.source:
        results = {args.source: crawler.crawl_source(args.source, args.max_per_source)}
    else:
        results = crawler.crawl_all(args.max_per_source)

    all_companies = []
    print("\n" + "=" * 70)
    for source_key, result in results.items():
        companies = result.get("companies", [])
        all_companies.extend(companies)
        print(f"\n[{source_key}] links found: {result.get('found_links', 0)} | parsed: {len(companies)}")
        if result.get("error"):
            print(f"  ⚠️  error: {result['error']}")
        for c in companies:
            print(f"  - {c['ten_doanh_nghiep']} | web={c.get('website')} | logo={'yes' if c.get('logo_url') else 'no'}")

    print("\n" + "=" * 70)
    print(f"Total parsed: {len(all_companies)}")

    if args.dry_run:
        print("Dry run — not saved to DB.")
        return

    if not all_companies:
        print("Nothing to save.")
        return

    init_db_pool(settings.database_url, minconn=1, maxconn=3)
    try:
        save_result = crawler.save_companies_to_db(all_companies)
        print(f"Inserted: {save_result['inserted']} | Skipped (duplicate name): {save_result['skipped']} | Errors: {save_result['errors']}")
    finally:
        close_db_pool()


if __name__ == "__main__":
    main()
