-- Add current_period column
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS current_period INTEGER DEFAULT 1;

-- Update status check constraint to include 'break'
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check 
  CHECK (status IN ('scheduled', 'live', 'break', 'finished', 'postponed'));
