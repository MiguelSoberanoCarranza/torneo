-- =====================================================
-- FIX DEFINITIVO: RLS SIN RECURSIÓN
-- =====================================================
-- El problema: policies de tournaments referenciaban leagues
-- y policies de leagues referenciaban tournaments → recursión.
--
-- Solución: SIMPLIFICAR. No hay chequeos cruzados entre
-- tablas en ninguna policy. Si la liga es pública (tiene
-- invite_code), se ve. Para UPDATE/DELETE seguimos
-- permitiendo owner, admin/superadmin, y tournament_owner
-- PERO usando una función SECURITY DEFINER para evitar
-- que se dispare la RLS de la tabla referenciada.
-- =====================================================

-- =====================================================
-- PASO 1: Backfill de invite_code
-- =====================================================
UPDATE public.leagues
SET invite_code = lower(substring(md5(random()::text) from 1 for 8))
WHERE invite_code IS NULL OR invite_code = '';

-- =====================================================
-- PASO 2: Trigger BEFORE INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_league_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := lower(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_league_invite_code ON public.leagues;
CREATE TRIGGER trg_set_league_invite_code
  BEFORE INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_invite_code();

-- =====================================================
-- PASO 3: Función helper SECURITY DEFINER
-- =====================================================
-- Esta función chequea si el usuario es owner del torneo
-- SIN disparar la RLS de tournaments (porque es SECURITY
-- DEFINER y ejecuta con permisos del owner de la función).
CREATE OR REPLACE FUNCTION public.is_tournament_owner(_league_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leagues l
    JOIN public.tournaments t ON t.id = l.tournament_id
    WHERE l.id = _league_id
    AND t.owner_id = auth.uid()
  );
$$;

-- También un helper para "es admin"
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$;

-- =====================================================
-- PASO 4: ELIMINAR TODAS las policies existentes
-- =====================================================
DO $$
DECLARE
  pol RECORD;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leagues', 'teams', 'matches', 'profiles', 'tournaments', 'league_followers', 'league_invitations', 'players', 'match_events', 'referees']
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- PASO 5: Crear policies nuevas (SIN recursión)
-- =====================================================

-- ----- LEAGUES: SELECT -----
-- Público si tiene invite_code, o si sos owner/admin/owner del torneo
CREATE POLICY "leagues_select_policy"
  ON public.leagues FOR SELECT
  USING (
    invite_code IS NOT NULL
    OR auth.uid() = owner_id
    OR public.is_admin()
    OR public.is_tournament_owner(id)
  );

-- ----- LEAGUES: INSERT -----
CREATE POLICY "leagues_insert_policy"
  ON public.leagues FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- ----- LEAGUES: UPDATE -----
CREATE POLICY "leagues_update_policy"
  ON public.leagues FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
    OR public.is_tournament_owner(id)
  );

-- ----- LEAGUES: DELETE -----
CREATE POLICY "leagues_delete_policy"
  ON public.leagues FOR DELETE
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
    OR public.is_tournament_owner(id)
  );

-- ----- TEAMS: SELECT -----
-- Si la liga es pública (tiene invite_code), cualquiera puede ver
-- los datos básicos del equipo (nombre, escudo). Datos sensibles
-- como jugadores se manejan en otra tabla con policy propia.
CREATE POLICY "teams_select_policy"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = teams.league_id
      AND (
        l.invite_code IS NOT NULL
        OR l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  );

-- ----- TEAMS: ALL -----
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

-- ----- MATCHES: SELECT -----
-- Regla: para usuarios autenticados comunes (no owner/admin),
-- sólo pueden ver los matches de LIGUILLA (round_number >= 100)
-- de ligas públicas (con invite_code).
-- El owner de la liga, el owner del torneo y los admins ven TODO.
CREATE POLICY "matches_select_policy"
  ON public.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = matches.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
        OR (
          l.invite_code IS NOT NULL
          AND matches.round_number >= 100
        )
      )
    )
  );

-- ----- MATCHES: ALL -----
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

-- ----- PROFILES: SELECT (público) -----
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  USING (true);

-- ----- PROFILES: UPDATE (solo el propio) -----
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----- TOURNAMENTS: SELECT -----
-- Público si sos owner, admin, o si hay ligas con invite_code
-- en este torneo (caso: alguien comparte liga, queremos que
-- se pueda ver el torneo también)
CREATE POLICY "tournaments_select_policy"
  ON public.tournaments FOR SELECT
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
  );

