-- =====================================================
-- RESTRUCTURACIÓN: Slug único por liga + Acceso privado al home
-- =====================================================
-- Cambios:
--   1. Agregar columna `slug` (único, generado del nombre)
--   2. Agregar columna `is_public` (true por defecto, controla si /l/:slug es público)
--   3. Trigger para generar slug automáticamente
--   4. RLS: solo el owner/admin/follower ven la liga en /home
--   5. /l/:slug es público si is_public = true
-- =====================================================
-- IMPORTANTE: Asume la estructura REAL del schema:
--   - teams: captain_name, captain_email (texto)
--   - players: is_captain (boolean)
--   - profiles.role: 'superadmin', 'admin', 'captain', 'referee', 'player', 'user'
--   - NO existe tabla referees (los árbitros son profiles con role='referee')
--   - league_followers: user_id, league_id
-- =====================================================

-- =====================================================
-- PASO 1: Crear tabla referees si no existe (compatibilidad)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.referees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(league_id, user_id)
);

ALTER TABLE public.referees ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 2: Agregar columnas slug e is_public a leagues
-- =====================================================
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- =====================================================
-- PASO 3: Función para generar slug
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_league_slug(_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
BEGIN
  -- Convertir a minúsculas, quitar acentos
  base_slug := lower(COALESCE(_name, 'liga'));
  base_slug := translate(base_slug,
    'áàäâãåéèëêíìïîóòöôõúùüûñç',
    'aaaaaaeeeeiiiioooooouuuunc'
  );
  -- Reemplazar todo lo que no sea alfanumérico por guiones
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  -- Quitar guiones al inicio/fin
  base_slug := trim(both '-' from base_slug);
  -- Limitar a 60 caracteres
  base_slug := substring(base_slug from 1 for 60);
  -- Quitar guion final si quedó
  base_slug := trim(both '-' from base_slug);

  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'liga';
  END IF;

  final_slug := base_slug;

  -- Si ya existe, agregar sufijo numérico
  WHILE EXISTS (SELECT 1 FROM public.leagues WHERE slug = final_slug) LOOP
    final_slug := base_slug || '-' || floor(random() * 10000)::text;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- =====================================================
-- PASO 4: Backfill de slugs para ligas existentes
-- =====================================================
DO $$
DECLARE
  league_record RECORD;
BEGIN
  FOR league_record IN SELECT id, name FROM public.leagues WHERE slug IS NULL LOOP
    UPDATE public.leagues
    SET slug = public.generate_league_slug(league_record.name)
    WHERE id = league_record.id;
  END LOOP;
END $$;

-- =====================================================
-- PASO 5: Trigger para generar slug al insertar/actualizar nombre
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_league_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_league_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_league_slug ON public.leagues;
CREATE TRIGGER trg_set_league_slug
  BEFORE INSERT OR UPDATE OF name ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_slug();

-- =====================================================
-- PASO 6: Hacer NOT NULL el slug (ahora que está backfilled)
-- =====================================================
DO $$
BEGIN
  -- Solo aplicar si todos los slugs están llenos
  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE slug IS NULL) THEN
    ALTER TABLE public.leagues ALTER COLUMN slug SET NOT NULL;
  END IF;
END $$;

-- Índice para mejorar performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_slug_unique ON public.leagues(slug);

-- =====================================================
-- PASO 7: Helpers SECURITY DEFINER (evitan recursión en RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tournament_owner(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leagues l
    JOIN public.tournaments t ON t.id = l.tournament_id
    WHERE l.id = p_league_id AND t.owner_id = auth.uid()
  );
$$;

-- =====================================================
-- PASO 8: Eliminar policies viejas y crear nuevas
-- =====================================================

-- ============ LEAGUES ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leagues'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.leagues', pol.policyname);
  END LOOP;
END $$;

-- SELECT: cualquier persona si es pública, o el owner/admin/follower
CREATE POLICY "leagues_select_policy"
  ON public.leagues FOR SELECT
  USING (
    is_public = true
    OR auth.uid() = owner_id
    OR public.is_admin()
    OR public.is_tournament_owner(id)
    OR EXISTS (
      SELECT 1 FROM public.league_followers lf
      WHERE lf.league_id = leagues.id AND lf.user_id = auth.uid()
    )
  );

