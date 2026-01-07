-- 1. Enable RLS on Leagues table (if not already enabled)
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- 2. Allow everyone to SEE leagues (so they appear in Dashboard)
DROP POLICY IF EXISTS "Leagues are viewable by everyone." ON public.leagues;
CREATE POLICY "Leagues are viewable by everyone." ON public.leagues FOR SELECT USING (true);

-- 3. Allow Authenticated users to CREATE leagues
DROP POLICY IF EXISTS "Auth users can create leagues" ON public.leagues;
CREATE POLICY "Auth users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Allow Owners to UPDATE their leagues
DROP POLICY IF EXISTS "Owners can update their leagues" ON public.leagues;
CREATE POLICY "Owners can update their leagues" ON public.leagues FOR UPDATE USING (auth.uid() = owner_id);

-- 5. Reload Cache
NOTIFY pgrst, 'reload config';
