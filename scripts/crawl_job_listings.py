"""
Cào toàn bộ tin tuyển dụng thật (không chỉ 1 job/công ty) từ ITviec vào
bảng job_listings — dùng để hiển thị tab "Việc làm" duyệt được danh sách
job thật, thay vì chỉ có con số "đang tuyển dụng".

    python scripts/crawl_job_listings.py --max-companies 200
"""
import argparse
import sys

sys.path.insert(0, ".")

from app.config import settings
from app.database import init_db_pool, close_db_pool
from app.services.business_listing_crawler_service import get_business_listing_crawler_service


def main():
    parser = argparse.ArgumentParser(description="Crawl full job listings from ITviec company pages")
    parser.add_argument("--source", default="itviec")
    parser.add_argument("--max-companies", type=int, default=200)
    parser.add_argument("--max-jobs-per-company", type=int, default=8)
    args = parser.parse_args()

    init_db_pool(settings.database_url, minconn=1, maxconn=3)
    try:
        crawler = get_business_listing_crawler_service()
        result = crawler.crawl_and_save_jobs(args.source, args.max_companies, args.max_jobs_per_company)
        print(
            f"Companies visited: {result.get('companies_visited', 0)} | "
            f"Jobs found: {result.get('jobs_found', 0)} | Jobs saved: {result.get('jobs_saved', 0)} | "
            f"Errors: {result.get('errors', 0)}"
        )
    finally:
        close_db_pool()


if __name__ == "__main__":
    main()
