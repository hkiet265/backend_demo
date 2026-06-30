-- Add created_by_user_id column to businesses_demo table
-- This allows tracking which user created each business

ALTER TABLE businesses_demo 
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_created_by 
ON businesses_demo(created_by_user_id);

-- Add comment
COMMENT ON COLUMN businesses_demo.created_by_user_id IS 'ID of user who created this business';
