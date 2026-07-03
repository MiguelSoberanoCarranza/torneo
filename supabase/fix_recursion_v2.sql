-- =====================================================
-- FIX DEFINITIVO: Romper el ciclo leagues ↔ league_followers
-- =====================================================
-- Problema:
--   leagues_select_policy consulta league_followers
--   league_followers_select_policy consulta leagues
--   → RECURSIÓN INFINITA
--
-- Solución:
--   Reemplazar la subquery recursiva con una función
--   SECURITY DEFINER que bypassee RLS
-- =====================================================

-- Crear función helper para chequear si el usuario es owner de una liga
CREATE OR REPLACE FUNCTION public.is_league_owner(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_league_owner(UUID) TO anon, authenticated;

-- =====================================================
-- PASO 1: Recrear league_followers_select_policy
-- (sin referenciar leagues directamente, usa la función)
-- =====================================================
DROP POLICY IF EXISTS "league_followers_select_policy" ON public.league_followers;
CREATE POLICY "league_followers_select_policy"
  ON public.league_followers FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR public.is_league_owner(league_id)
  );

-- =====================================================
-- PASO 2: Recrear leagues_select_policy
-- (la subquery de league_followers sigue, pero ahora
--  league_followers ya no consulta leagues)
-- =====================================================
DROP POLICY IF EXISTS "leagues_select_policy" ON public.leagues;
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

-- =====================================================
-- PASO 3: Verificar que no haya otros ciclos
-- (en otras policies que consultan tablas con RLS)
-- =====================================================
-- NOTA: las policies de teams, matches, players, match_events,
-- referees que referencian leagues deberían usar is_league_owner()
-- para mantener consistencia y prevenir futuros ciclos.
-- Pero como solo consultan para INSERT/UPDATE/DELETE (no SELECT),
-- no deberían causar recursión en SELECTs.

-- Recrear policies que usan subquery a leagues (MODIFY) para usar is_league_owner
DROP POLICY IF EXISTS "teams_modify_policy" ON public.teams;
CREATE POLICY "teams_modify_policy"
  ON public.teams FOR ALL
  USING (
    public.is_league_owner(league_id)
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = teams.league_id
      AND public.is_tournament_owner(l.id)
    )
  )
  WITH CHECK (
    public.is_league_owner(league_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "matches_modify_policy" ON public.matches;
CREATE POLICY "matches_modify_policy"
  ON public.matches FOR ALL
  USING (
    public.is_league_owner(league_id)
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = matches.league_id
      AND public.is_tournament_owner(l.id)
    )
  )
  WITH CHECK (
    public.is_league_owner(league_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "players_modify_policy" ON public.players;
CREATE POLICY "players_modify_policy"
  ON public.players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams tm
      WHERE tm.id = players.team_id
      AND (
        public.is_league_owner(tm.league_id)
        OR public.is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams tm
      WHERE tm.id = players.team_id
      AND (
        public.is_league_owner(tm.league_id)
        OR public.is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "match_events_modify_policy" ON public.match_events;
CREATE POLICY "match_events_modify_policy"
  ON public.match_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_events.match_id
      AND (
        public.is_league_owner(m.league_id)
        OR public.is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_events.match_id
      AND (
        public.is_league_owner(m.league_id)
        OR public.is_admin()
      )
    )
  );

-- =====================================================
-- PASO 4: Test final - ESTO ES LO QUE HACE LA APP
-- =====================================================
-- Simulamos la query de LeagueSelectorScreen
SELECT id, name, slug, is_public, owner_id
FROM public.leagues
ORDER BY created_at DESC
LIMIT 5;

-- También probamos la query de league_followers (que era parte del ciclo)
SELECT *
FROM public.league_followers
LIMIT 5;

-- Recargar schema cache
NOTIFY pgrst, 'reload config';
