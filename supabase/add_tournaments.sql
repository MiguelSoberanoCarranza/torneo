-- =====================================================
-- TABLA DE TORNEOS - Agrupa ligas bajo un mismo torneo
-- =====================================================

-- Tabla principal de torneos (con RLS deshabilitado inicialmente)
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  status TEXT CHECK (status IN ('draft', 'active', 'finished')) DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Agregar foreign key a leagues para vincularlas con torneos
ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL;

-- =====================================================
-- POLICIES RLS CON AISLAMIENTO POR CLIENTE
-- =====================================================

-- TORNEOS: Solo el dueño puede ver/modificar sus torneos
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON public.tournaments;
CREATE POLICY "Users can view own tournaments"
  ON public.tournaments FOR SELECT USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON public.tournaments;
CREATE POLICY "Users can create own tournaments"
  ON public.tournaments FOR INSERT WITH CHECK (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "Owners can update their tournaments" ON public.tournaments;
CREATE POLICY "Users can update own tournaments"
  ON public.tournaments FOR UPDATE USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "Owners can delete their tournaments" ON public.tournaments;
CREATE POLICY "Users can delete own tournaments"
  ON public.tournaments FOR DELETE USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- =====================================================
-- LEAGUES: Solo el dueño puede ver/modificar sus ligas
-- =====================================================

DROP POLICY IF EXISTS "Leagues are viewable by everyone." ON public.leagues;
CREATE POLICY "Users can view own leagues"
  ON public.leagues FOR SELECT USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "Auth users can create leagues" ON public.leagues;
CREATE POLICY "Users can create own leagues"
  ON public.leagues FOR INSERT WITH CHECK (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "Auth users can update leagues" ON public.leagues;
CREATE POLICY "Users can update own leagues"
  ON public.leagues FOR UPDATE USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- =====================================================
-- TEAMS: Solo el dueño de la liga puede ver/modificar equipos
-- =====================================================

DROP POLICY IF EXISTS "Teams are viewable by everyone." ON public.teams;
CREATE POLICY "Users can view own teams"
  ON public.teams FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leagues 
      WHERE leagues.id = teams.league_id 
      AND (leagues.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
    )
  );

DROP POLICY IF EXISTS "Users can manage own teams" ON public.teams;
CREATE POLICY "Users can manage own teams"
  ON public.teams FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leagues 
      WHERE leagues.id = teams.league_id 
      AND (leagues.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
    )
  );

-- =====================================================
-- MATCHES: Solo el dueño de la liga puede ver/modificar partidos
-- =====================================================

DROP POLICY IF EXISTS "Matches are viewable by everyone." ON public.matches;
CREATE POLICY "Users can view own matches"
  ON public.matches FOR SELECT USING (
    auth.uid() = (
      SELECT owner_id FROM public.leagues WHERE leagues.id = matches.league_id
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "Users can manage own matches" ON public.matches;
CREATE POLICY "Users can manage own matches"
  ON public.matches FOR ALL USING (
    auth.uid() = (
      SELECT owner_id FROM public.leagues WHERE leagues.id = matches.league_id
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- =====================================================
-- INDEX PARA MEJORAR RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tournaments_owner ON public.tournaments(owner_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_leagues_tournament ON public.leagues(tournament_id);
CREATE INDEX IF NOT EXISTS idx_leagues_owner ON public.leagues(owner_id);
