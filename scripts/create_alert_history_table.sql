-- Alert History Table
-- Stores historical records of alerts for businesses
-- Auto-cleanup: Records older than 15 days will be deleted

CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- outdated, missing_field, invalid
    severity VARCHAR(20) NOT NULL, -- critical, high, medium, low
    message TEXT NOT NULL,
    field_name VARCHAR(100), -- which field has the issue (optional)
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP, -- when the issue was fixed
    status VARCHAR(20) DEFAULT 'active', -- active, resolved, ignored
    metadata JSONB, -- additional data (old_value, new_value, etc.)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_history_business_id ON alert_history(business_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_detected_at ON alert_history(detected_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_cleanup ON alert_history(detected_at, status) WHERE status = 'resolved';

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_alert_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_alert_history_updated_at
    BEFORE UPDATE ON alert_history
    FOR EACH ROW
    EXECUTE FUNCTION update_alert_history_updated_at();

-- Function to cleanup old resolved alerts (older than 15 days)
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

-- Add comment
COMMENT ON TABLE alert_history IS 'Stores alert history for businesses. Auto-cleanup removes resolved alerts older than 15 days.';
COMMENT ON COLUMN alert_history.alert_type IS 'Type of alert: outdated, missing_field, invalid';
COMMENT ON COLUMN alert_history.severity IS 'Severity level: critical, high, medium, low';
COMMENT ON COLUMN alert_history.status IS 'Current status: active, resolved, ignored';
COMMENT ON COLUMN alert_history.resolved_at IS 'Timestamp when the alert was resolved';
COMMENT ON FUNCTION cleanup_old_alert_history() IS 'Deletes resolved alerts older than 15 days. Returns count of deleted records.';
