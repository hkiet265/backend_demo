-- Migration: Add password-reset token columns to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_app_users_reset_token ON app_users(reset_token);
