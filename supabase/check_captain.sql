-- Check if the user exists and what their role is
SELECT * FROM public.profiles WHERE email = 'miguelsoberanocarranz@gmail.com';

-- Check if any team has this email as captain_email
SELECT * FROM public.teams WHERE captain_email = 'miguelsoberanocarranz@gmail.com';

-- Check if the link (manager_id) is established
SELECT 
    p.email as user_email,
    p.role as user_role,
    t.name as team_name,
    t.captain_email as team_email,
    CASE 
        WHEN t.manager_id = p.id THEN 'LINKED OK' 
        ELSE 'NOT LINKED' 
    END as status
FROM public.profiles p
LEFT JOIN public.teams t ON p.id = t.manager_id
WHERE p.email = 'miguelsoberanocarranz@gmail.com';
