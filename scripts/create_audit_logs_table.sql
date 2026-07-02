-- Create Audit Logs Table
-- Track all changes for compliance and history

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, LOGIN, etc.
    resource_type VARCHAR(50) NOT NULL,  -- BUSINESS, NEWS, USER, etc.
    resource_id INTEGER,  -- ID of the affected resource
    old_value JSONB,  -- Old value (for UPDATE/DELETE)
    new_value JSONB,  -- New value (for CREATE/UPDATE)
    changes JSONB,  -- List of field changes
    ip_address VARCHAR(45),  -- IPv4 or IPv6
    user_agent TEXT,  -- Browser/client info
    details TEXT,  -- Additional notes
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_user_resource ON audit_logs(user_id, resource_type, created_at DESC);

COMMENT ON TABLE audit_logs IS 'Audit trail for all system changes';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected';
COMMENT ON COLUMN audit_logs.changes IS 'JSON array of field-level changes';
