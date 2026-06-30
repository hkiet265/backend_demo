-- Fix business ownership
-- Replace 'YOUR_EMAIL_HERE' with your actual email address

-- Step 1: Check your user ID
-- Run this first to get your user ID
SELECT id, email, full_name FROM users WHERE email = 'YOUR_EMAIL_HERE';

-- Step 2: Check businesses without owner
SELECT COUNT(*) FROM businesses_demo WHERE created_by_user_id IS NULL;

-- Step 3: Update businesses to assign to your user
-- Replace YOUR_USER_ID with the ID from Step 1
UPDATE businesses_demo 
SET created_by_user_id = YOUR_USER_ID 
WHERE created_by_user_id IS NULL;

-- Step 4: Verify the update
SELECT 
    u.email,
    u.full_name,
    COUNT(b.id) as total_businesses
FROM users u
LEFT JOIN businesses_demo b ON b.created_by_user_id = u.id
GROUP BY u.id, u.email, u.full_name
ORDER BY total_businesses DESC;
