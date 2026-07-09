-- Migration: Add a real created_at column to businesses_demo (previously
-- only updated_at existed). Backfill existing rows from updated_at so
-- "recently added" stats have a sensible value instead of NULL.
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
UPDATE businesses_demo SET created_at = COALESCE(updated_at, NOW()) WHERE created_at IS NULL;
