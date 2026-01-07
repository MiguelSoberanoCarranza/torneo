-- Add photo_url column to players table if it doesn't exist
-- We use a DO block to safely check or just catch the error, but 'IF NOT EXISTS' is standard in newer Postgres.
-- If your Postgres version is older and errors on IF NOT EXISTS, just comment out this line.
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url text;

-- Create storage bucket for player photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('player-photos', 'player-photos', true) 
ON CONFLICT (id) DO NOTHING;

-- Policies --

-- Helper to safely drop policy if exists to avoid "policy already exists" error
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'player-photos' );

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'player-photos' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE USING ( bucket_id = 'player-photos' AND auth.role() = 'authenticated' );
