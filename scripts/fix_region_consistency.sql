UPDATE businesses_demo 
SET vung_mien = 'Bac' 
WHERE vung_mien IN ('Bắc', 'bắc', 'BAC', 'bac');

UPDATE businesses_demo 
SET vung_mien = 'Trung' 
WHERE vung_mien IN ('trung', 'TRUNG');

UPDATE businesses_demo 
SET vung_mien = 'Nam' 
WHERE vung_mien IN ('nam', 'NAM');

UPDATE station_news 
SET vung_mien = 'Bac' 
WHERE vung_mien IN ('Bắc', 'bắc', 'BAC', 'bac');

UPDATE station_news 
SET vung_mien = 'Trung' 
WHERE vung_mien IN ('trung', 'TRUNG');

UPDATE station_news 
SET vung_mien = 'Nam' 
WHERE vung_mien IN ('nam', 'NAM');

-- Verify results
SELECT vung_mien, COUNT(*) as count
FROM businesses_demo
GROUP BY vung_mien
ORDER BY vung_mien;

SELECT vung_mien, COUNT(*) as count
FROM station_news
GROUP BY vung_mien
ORDER BY vung_mien;
