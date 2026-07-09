-- Migration: Add logo_url to businesses_demo (favicon/logo scraped from
-- the business website) and anh_dai_dien is reused for station_news images.
ALTER TABLE businesses_demo ADD COLUMN IF NOT EXISTS logo_url TEXT;
