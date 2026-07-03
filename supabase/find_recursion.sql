-- =====================================================
-- DIAGNÓSTICO PROFUNDO: Encontrar el ciclo real
-- =====================================================
-- Este script se ejecuta como ROL autenticado para
-- simular lo que pasa cuando la app hace SELECT
-- =====================================================

-- PASO 1: Ver policies actuales de TODAS las tablas relevantes
-- (con el USING completo para identificar la recursión)
SELECT
  tablename,
  policyname,
  cmd,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('leagues', 'tournaments', 'teams', 'matches', 'players', 'referees', 'match_events', 'league_followers', 'league_invitations', 'profiles')
ORDER BY tablename, cmd;

-- PASO 2: Ver si hay VIEWS que hagan JOIN entre tablas
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND (
    definition ILIKE '%leagues%'
    OR definition ILIKE '%tournaments%'
  )
ORDER BY viewname;

-- PASO 3: Ver TRIGGERS que puedan estar causando SELECTs recursivos
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- PASO 4: Ver las policies de tournaments con el texto completo
-- (porque pueden tener un OR EXISTS que referencia leagues)
SELECT
  policyname,
  pg_get_expr(qual, 'public.tournaments'::regclass) as full_using
FROM pg_policy
WHERE polrelid = 'public.tournaments'::regclass;

-- PASO 5: Ver policies de leagues con texto completo
SELECT
  policyname,
  pg_get_expr(qual, 'public.leagues'::regclass) as full_using
FROM pg_policy
WHERE polrelid = 'public.leagues'::regclass;

-- PASO 6: Detectar dependencias circulares entre policies
WITH RECURSIVE policy_deps AS (
  -- Policies que consultan otras tablas via subqueries
  SELECT
    p.tablename as source_table,
    p.policyname as source_policy,
    -- Extraer nombres de tablas referenciadas en el USING
    (SELECT string_agg(DISTINCT ref, ', ')
     FROM unnest(
       regexp_matches(
         replace(replace(p.qual, E'\n', ' '), ' ', ''),
         'public\.(\w+)',
         'g'
       )
     ) as ref
    ) as referenced_tables
  FROM pg_policies p
  WHERE p.schemaname = 'public'
)
SELECT *
FROM policy_deps
WHERE referenced_tables IS NOT NULL
  AND referenced_tables != ''
ORDER BY source_table, source_policy;
