-- Unified Notifications Table (Simplified - No Foreign Keys)
-- Stores all types of notifications: alerts, news, social interactions

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    
    -- Notification Type & Category
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    
    -- Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    icon VARCHAR(50) DEFAULT '🔔',
    
    -- Priority & Status
    priority VARCHAR(20) DEFAULT 'medium',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    -- Related Resources
    related_type VARCHAR(50),
    related_id INTEGER,
    
    -- Additional Data
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    
    -- Constraints
    CHECK (type IN ('alert', 'news', 'social', 'system')),
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger for read_at
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_notification_read_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION set_notification_read_at();

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id INTEGER PRIMARY KEY,
    
    -- Enable/Disable by Type
    enable_alerts BOOLEAN DEFAULT TRUE,
    enable_news BOOLEAN DEFAULT TRUE,
    enable_social BOOLEAN DEFAULT TRUE,
    enable_system BOOLEAN DEFAULT TRUE,
    
    -- Alert Preferences
    alert_data_quality BOOLEAN DEFAULT TRUE,
    alert_outdated BOOLEAN DEFAULT TRUE,
    alert_missing_fields BOOLEAN DEFAULT TRUE,
    
    -- News Preferences
    news_new_articles BOOLEAN DEFAULT TRUE,
    news_trending BOOLEAN DEFAULT FALSE,
    news_related_businesses BOOLEAN DEFAULT TRUE,
    
    -- Social Preferences
    social_bookmarks BOOLEAN DEFAULT TRUE,
    social_comments BOOLEAN DEFAULT TRUE,
    social_mentions BOOLEAN DEFAULT TRUE,
    
    -- Delivery Settings
    auto_mark_read_after_days INTEGER DEFAULT 7,
    max_notifications INTEGER DEFAULT 100,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_prefs_updated_at
    BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_prefs_updated_at();
