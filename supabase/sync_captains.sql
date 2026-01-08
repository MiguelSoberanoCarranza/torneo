-- 1. Update teams with missing manager_id based on captain_email
UPDATE public.teams t
SET manager_id = p.id
FROM public.profiles p
WHERE t.captain_email = p.email
AND t.manager_id IS NULL;

-- 2. Update profiles role to 'captain' for those who are managers users (and not admin)
UPDATE public.profiles p
SET role = 'captain'
FROM public.teams t
WHERE t.manager_id = p.id
AND p.role NOT IN ('admin', 'referee');

-- 3. (Optional) Force specific email to be captain if needed for testing
-- UPDATE public.profiles SET role = 'captain' WHERE email = 'your_email@example.com';
