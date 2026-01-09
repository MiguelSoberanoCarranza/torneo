-- Create table for users following leagues
CREATE TABLE public.league_followers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, league_id) -- Prevent duplicate follows
);

-- Enable RLS
ALTER TABLE public.league_followers ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can view their own follows
CREATE POLICY "Users can view own follows" 
ON public.league_followers 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Users can insert (follow) their own record
CREATE POLICY "Users can follow leagues" 
ON public.league_followers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Users can delete (unfollow) their own record
CREATE POLICY "Users can unfollow leagues" 
ON public.league_followers 
FOR DELETE 
USING (auth.uid() = user_id);
