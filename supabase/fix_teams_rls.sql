-- Enable RLS on teams if not already enabled (it should be, but good practice)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create teams
CREATE POLICY "Auth users can create teams" 
ON public.teams 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update teams
CREATE POLICY "Auth users can update teams" 
ON public.teams 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
