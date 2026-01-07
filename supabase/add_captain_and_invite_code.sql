-- Add captain details to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_email TEXT;

-- Add invite code to leagues with a default random 6-character string
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS invite_code TEXT DEFAULT substr(md5(random()::text), 1, 6);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
