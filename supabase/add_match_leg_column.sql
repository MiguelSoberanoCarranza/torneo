-- =====================================================
-- AGREGAR COLUMNA 'leg' A LA TABLA matches
-- Sirve para distinguir partidos de ida (1) y vuelta (2)
-- en la liguilla cuando la liga se configura como ida y vuelta
-- =====================================================

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS leg INTEGER DEFAULT 1;

-- Índice para mejorar el rendimiento al filtrar por ronda y pierna
CREATE INDEX IF NOT EXISTS idx_matches_round_leg ON public.matches(league_id, round_number, leg);
