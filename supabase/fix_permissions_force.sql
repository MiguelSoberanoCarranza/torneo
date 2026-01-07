-- Force Fix RLS for match_events
-- 1. Enable RLS (just in case)
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Match events are viewable by everyone." ON public.match_events;
DROP POLICY IF EXISTS "Auth users can insert match events" ON public.match_events;
DROP POLICY IF EXISTS "Auth users can update match events" ON public.match_events;
DROP POLICY IF EXISTS "Auth users can delete match events" ON public.match_events;
-- Also drop potential auto-generated ones
DROP POLICY IF EXISTS "Enable read access for all users" ON public.match_events;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.match_events;

-- 3. Re-create Permissive Policies
-- Read: Everyone
CREATE POLICY "Public Read Events" ON public.match_events FOR SELECT USING (true);

-- Write: Authenticated Users (Admins/Referees)
CREATE POLICY "Auth Insert Events" ON public.match_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Update Events" ON public.match_events FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Delete Events" ON public.match_events FOR DELETE USING (auth.role() = 'authenticated');
