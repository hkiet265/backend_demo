-- Migration: Add employee count and job openings columns to businesses_demo
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS nhan_su INTEGER;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS dang_tuyen INTEGER;

COMMENT ON COLUMN businesses_demo.nhan_su IS 'Số lượng nhân sự (employee count)';
COMMENT ON COLUMN businesses_demo.dang_tuyen IS 'Số vị trí đang tuyển dụng (active job openings)';