-- ----- TOURNAMENTS: ALL (modificación) -----
CREATE POLICY "tournaments_modify_policy"
  ON public.tournaments FOR ALL
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR public.is_admin()
  );

-- ----- LEAGUE_FOLLOWERS: SELECT -----
CREATE POLICY "league_followers_select_policy"
  ON public.league_followers FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- ----- LEAGUE_FOLLOWERS: INSERT -----
CREATE POLICY "league_followers_insert_policy"
  ON public.league_followers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ----- LEAGUE_FOLLOWERS: DELETE -----
CREATE POLICY "league_followers_delete_policy"
  ON public.league_followers FOR DELETE
  USING (auth.uid() = user_id);

-- ----- LEAGUE_INVITATIONS: SELECT -----
CREATE POLICY "league_invitations_select_policy"
  ON public.league_invitations FOR SELECT
  USING (
    auth.uid() = invited_by
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.email = league_invitations.email
    )
  );

-- ----- LEAGUE_INVITATIONS: INSERT -----
CREATE POLICY "league_invitations_insert_policy"
  ON public.league_invitations FOR INSERT
  WITH CHECK (auth.uid() = invited_by);

-- ----- LEAGUE_INVITATIONS: UPDATE -----
CREATE POLICY "league_invitations_update_policy"
  ON public.league_invitations FOR UPDATE
  USING (
    auth.uid() = invited_by
    OR public.is_admin()
  );

-- ----- LEAGUE_INVITATIONS: DELETE -----
CREATE POLICY "league_invitations_delete_policy"
  ON public.league_invitations FOR DELETE
  USING (
    auth.uid() = invited_by
    OR public.is_admin()
  );

-- ----- PLAYERS: SELECT -----
-- Privado: solo owner, admin o tournament_owner. Los viewers
-- públicos NO ven el roster de jugadores.
CREATE POLICY "players_select_policy"
  ON public.players FOR SELECT
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
  );

-- ----- PLAYERS: ALL -----
CREATE POLICY "players_modify_policy"
  ON public.players FOR ALL
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

-- ----- REFEREES: SELECT -----
-- Privado: solo owner, admin o tournament_owner
CREATE POLICY "referees_select_policy"
  ON public.referees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = referees.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  );

-- ----- REFEREES: ALL -----
CREATE POLICY "referees_modify_policy"
  ON public.referees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = referees.league_id
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
      WHERE l.id = referees.league_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
      )
    )
  );

-- ----- MATCH_EVENTS: SELECT -----
-- Si la liga es pública y el match es de liguilla, el evento
-- (gol, tarjeta, etc.) es visible. Si no, sólo owner/admin.
CREATE POLICY "match_events_select_policy"
  ON public.match_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.leagues l ON l.id = m.league_id
      WHERE m.id = match_events.match_id
      AND (
        l.owner_id = auth.uid()
        OR public.is_admin()
        OR public.is_tournament_owner(l.id)
        OR (
          l.invite_code IS NOT NULL
          AND m.round_number >= 100
        )
      )
    )
  );

-- ----- MATCH_EVENTS: ALL -----
CREATE POLICY "match_events_modify_policy"
  ON public.match_events FOR ALL
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

-- =====================================================
-- PASO 6: Garantizar GRANTs
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.leagues TO anon, authenticated;
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT SELECT ON public.league_followers TO anon, authenticated;
GRANT SELECT ON public.league_invitations TO anon, authenticated;
-- players, referees y match_events NO se exponen a anon (datos privados)
GRANT SELECT ON public.players TO authenticated;
GRANT SELECT ON public.referees TO authenticated;
GRANT SELECT ON public.match_events TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_followers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_invitations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.referees TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.match_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_tournament_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- =====================================================
-- PASO 7: Forzar recarga del schema cache de PostgREST
-- =====================================================
NOTIFY pgrst, 'reload config';

-- =====================================================
-- PASO 8: Verificación
-- =====================================================
-- Ver las policies activas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('leagues', 'teams', 'matches', 'profiles', 'tournaments')
ORDER BY tablename, cmd, policyname;

-- Ver las ligas con sus códigos
SELECT id, name, owner_id, tournament_id, invite_code
FROM public.leagues
ORDER BY created_at DESC
LIMIT 10;
