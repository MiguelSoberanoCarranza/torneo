-- =====================================================
-- DIAGNÓSTICO: Verificar el estado de invite_codes
-- =====================================================
-- Ejecuta este script SOLO (sin las migraciones) en el SQL Editor
-- de Supabase y copiá los resultados para entender qué pasa.

-- 1. ¿Cuántas ligas hay en total?
SELECT COUNT(*) AS total_leagues FROM public.leagues;

-- 2. ¿Cuántas tienen invite_code NULL vs no NULL?
SELECT
  COUNT(*) FILTER (WHERE invite_code IS NULL) AS sin_codigo,
  COUNT(*) FILTER (WHERE invite_code IS NOT NULL) AS con_codigo
FROM public.leagues;

-- 3. Listar TODAS las ligas con su invite_code
SELECT id, name, owner_id, tournament_id, invite_code
FROM public.leagues
ORDER BY created_at DESC
LIMIT 50;

-- 4. Ver las policies actuales de la tabla leagues
SELECT schemaname, tablename, policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename = 'leagues'
ORDER BY cmd, policyname;
