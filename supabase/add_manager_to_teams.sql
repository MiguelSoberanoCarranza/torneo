-- Ensure 'captain' role is allowed (redundant if update_role_enum ran, but safe)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'captain', 'referee', 'player', 'user'));

-- Add columns to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS captain_name TEXT,
ADD COLUMN IF NOT EXISTS captain_email TEXT;

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Policy: Managers can update their own team
DROP POLICY IF EXISTS "Managers can update their own team" ON public.teams;
CREATE POLICY "Managers can update their own team" 
ON public.teams 
FOR UPDATE 
USING (auth.uid() = manager_id);

-- Update Players Policies so Managers can manage their players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can insert players to their team" ON public.players;
CREATE POLICY "Managers can insert players to their team" 
ON public.players 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = players.team_id 
    AND manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Managers can update players in their team" ON public.players;
CREATE POLICY "Managers can update players in their team" 
ON public.players 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = players.team_id 
    AND manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Managers can delete players in their team" ON public.players;
CREATE POLICY "Managers can delete players in their team" 
ON public.players 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = players.team_id 
    AND manager_id = auth.uid()
  )
);