-- INSERT: solo el usuario puede crear ligas propias
CREATE POLICY "leagues_insert_policy"
  ON public.leagues FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

-- UPDATE: owner de la liga, admin, o owner del torneo
CREATE POLICY "leagues_update_policy"
  ON public.leagues FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
    OR public.is_tournament_owner(id)
  );

-- DELETE: solo owner de la liga o admin
CREATE POLICY "leagues_delete_policy"
  ON public.leagues FOR DELETE
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
  );

-- ============ TEAMS ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'teams'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teams', pol.policyname);
  END LOOP;
END $$;

-- SELECT: visible si la liga es visible
CREATE POLICY "teams_select_policy"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = teams.league_id
    )
  );

-- ALL: solo owner/admin/tournament_owner
CREATE POLICY "teams_modify_policy"
  ON public.teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = teams.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = teams.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  );

-- ============ MATCHES ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'matches'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.matches', pol.policyname);
  END LOOP;
END $$;

-- SELECT: visible si la liga es visible
CREATE POLICY "matches_select_policy"
  ON public.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = matches.league_id
    )
  );

-- ALL: solo owner/admin/tournament_owner
CREATE POLICY "matches_modify_policy"
  ON public.matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = matches.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = matches.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  );

-- ============ PLAYERS ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'players'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', pol.policyname);
  END LOOP;
END $$;

-- SELECT: visible si la liga es visible
CREATE POLICY "players_select_policy" ON public.players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams tm
      WHERE tm.id = players.team_id
    )
  );

-- ALL: solo owner/admin/tournament_owner
CREATE POLICY "players_modify_policy" ON public.players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams tm
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tm.id = players.team_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams tm
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tm.id = players.team_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  );

-- ============ REFEREES (tabla) ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'referees'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.referees', pol.policyname);
  END LOOP;
END $$;

-- SELECT: visible si la liga es visible
CREATE POLICY "referees_select_policy" ON public.referees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = referees.league_id
    )
  );

-- ALL: solo owner/admin
CREATE POLICY "referees_modify_policy" ON public.referees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = referees.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = referees.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
      )
    )
  );

-- ============ MATCH_EVENTS ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'match_events'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.match_events', pol.policyname);
  END LOOP;
END $$;

-- SELECT: visible si el match es visible
CREATE POLICY "match_events_select_policy" ON public.match_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_events.match_id
    )
  );

-- ALL: solo owner/admin/tournament_owner
CREATE POLICY "match_events_modify_policy" ON public.match_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.leagues l ON l.id = m.league_id
      WHERE m.id = match_events.match_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.leagues l ON l.id = m.league_id
      WHERE m.id = match_events.match_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  );

-- ============ LEAGUE_FOLLOWERS ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'league_followers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_followers', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "league_followers_select_policy" ON public.league_followers FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_followers.league_id AND l.owner_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "league_followers_insert_policy" ON public.league_followers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "league_followers_delete_policy" ON public.league_followers FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ============ LEAGUE_INVITATIONS ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'league_invitations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_invitations', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "league_invitations_all_policy" ON public.league_invitations FOR ALL
  USING (
    auth.uid() = invited_by
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = invited_by
    OR public.is_admin()
  );

-- =====================================================
-- PASO 9: Garantizar GRANTs
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- SELECT: todos pueden ver (la RLS filtra)
GRANT SELECT ON public.leagues TO anon, authenticated;
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.referees TO anon, authenticated;
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT SELECT ON public.league_followers TO anon, authenticated;
GRANT SELECT ON public.league_invitations TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.tournaments TO anon, authenticated;

-- Solo autenticados pueden escribir
GRANT INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.referees TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.match_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_followers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_invitations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;

-- =====================================================
-- PASO 10: Forzar recarga del schema cache
-- =====================================================
NOTIFY pgrst, 'reload config';

-- =====================================================
-- PASO 11: Verificación
-- =====================================================
SELECT id, name, slug, is_public, owner_id
FROM public.leagues
ORDER BY created_at DESC
LIMIT 10;
