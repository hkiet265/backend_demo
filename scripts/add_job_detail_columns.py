"""
job_listings đã có cột dia_diem/mo_ta_cong_viec nhưng crawler ITviec chưa
bao giờ điền (0/250 dòng có dữ liệu) — tin tuyển dụng hiển thị thiếu thông
tin. Thêm các cột mới lấy từ JSON-LD JobPosting mà ITviec nhúng sẵn trong
mỗi trang tin (schema.org, không cần đăng nhập):
- han_nop: hạn nộp hồ sơ (validThrough)
- hinh_thuc_lam_viec: FULL_TIME/PART_TIME/... (employmentType)
- kinh_nghiem_thang: số tháng kinh nghiệm yêu cầu (experienceRequirements.monthsOfExperience)
- ngay_dang: ngày đăng tin thật trên ITviec (datePosted) — khác created_at
  (thời điểm hệ thống này crawl về)

Lưu ý: mức lương KHÔNG có trong dữ liệu này — ITviec luôn trả về chuỗi
placeholder "You'll love it" thay vì số thật, xác nhận qua nhiều tin mẫu
(kể cả tin có tiêu đề "Lương cạnh tranh"/"Attractive Salary") — không phải
lỗi crawl, đây là dữ liệu ITviec chủ động ẩn sau đăng nhập.

    python scripts/add_job_detail_columns.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS han_nop DATE;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS hinh_thuc_lam_viec VARCHAR(50);
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS kinh_nghiem_thang INTEGER;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS ngay_dang DATE;
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    print("job_listings detail columns ready (han_nop, hinh_thuc_lam_viec, kinh_nghiem_thang, ngay_dang).")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
