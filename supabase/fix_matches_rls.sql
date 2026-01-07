-- Enable RLS on matches if not already enabled (good practice to be explicit)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert matches
CREATE POLICY "Auth users can create matches" 
ON public.matches 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update matches
CREATE POLICY "Auth users can update matches" 
ON public.matches 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete matches
CREATE POLICY "Auth users can delete matches" 
ON public.matches 
FOR DELETE 
USING (auth.role() = 'authenticated');
