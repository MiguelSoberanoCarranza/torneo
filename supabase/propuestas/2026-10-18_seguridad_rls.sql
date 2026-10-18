-- =====================================================================
-- Seguridad: permisos por liga y candado de roles
-- PROPUESTA — NO se ha ejecutado en producción.
--
-- Qué cambia:
--   * Hoy cualquier usuario con sesión puede crear/editar/borrar ligas,
--     equipos, jugadores, partidos y eventos de CUALQUIER liga.
--     Después:
--       - Liga, equipos, partidos, sanciones: solo el dueño de la liga
--         (o superadmin).
--       - Marcador, reloj y eventos del partido: además los árbitros.
--       - Jugadores: además el capitán (manager) de ese equipo.
--   * Hoy cualquier usuario puede ponerse rol 'superadmin' a sí mismo.
--     Después:
--       - Nadie cambia su propio rol.
--       - Un admin solo puede convertir a 'user'/'player' en
--         'captain' o 'referee', y no puede tocar otros datos de ese perfil.
--       - Solo superadmin cambia cualquier rol.
--       - Al registrarse solo se permite rol 'user' o 'admin'
--         (como hoy hace la app).
--   * Las lecturas públicas no cambian.
--
-- Cómo aplicarlo:
--   1. Respaldo de la base.
--   2. Ejecutar en un proyecto de pruebas (o rama) y correr
--      supabase/propuestas/pruebas_seguridad.py contra él.
--   3. En producción: SQL Editor -> pegar este archivo -> Run.
--      Va dentro de BEGIN/COMMIT: si algo falla, no se aplica nada.
--   Para deshacerlo: 2026-10-18_seguridad_rls_deshacer.sql
-- =====================================================================
BEGIN;

-- ---------- Funciones de apoyo -------------------------------------------
-- SECURITY DEFINER para poder leer profiles/leagues sin depender de RLS.

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.my_role() = 'superadmin', false);
$$;

