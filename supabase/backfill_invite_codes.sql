-- =====================================================
-- BACKFILL: Generar invite_code para ligas existentes
-- que aún no tengan uno
-- =====================================================

-- 1. Generar códigos para ligas SIN invite_code
UPDATE public.leagues
SET invite_code = lower(substring(md5(random()::text) from 1 for 8))
WHERE invite_code IS NULL;

-- 2. Trigger: garantizar que cualquier liga nueva tenga
--    invite_code automáticamente al insertarse
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

-- 3. Por si la columna es nullable, asegurar que no quede vacía
--    (esto previene errores en lecturas futuras)
ALTER TABLE public.leagues
ALTER COLUMN invite_code SET NOT NULL;
