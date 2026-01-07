-- Enable RLS on players just in case
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Ensure photo_url column exists
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS photo_url text;

-- 1. VIEW POLICIES (Read)
DROP POLICY IF EXISTS "Players are viewable by everyone" ON public.players;
CREATE POLICY "Players are viewable by everyone" ON public.players FOR SELECT USING (true);

-- 2. INSERT POLICIES (Create)
DROP POLICY IF EXISTS "Auth users can insert players" ON public.players;
CREATE POLICY "Auth users can insert players" ON public.players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Also handling the old name if exists to avoid conflicts/duplicates in logic (though Drop Policy by name handles it)
DROP POLICY IF EXISTS "Auth users can create players" ON public.players; 

-- 3. UPDATE POLICIES (Edit)
DROP POLICY IF EXISTS "Auth users can update players" ON public.players;
CREATE POLICY "Auth users can update players" ON public.players FOR UPDATE USING (auth.role() = 'authenticated');

-- 4. DELETE POLICIES (Remove)
DROP POLICY IF EXISTS "Auth users can delete players" ON public.players;
CREATE POLICY "Auth users can delete players" ON public.players FOR DELETE USING (auth.role() = 'authenticated');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
