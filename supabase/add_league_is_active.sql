-- Permite desactivar ligas para ocultarlas del sistema público

ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_leagues_is_active ON public.leagues(is_active);

NOTIFY pgrst, 'reload config';
