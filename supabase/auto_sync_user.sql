-- 1. Function to handle new user creation (Auth -> Profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name, avatar_url)
  VALUES (
    new.id, 
    new.email, 
    'user', -- Default role, will be updated by sync trigger if captain
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Function to Sync Captain Role/Team when Profile is created/updated
CREATE OR REPLACE FUNCTION public.sync_captain_role()
RETURNS TRIGGER AS $$
DECLARE
  team_record RECORD;
BEGIN
  -- Check if this user's email is listed as a captain for any team
  FOR team_record IN SELECT * FROM public.teams WHERE captain_email = new.email LOOP
    -- Link the manager (SECURITY DEFINER allows this even if user has no rights)
    UPDATE public.teams SET manager_id = new.id WHERE id = team_record.id;
    
    -- Upgrade role to captain if not admin (avoid downgrading admins)
    -- This update might cause recursion if trigger watched all columns. 
    -- We restricted trigger to INSERT or UPDATE OF email.
    IF new.role NOT IN ('admin', 'referee', 'captain') THEN
       -- Update the role directly on the record if it's a BEFORE trigger? 
       -- But we are in AFTER trigger for 'teams' link logic.
       -- Let's just run an update query.
       UPDATE public.profiles SET role = 'captain' WHERE id = new.id;
    END IF;
  END LOOP;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on public.profiles
DROP TRIGGER IF EXISTS on_profile_sync ON public.profiles;
CREATE TRIGGER on_profile_sync
  AFTER INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_captain_role();
