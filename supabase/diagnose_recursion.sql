-- =====================================================
-- DIAGNÓSTICO: Ver todas las policies RLS activas
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase para entender
-- por qué hay recursión infinita
-- =====================================================

-- Ver todas las policies por tabla
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE
    WHEN length(qual) > 200 THEN substring(qual from 1 for 200) || '...'
    ELSE qual
  END as using_expression,
  CASE
    WHEN length(with_check) > 200 THEN substring(with_check from 1 for 200) || '...'
    ELSE with_check
  END as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('leagues', 'teams', 'matches', 'players', 'referees', 'match_events', 'tournaments', 'league_followers', 'league_invitations', 'profiles')
ORDER BY tablename, policyname;

-- Ver las funciones SECURITY DEFINER creadas
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'is_tournament_owner', 'generate_league_slug', 'set_league_slug')
ORDER BY p.proname;

-- Ver el grant de las tablas
SELECT
  grantee,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('leagues', 'teams', 'matches', 'players', 'referees', 'match_events', 'tournaments', 'league_followers', 'league_invitations')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- Probar las funciones helper como anon
SELECT public.is_admin() as is_admin_result, public.is_tournament_owner(NULL) as is_tournament_owner_result;

-- Probar consulta directa (simula lo que hace LeagueSelectorScreen)
SELECT id, name, slug, is_public, owner_id
FROM public.leagues
ORDER BY created_at DESC
LIMIT 5;
