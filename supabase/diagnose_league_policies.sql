-- =====================================================
-- DIAGNÓSTICO: Ver todas las policies activas en leagues
-- =====================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'leagues'
ORDER BY cmd, policyname;

-- =====================================================
-- TEST: Como usuario anónimo, intentar leer por invite_code
-- =====================================================

-- 1. Verifica que la liga LIGA MX existe
SELECT id, name, invite_code, owner_id, tournament_id
FROM public.leagues
WHERE invite_code IS NOT NULL
LIMIT 5;

-- 2. Como anon, leer (esto simula la query del cliente sin login)
SET ROLE anon;
SELECT id, name, invite_code
FROM public.leagues
WHERE invite_code = 'tfyqei9z';
RESET ROLE;
