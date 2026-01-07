-- Explicitly create the storage buckets in the system table
-- This is necessary if they weren't created via the Dashboard

-- 1. Create 'team-shields' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'team-shields', 
    'team-shields', 
    true, 
    5242880, -- 5MB limit (optional)
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'] -- Allowed types
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- 2. Create 'league-logos' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'league-logos', 
    'league-logos', 
    true, 
    5242880, 
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- 3. Create 'player-photos' bucket (just in case)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'player-photos', 
    'player-photos', 
    true, 
    5242880, 
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
