-- 1. Update the role check constraint to include 'superadmin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('superadmin', 'admin', 'captain', 'referee', 'player', 'user'));

-- 2. Update the specific user to be superadmin
UPDATE public.profiles
SET role = 'superadmin'
WHERE email = 'meel0588@gmail.com';

-- 3. Update or Replace the is_admin function to authorize superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the policy to use is_superadmin instead of (or in addition to) is_admin
-- We want ONLY superadmin to update ANY profile (specifically generic roles)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Superadmins can update any profile"
ON public.profiles
FOR UPDATE
USING ( public.is_superadmin() );
