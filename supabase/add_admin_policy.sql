-- Create a secure function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS logic for Admins to update ANY profile
-- First, drop existing policy if it conflicts or is too narrow (we keep the "own profile" one)
-- This new policy is additive.

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING ( public.is_admin() );

-- Admins also need to be able to INSERT profiles? (Likely handled by auth triggers or self-registration, but let's stick to update for role changing)
