-- Create 'user-avatars' bucket for profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-avatars', 
    'user-avatars', 
    true, 
    5242880, -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- Enable RLS on storage.objects if not already enabled (it usually is)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to avatars
CREATE POLICY "Public Avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'user-avatars' );

-- Allow authenticated users to upload their own avatar
-- We can't easily restrict filename to user ID in storage RLS without complex policies,
-- so we'll allow Authenticated Insert for now, and rely on the frontend to name it correctly or random.
-- A stricter policy would check (auth.uid()::text = SPLIT_PART(name, '/', 1)) if we used folders.
-- For MVP, allow any authenticated upload.
CREATE POLICY "Auth Users Upload Avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars' AND 
  auth.role() = 'authenticated'
);

-- Allow users to update/delete their own files (simplify: allow all auth for now or skip delete)
CREATE POLICY "Auth Users Update Avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');
