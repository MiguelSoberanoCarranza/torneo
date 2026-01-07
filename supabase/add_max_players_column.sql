ALTER TABLE public.leagues ADD COLUMN max_players_per_team INTEGER DEFAULT 20;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
