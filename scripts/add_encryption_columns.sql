-- Migration: Add encryption columns for sensitive data
-- Run this SQL on Supabase database

-- Add encrypted columns
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS so_dien_thoai_encrypted TEXT;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS email_encrypted TEXT;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS dia_chi_encrypted TEXT;

-- Add hash columns for search/deduplication
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(16);
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS email_hash VARCHAR(16);

-- Add GDPR/PDPA compliance columns
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS consent_obtained BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS consent_date TIMESTAMP;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'Manual Input';
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS deletion_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create indexes for hash columns (faster search)
CREATE INDEX IF NOT EXISTS idx_businesses_phone_hash ON businesses_demo(phone_hash);
CREATE INDEX IF NOT EXISTS idx_businesses_email_hash ON businesses_demo(email_hash);
CREATE INDEX IF NOT EXISTS idx_businesses_deletion_requested ON businesses_demo(deletion_requested);

-- Add comment
COMMENT ON COLUMN businesses_demo.so_dien_thoai_encrypted IS 'Fernet encrypted phone number';
COMMENT ON COLUMN businesses_demo.email_encrypted IS 'Fernet encrypted email';
COMMENT ON COLUMN businesses_demo.phone_hash IS 'SHA256 hash for search/deduplication';
COMMENT ON COLUMN businesses_demo.email_hash IS 'SHA256 hash for search/deduplication';
