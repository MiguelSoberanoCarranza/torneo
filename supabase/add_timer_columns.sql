-- Add last_start_time to matches to track precise timer duration
-- Using standard timestamptz type
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS last_start_time timestamptz;

-- Ensure elapsed_seconds defaults to 0
ALTER TABLE matches 
ALTER COLUMN elapsed_seconds SET DEFAULT 0;
