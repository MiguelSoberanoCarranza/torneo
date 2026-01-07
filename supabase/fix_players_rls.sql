-- Enable RLS on players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read players (matches the policy in schema.sql but making it explicit/ensuring it exists)
-- Note: schema.sql had "Teams are viewable by everyone" but we should double check players.
-- schema.sql reference: CREATE POLICY "Matches are viewable by everyone." ON public.matches FOR SELECT USING (true);
-- Let's enable public read for players as well for now.
DROP POLICY IF EXISTS "Players are viewable by everyone" ON public.players;
CREATE POLICY "Players are viewable by everyone" ON public.players FOR SELECT USING (true);

-- Allow authenticated users to insert players
DROP POLICY IF EXISTS "Auth users can create players" ON public.players;
CREATE POLICY "Auth users can create players" 
ON public.players 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update players
DROP POLICY IF EXISTS "Auth users can update players" ON public.players;
CREATE POLICY "Auth users can update players" 
ON public.players 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete players
DROP POLICY IF EXISTS "Auth users can delete players" ON public.players;
CREATE POLICY "Auth users can delete players" 
ON public.players 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
