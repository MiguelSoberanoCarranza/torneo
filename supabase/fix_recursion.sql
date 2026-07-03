-- =====================================================
-- CORRECCIÓN: Recursión infinita entre tournaments y leagues
-- =====================================================
-- Problema:
--   tournaments_select_policy referencia leagues
--   leagues_select_policy usa is_tournament_owner() que referencia tournaments
--   → RECURSIÓN INFINITA
--
-- Solución:
--   1. Simplificar tournaments_select_policy para NO consultar leagues
--   2. Verificar que is_tournament_owner() usa SECURITY DEFINER
-- =====================================================

-- ============ TOURNAMENTS ============
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournaments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tournaments', pol.policyname);
  END LOOP;
END $$;

-- SELECT: solo el owner del torneo y los admins
-- NO consulta leagues para evitar recursión
CREATE POLICY "tournaments_select_policy"
  ON public.tournaments FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- INSERT
CREATE POLICY "tournaments_insert_policy"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- UPDATE
CREATE POLICY "tournaments_update_policy"
  ON public.tournaments FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- DELETE
CREATE POLICY "tournaments_delete_policy"
  ON public.tournaments FOR DELETE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- PASO 2: Asegurar que is_tournament_owner usa SECURITY DEFINER
-- =====================================================
-- Si la función no existe o no tiene SECURITY DEFINER, recrearla
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

-- Verificar que is_admin también lo tiene
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

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tournament_owner(UUID) TO anon, authenticated;

-- =====================================================
-- PASO 3: Test rápido
-- =====================================================
-- Esto debería devolver rows si la recursión está resuelta
SELECT id, name, slug, is_public
FROM public.leagues
ORDER BY created_at DESC
LIMIT 5;

-- Recargar schema cache
NOTIFY pgrst, 'reload config';
