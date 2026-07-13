"""
Cập nhật lại logo_url cho các doanh nghiệp đã cào từ ITviec — dùng khi
logo_url trong DB đang là ảnh banner rộng (og:image) thay vì logo vuông
thật (div.logo img). Chạy sau khi đã cào xong dữ liệu.

    python scripts/backfill_itviec_logos.py --max 1000
"""
import argparse
import sys

sys.path.insert(0, ".")

from app.config import settings
from app.database import init_db_pool, close_db_pool
from app.services.business_listing_crawler_service import get_business_listing_crawler_service


def main():
    parser = argparse.ArgumentParser(description="Backfill correct square logos for ITviec businesses")
    parser.add_argument("--max", type=int, default=1000, help="Số công ty tối đa để duyệt lại (mặc định 1000)")
    args = parser.parse_args()

    init_db_pool(settings.database_url, minconn=1, maxconn=3)
    try:
        crawler = get_business_listing_crawler_service()
        result = crawler.backfill_logos("itviec", args.max)
        print(f"Updated: {result['updated']} | Not found in DB: {result['not_found']} | Errors: {result['errors']}")
    finally:
        close_db_pool()


if __name__ == "__main__":
    main()
