-- Em Tư Database Initialization Script
-- This script sets up all tables and sample data

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS app_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Businesses Table
CREATE TABLE IF NOT EXISTS businesses_demo (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500),
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(500),
    address TEXT,
    city VARCHAR(255),
    region VARCHAR(100),
    industry VARCHAR(255),
    description TEXT,
    trust_score INTEGER DEFAULT 0,
    user_id INTEGER REFERENCES app_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Station News Table (with vector embeddings)
CREATE TABLE IF NOT EXISTS station_news (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    category VARCHAR(100),
    source VARCHAR(255),
    url TEXT UNIQUE,
    published_date TIMESTAMP,
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Alert History Table
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses_demo(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    field_name VARCHAR(100),
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'active',
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES app_users(id),
    username VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    old_value JSONB,
    new_value JSONB,
    changes JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    details TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
    news_id INTEGER REFERENCES station_news(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, news_id)
);

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES app_users(id),
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses_demo(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_updated_at ON businesses_demo(updated_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_business_id ON alert_history(business_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_station_news_published_date ON station_news(published_date);

-- Function to auto-cleanup old alerts
CREATE OR REPLACE FUNCTION cleanup_old_alert_history()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM alert_history
    WHERE status = 'resolved'
    AND resolved_at < NOW() - INTERVAL '15 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample users
-- Password: admin123 (hashed with bcrypt)
INSERT INTO app_users (email, username, hashed_password, full_name, role) VALUES
('admin@emtu.vn', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIvApYrZ8u', 'Admin EmTu', 'admin'),
('user1@emtu.vn', 'user1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIvApYrZ8u', 'Nguyễn Văn A', 'user'),
('user2@emtu.vn', 'user2', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIvApYrZ8u', 'Trần Thị B', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insert sample businesses with various data quality issues
INSERT INTO businesses_demo (name, email, phone, website, address, city, region, industry, description, trust_score, user_id, updated_at) VALUES
-- Good quality data (user_id=1 - admin)
('Công ty TNHH Công Nghệ ABC', 'contact@abc.vn', '+84901234567', 'https://abc.vn', '123 Nguyễn Huệ', 'Hà Nội', 'Bắc', 'Công Nghệ Thông Tin', 'Công ty chuyên phát triển phần mềm', 95, 1, NOW()),

-- Missing email (user_id=2)
('Nhà Hàng Hải Sản XYZ', NULL, '+84912345678', 'https://xyz.vn', '456 Lê Lợi', 'Đà Nẵng', 'Trung', 'F&B / Thực Phẩm', 'Nhà hàng hải sản tươi sống', 60, 2, NOW()),

-- Missing phone (user_id=2)
('Cửa Hàng Thời Trang DEF', 'info@def.vn', NULL, 'https://def.vn', '789 Trần Hưng Đạo', 'TP.HCM', 'Nam', 'Bán Lẻ', 'Thời trang công sở', 65, 2, NOW()),

-- Missing address (user_id=3)
('Công ty Du Lịch GHI', 'hello@ghi.vn', '+84923456789', 'https://ghi.vn', NULL, 'Nha Trang', 'Trung', 'Du Lịch & Khách Sạn', 'Tổ chức tour du lịch', 70, 3, NOW()),

-- Invalid email (user_id=3)
('Xưởng Sản Xuất JKL', 'invalid-email', '+84934567890', NULL, '321 Võ Văn Tần', 'Bình Dương', 'Nam', 'Sản Xuất', 'Sản xuất đồ gỗ nội thất', 50, 3, NOW()),

-- Invalid phone (user_id=2)
('Trung Tâm Giáo Dục MNO', 'contact@mno.vn', '123', 'https://mno.vn', '654 Hai Bà Trưng', 'Hải Phòng', 'Bắc', 'Giáo Dục & Đào Tạo', 'Đào tạo tiếng Anh', 55, 2, NOW()),

-- Outdated data (1 year old) (user_id=1)
('Công ty Cũ PQR', 'old@pqr.vn', '+84945678901', 'https://pqr.vn', '987 Lý Thường Kiệt', 'Cần Thơ', 'Nam', 'Thương Mại Điện Tử', 'Chưa update lâu rồi', 40, 1, NOW() - INTERVAL '400 days'),

-- Multiple issues (user_id=3)
('Doanh Nghiệp STU', 'bad-email', '12', NULL, 'Quận 1', 'TP.HCM', 'Nam', 'Khác', 'Nhiều vấn đề', 30, 3, NOW() - INTERVAL '200 days')
ON CONFLICT DO NOTHING;

-- Insert sample news articles
INSERT INTO station_news (title, content, category, source, url, published_date) VALUES
('Ra mắt công nghệ AI mới tại Việt Nam', 'Một công ty khởi nghiệp Việt Nam vừa ra mắt nền tảng AI...', 'Công Nghệ', 'VTV', 'https://vtv.vn/cong-nghe-ai-1', NOW() - INTERVAL '1 day'),
('Thị trường bất động sản tăng trưởng mạnh', 'Giá nhà đất tại TP.HCM tăng 15% trong quý này...', 'Kinh Tế', 'VNExpress', 'https://vnexpress.net/bds-tang-1', NOW() - INTERVAL '2 days'),
('Du lịch Việt Nam hút khách quốc tế', 'Số lượng khách du lịch quốc tế đến Việt Nam tăng...', 'Du Lịch', 'VOV', 'https://vov.vn/du-lich-1', NOW() - INTERVAL '3 days')
ON CONFLICT (url) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database initialized successfully!';
    RAISE NOTICE '📊 Created tables: app_users, businesses_demo, station_news, alert_history, audit_logs, bookmarks, notifications';
    RAISE NOTICE '👤 Sample users: admin@emtu.vn (password: admin123)';
    RAISE NOTICE '🏢 Sample businesses: 8 records with various data quality issues';
    RAISE NOTICE '📰 Sample news: 3 articles';
END $$;
