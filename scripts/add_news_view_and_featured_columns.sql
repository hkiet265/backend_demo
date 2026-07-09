-- Migration: track real view counts and a featured flag for news moderation
ALTER TABLE station_news ADD COLUMN IF NOT EXISTS luot_xem INT DEFAULT 0;
ALTER TABLE station_news ADD COLUMN IF NOT EXISTS noi_bat BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN station_news.luot_xem IS 'Real view counter, incremented on GET /api/news/{id}';
COMMENT ON COLUMN station_news.noi_bat IS 'Admin-toggled featured flag';
