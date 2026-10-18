-- Deshace 2026-10-18_seguridad_rls.sql y deja los permisos abiertos como
-- estaban (cualquier usuario con sesión escribe en cualquier liga).
-- Úsalo solo si la migración rompe algo en producción y hay que volver atrás
-- mientras se corrige.
BEGIN;

DROP TRIGGER IF EXISTS trg_guard_profile_changes ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_profile_changes();
DROP POLICY IF EXISTS "Admins asignan capitan o arbitro" ON public.profiles;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('leagues', 'teams', 'players', 'matches',
                        'match_events', 'team_sanctions')
      AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Auth users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update leagues" ON public.leagues FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Owners can update their leagues" ON public.leagues FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Auth users can create teams" ON public.teams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update teams" ON public.teams FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Managers can update their own team" ON public.teams FOR UPDATE USING (auth.uid() = manager_id);

CREATE POLICY "Auth users can create players" ON public.players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update players" ON public.players FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete players" ON public.players FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can create matches" ON public.matches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update matches" ON public.matches FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete matches" ON public.matches FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth Insert Events" ON public.match_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Update Events" ON public.match_events FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Delete Events" ON public.match_events FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authorized users can insert team sanctions." ON public.team_sanctions FOR INSERT
  WITH CHECK (public.can_manage_team_sanctions(league_id));
CREATE POLICY "Authorized users can delete team sanctions." ON public.team_sanctions FOR DELETE
  USING (public.can_manage_team_sanctions(league_id));

COMMIT;
