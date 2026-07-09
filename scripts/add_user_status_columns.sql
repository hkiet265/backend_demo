-- Migration: Add real account status + last login tracking to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
COMMENT ON COLUMN app_users.status IS 'active | pending | locked';
