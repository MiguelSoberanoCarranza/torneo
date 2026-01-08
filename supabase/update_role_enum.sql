-- Drop existing constraint if it exists (handling potential naming variations)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add updated constraint including 'captain'
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'captain', 'referee', 'player', 'user'));

-- Ensure column exists (idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN 
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user'; 
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'captain', 'referee', 'player', 'user'));
    END IF; 
END $$;
