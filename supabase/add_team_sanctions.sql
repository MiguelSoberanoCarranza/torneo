-- Sanciones disciplinarias a equipos (ajuste manual de puntos, sin vínculo a partido)

CREATE TABLE IF NOT EXISTS public.team_sanctions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  points_delta INTEGER NOT NULL CHECK (points_delta <> 0),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_sanctions_league_id ON public.team_sanctions(league_id);
CREATE INDEX IF NOT EXISTS idx_team_sanctions_team_id ON public.team_sanctions(team_id);

ALTER TABLE public.team_sanctions ENABLE ROW LEVEL SECURITY;

-- No recrear is_league_owner: puede existir ya en la BD con otro nombre de parámetro.
DROP FUNCTION IF EXISTS public.can_manage_team_sanctions(uuid);

CREATE OR REPLACE FUNCTION public.can_manage_team_sanctions(p_league_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Team sanctions are viewable by everyone." ON public.team_sanctions;
CREATE POLICY "Team sanctions are viewable by everyone."
  ON public.team_sanctions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authorized users can insert team sanctions." ON public.team_sanctions;
CREATE POLICY "Authorized users can insert team sanctions."
  ON public.team_sanctions FOR INSERT
  WITH CHECK (public.can_manage_team_sanctions(league_id));

DROP POLICY IF EXISTS "Authorized users can delete team sanctions." ON public.team_sanctions;
CREATE POLICY "Authorized users can delete team sanctions."
  ON public.team_sanctions FOR DELETE
  USING (public.can_manage_team_sanctions(league_id));

NOTIFY pgrst, 'reload config';
