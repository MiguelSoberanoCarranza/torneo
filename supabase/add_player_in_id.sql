-- Add player_in_id for substitutions
ALTER TABLE public.match_events ADD COLUMN IF NOT EXISTS player_in_id UUID REFERENCES public.players(id) ON DELETE SET NULL;
