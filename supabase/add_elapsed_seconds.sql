-- Add elapsed_seconds column to persist match timer
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER DEFAULT 0;
