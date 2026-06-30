-- Create bookmarks tables for news and businesses

-- Table for bookmarked news
CREATE TABLE IF NOT EXISTS user_bookmarks_news (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    news_id INTEGER NOT NULL REFERENCES station_news(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, news_id)
);

-- Table for bookmarked businesses
CREATE TABLE IF NOT EXISTS user_bookmarks_businesses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    business_id INTEGER NOT NULL REFERENCES businesses_demo(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, business_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_news_user ON user_bookmarks_news(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_news_created ON user_bookmarks_news(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_business_user ON user_bookmarks_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_business_created ON user_bookmarks_businesses(created_at DESC);

-- Show results
SELECT 'Bookmarks tables created successfully!' as status;
