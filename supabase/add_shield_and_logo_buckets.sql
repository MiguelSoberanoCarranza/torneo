-- Ensure columns exist (idempotent)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS shield_url text;
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS logo_url text;

-- Create Storage Buckets if they don't exist
-- Note: Supabase SQL doesn't have a direct "CREATE BUCKET IF NOT EXISTS" command easily accessible via standard SQL interface usually,
-- but we can insert into storage.buckets if we have permissions, or just assume the user will create them or we use the client.
-- However, for RLS policies to work, the buckets represent 'bucket_id'.

-- 1. Team Shields Bucket Policies
-- Allow PUBLIC READ
DROP POLICY IF EXISTS "Public Access Shields" ON storage.objects;
CREATE POLICY "Public Access Shields" ON storage.objects FOR SELECT USING ( bucket_id = 'team-shields' );

-- Allow AUTHENTICATED UPLOAD
DROP POLICY IF EXISTS "Auth Upload Shields" ON storage.objects;
CREATE POLICY "Auth Upload Shields" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'team-shields' AND auth.role() = 'authenticated'
);

-- Allow AUTHENTICATED UPDATE (Overwrite)
DROP POLICY IF EXISTS "Auth Update Shields" ON storage.objects;
CREATE POLICY "Auth Update Shields" ON storage.objects FOR UPDATE USING (
    bucket_id = 'team-shields' AND auth.role() = 'authenticated'
);


-- 2. League Logos Bucket Policies
-- Allow PUBLIC READ
DROP POLICY IF EXISTS "Public Access League Logos" ON storage.objects;
CREATE POLICY "Public Access League Logos" ON storage.objects FOR SELECT USING ( bucket_id = 'league-logos' );

-- Allow AUTHENTICATED UPLOAD
DROP POLICY IF EXISTS "Auth Upload League Logos" ON storage.objects;
CREATE POLICY "Auth Upload League Logos" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'league-logos' AND auth.role() = 'authenticated'
);

-- Allow AUTHENTICATED UPDATE (Overwrite)
DROP POLICY IF EXISTS "Auth Update League Logos" ON storage.objects;
CREATE POLICY "Auth Update League Logos" ON storage.objects FOR UPDATE USING (
    bucket_id = 'league-logos' AND auth.role() = 'authenticated'
);

-- Note: You might need to manually create the buckets 'team-shields' and 'league-logos' in the Supabase Dashboard 
-- if this script is only setting up policies and columns.
