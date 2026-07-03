-- =====================================================
-- FIX: Slugs únicos y no-collision
-- =====================================================
-- Problema: dos ligas con el mismo nombre generan
--   slugs "liga-mx" y "liga-mx-1234" que pueden confundir
--
-- Solución: agregar el id corto de la liga al slug
--   "Liga MX" → "liga-mx-a7b3c2"
-- =====================================================

-- =====================================================
-- PASO 1: Función mejorada que incluye un identificador
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_league_slug(_name TEXT, _id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  suffix TEXT;
BEGIN
  -- Convertir a minúsculas, quitar acentos
  base_slug := lower(COALESCE(_name, 'liga'));
  base_slug := translate(base_slug,
    'áàäâãåéèëêíìïîóòöôõúùüûñç',
    'aaaaaaeeeeiiiioooooouuuunc'
  );
  -- Reemplazar todo lo que no sea alfanumérico por guiones
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  -- Quitar guiones al inicio/fin
  base_slug := trim(both '-' from base_slug);
  -- Limitar a 50 caracteres (deja espacio para el sufijo)
  base_slug := substring(base_slug from 1 for 50);
  -- Quitar guion final si quedó
  base_slug := trim(both '-' from base_slug);

  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'liga';
  END IF;

  -- Si se pasó un id, agregar sufijo derivado del id
  IF _id IS NOT NULL THEN
    -- Usar los primeros 6 chars del id (sin guiones) como sufijo
    suffix := replace(_id::text, '-', '');
    suffix := substring(suffix from 1 for 6);
    final_slug := base_slug || '-' || suffix;
  ELSE
    -- Fallback: usar random si no hay id
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.leagues WHERE slug = final_slug) LOOP
      final_slug := base_slug || '-' || floor(random() * 100000)::text;
    END LOOP;
  END IF;

  RETURN final_slug;
END;
$$;

-- =====================================================
-- PASO 2: Trigger actualizado - genera slug CON el id
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_league_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Si no hay slug, generar uno basado en el id
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_league_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger (BEFORE INSERT OR UPDATE OF name)
DROP TRIGGER IF EXISTS trg_set_league_slug ON public.leagues;
CREATE TRIGGER trg_set_league_slug
  BEFORE INSERT OR UPDATE OF name ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_slug();

-- =====================================================
-- PASO 3: Backfill slugs existentes con el formato nuevo
-- (agrega el sufijo del id a los slugs actuales)
-- =====================================================
DO $$
DECLARE
  league_record RECORD;
  new_slug TEXT;
  has_collision BOOLEAN;
BEGIN
  FOR league_record IN SELECT id, name, slug FROM public.leagues LOOP
    -- Solo actualizar si el slug NO tiene el formato con sufijo del id
    -- El formato esperado es: nombre-XXXXXX donde XXXXXX son 6 chars hex
    -- Si el slug actual tiene otro formato (como "liga-mx" o "liga-mx-1234"),
    -- regenerarlo con el id

    -- Generar el slug ideal con id
    new_slug := public.generate_league_slug(league_record.name, league_record.id);

    -- Si el slug actual es diferente al ideal, actualizarlo
    IF league_record.slug != new_slug THEN
      -- Verificar que el nuevo slug no esté en uso por OTRA liga
      SELECT EXISTS (
        SELECT 1 FROM public.leagues
        WHERE slug = new_slug AND id != league_record.id
      ) INTO has_collision;

      IF NOT has_collision THEN
        UPDATE public.leagues
        SET slug = new_slug
        WHERE id = league_record.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- PASO 4: Verificación - ver los slugs actualizados
-- =====================================================
SELECT id, name, slug
FROM public.leagues
ORDER BY created_at DESC
LIMIT 10;

-- Recargar schema cache
NOTIFY pgrst, 'reload config';