-- Dueño de la liga o superadmin.
CREATE OR REPLACE FUNCTION public.can_manage_league(p_league uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin()
      OR EXISTS (SELECT 1 FROM leagues WHERE id = p_league AND owner_id = auth.uid());
$$;

-- Lo anterior o árbitro (los árbitros no están ligados a una liga en el
-- modelo actual, así que pueden operar partidos de cualquier liga).
CREATE OR REPLACE FUNCTION public.can_officiate_league(p_league uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_league(p_league)
      OR coalesce(public.my_role() = 'referee', false);
$$;

CREATE OR REPLACE FUNCTION public.can_officiate_match(p_match uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_officiate_league((SELECT league_id FROM matches WHERE id = p_match));
$$;

-- Dueño de la liga del equipo, superadmin o capitán (manager) del equipo.
CREATE OR REPLACE FUNCTION public.can_manage_team(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = p_team
      AND (t.manager_id = auth.uid() OR public.can_manage_league(t.league_id))
  );
$$;

-- La función que ya usaban las sanciones queda igual de estricta.
CREATE OR REPLACE FUNCTION public.can_manage_team_sanctions(p_league_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_league(p_league_id);
$$;

-- ---------- Quitar todas las políticas de escritura actuales --------------
-- Se borran por tabla (sin depender de su nombre, que puede variar entre
-- lo que hay en el repo y lo que se aplicó en producción). Las de lectura
-- (SELECT) se conservan.
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

-- Lectura pública garantizada (por si alguna política "ALL" era la única
-- que daba lectura y se acaba de borrar).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leagues', 'teams', 'players', 'matches',
                           'match_events', 'team_sanctions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Lectura publica" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Lectura publica" ON public.%I FOR SELECT USING (true)', t);
  END LOOP;
END $$;

-- ---------- Ligas ----------------------------------------------------------
CREATE POLICY "Crear liga propia" ON public.leagues FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());
CREATE POLICY "Dueño edita su liga" ON public.leagues FOR UPDATE
  USING (public.can_manage_league(id))
  WITH CHECK (public.is_superadmin() OR owner_id = auth.uid());
CREATE POLICY "Dueño borra su liga" ON public.leagues FOR DELETE
  USING (public.can_manage_league(id));

-- ---------- Equipos --------------------------------------------------------
CREATE POLICY "Dueño crea equipos" ON public.teams FOR INSERT
  WITH CHECK (public.can_manage_league(league_id));
CREATE POLICY "Dueño edita equipos" ON public.teams FOR UPDATE
  USING (public.can_manage_league(league_id))
  WITH CHECK (public.can_manage_league(league_id));
CREATE POLICY "Dueño borra equipos" ON public.teams FOR DELETE
  USING (public.can_manage_league(league_id));
-- El capitán edita su equipo, sin poder cambiarlo de liga ni de capitán.
CREATE POLICY "Capitan edita su equipo" ON public.teams FOR UPDATE
  USING (manager_id = auth.uid())
  WITH CHECK (
    manager_id = auth.uid()
    AND league_id = (SELECT t.league_id FROM public.teams t WHERE t.id = teams.id)
  );

-- ---------- Jugadores ------------------------------------------------------
CREATE POLICY "Gestores crean jugadores" ON public.players FOR INSERT
  WITH CHECK (public.can_manage_team(team_id));
CREATE POLICY "Gestores editan jugadores" ON public.players FOR UPDATE
  USING (public.can_manage_team(team_id))
  WITH CHECK (public.can_manage_team(team_id));
CREATE POLICY "Gestores borran jugadores" ON public.players FOR DELETE
  USING (public.can_manage_team(team_id));

-- ---------- Partidos -------------------------------------------------------
CREATE POLICY "Dueño crea partidos" ON public.matches FOR INSERT
  WITH CHECK (public.can_manage_league(league_id));
CREATE POLICY "Dueño y arbitros editan partidos" ON public.matches FOR UPDATE
  USING (public.can_officiate_league(league_id))
  WITH CHECK (public.can_officiate_league(league_id));
CREATE POLICY "Dueño borra partidos" ON public.matches FOR DELETE
  USING (public.can_manage_league(league_id));

-- ---------- Eventos del partido -------------------------------------------
CREATE POLICY "Dueño y arbitros crean eventos" ON public.match_events FOR INSERT
  WITH CHECK (public.can_officiate_match(match_id));
CREATE POLICY "Dueño y arbitros editan eventos" ON public.match_events FOR UPDATE
  USING (public.can_officiate_match(match_id))
  WITH CHECK (public.can_officiate_match(match_id));
CREATE POLICY "Dueño y arbitros borran eventos" ON public.match_events FOR DELETE
  USING (public.can_officiate_match(match_id));

-- ---------- Sanciones ------------------------------------------------------
CREATE POLICY "Dueño crea sanciones" ON public.team_sanctions FOR INSERT
  WITH CHECK (public.can_manage_league(league_id));
CREATE POLICY "Dueño edita sanciones" ON public.team_sanctions FOR UPDATE
  USING (public.can_manage_league(league_id))
  WITH CHECK (public.can_manage_league(league_id));
CREATE POLICY "Dueño borra sanciones" ON public.team_sanctions FOR DELETE
  USING (public.can_manage_league(league_id));

-- ---------- Perfiles: quién puede cambiar roles ---------------------------
-- Los admins (dueños de liga) necesitan poder marcar a un usuario como
-- capitán o árbitro (pantallas Crear equipo y Agregar árbitro). La política
-- deja entrar al UPDATE y el trigger de abajo limita QUÉ pueden cambiar.
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins asignan capitan o arbitro" ON public.profiles;
CREATE POLICY "Admins asignan capitan o arbitro" ON public.profiles FOR UPDATE
  USING (public.my_role() = 'admin');

CREATE OR REPLACE FUNCTION public.guard_profile_changes()
-- SECURITY INVOKER a propósito: current_user es el rol de quien llama.
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  my text := public.my_role();
BEGIN
  -- Triggers y funciones internas (handle_new_user, sync_captain_role) y el
  -- panel de Supabase no pasan por aquí.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF me IS NULL OR NEW.id <> me THEN
      RAISE EXCEPTION 'Solo puedes crear tu propio perfil';
    END IF;
    IF coalesce(NEW.role, 'user') NOT IN ('user', 'admin') THEN
      RAISE EXCEPTION 'Rol no permitido al registrarse';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF my = 'superadmin' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'No se puede cambiar el id del perfil';
  END IF;

  IF NEW.id = me THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'No puedes cambiar tu propio rol';
    END IF;
    RETURN NEW;
  END IF;

  -- Perfil de otra persona: solo un admin, solo el rol y solo
  -- user/player -> captain/referee.
  IF my = 'admin'
     AND (to_jsonb(NEW) - 'role' - 'updated_at') = (to_jsonb(OLD) - 'role' - 'updated_at')
     AND coalesce(OLD.role, 'user') IN ('user', 'player')
     AND NEW.role IN ('captain', 'referee') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'No autorizado para modificar este perfil';
END $$;

DROP TRIGGER IF EXISTS trg_guard_profile_changes ON public.profiles;
CREATE TRIGGER trg_guard_profile_changes
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_changes();

COMMIT;
