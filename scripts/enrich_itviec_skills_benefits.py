"""
Bổ sung "Yêu cầu công việc" (kỹ năng, lưu vào cột tags) và "Tại sao bạn sẽ
yêu thích làm việc tại đây" (phúc lợi, lưu vào cột ghi_chu) cho các doanh
nghiệp đã cào từ ITviec — lấy từ tin tuyển dụng đang mở của công ty đó
(không có sẵn trên trang hồ sơ công ty).

    python scripts/enrich_itviec_skills_benefits.py --max 1000
"""
import argparse
import sys

sys.path.insert(0, ".")

from app.config import settings
from app.database import init_db_pool, close_db_pool
from app.services.business_listing_crawler_service import get_business_listing_crawler_service


def main():
    parser = argparse.ArgumentParser(description="Enrich ITviec businesses with skills/benefits from job postings")
    parser.add_argument("--max", type=int, default=1000, help="Số công ty tối đa để duyệt lại (mặc định 1000)")
    args = parser.parse_args()

    init_db_pool(settings.database_url, minconn=1, maxconn=3)
    try:
        crawler = get_business_listing_crawler_service()
        result = crawler.enrich_skills_benefits("itviec", args.max)
        print(
            f"Updated: {result['updated']} | No open job found: {result['no_job_found']} "
            f"| Not found in DB: {result['not_found']} | Errors: {result['errors']}"
        )
    finally:
        close_db_pool()


if __name__ == "__main__":
    main()
