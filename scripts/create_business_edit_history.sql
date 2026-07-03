-- Tạo bảng lịch sử chỉnh sửa doanh nghiệp
CREATE TABLE IF NOT EXISTS business_edit_history (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses_demo(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index để tăng tốc độ query
CREATE INDEX IF NOT EXISTS idx_business_edit_history_business_id ON business_edit_history(business_id);
CREATE INDEX IF NOT EXISTS idx_business_edit_history_edited_at ON business_edit_history(edited_at);

-- Function tự động xóa lịch sử cũ hơn 15 ngày
CREATE OR REPLACE FUNCTION delete_old_edit_history()
RETURNS void AS $$
BEGIN
    DELETE FROM business_edit_history
    WHERE edited_at < NOW() - INTERVAL '15 days';
END;
$$ LANGUAGE plpgsql;

-- Có thể chạy định kỳ bằng cron job hoặc trigger
-- Hoặc gọi function này khi cần: SELECT delete_old_edit_history();

COMMENT ON TABLE business_edit_history IS 'Lưu lịch sử chỉnh sửa doanh nghiệp, tự động xóa sau 15 ngày';
COMMENT ON COLUMN business_edit_history.field_name IS 'Tên trường được sửa (name, industry, region, etc.)';
COMMENT ON COLUMN business_edit_history.old_value IS 'Giá trị cũ trước khi sửa';
COMMENT ON COLUMN business_edit_history.new_value IS 'Giá trị mới sau khi sửa';
