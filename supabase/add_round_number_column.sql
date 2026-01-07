-- Add round_number column to matches table for Jornada grouping
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;

-- Optional: Update existing matches to have round 1 if separate rounds didn't exist
UPDATE public.matches SET round_number = 1 WHERE round_number IS NULL;
