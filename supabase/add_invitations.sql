-- =====================================================
-- SISTEMA DE INVITACIONES POR CÓDIGO
-- =====================================================

-- Agregar invite_code a leagues
ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- ========================================================================
-- OPCIONAL: Generar códigos para ligas existentes (descomenta si lo necesitas)
-- Esto solo afecta ligas SIN código. No borra ni modifica datos existentes.
-- ========================================================================
-- UPDATE public.leagues 
-- SET invite_code = lower(substring(md5(random()::text) from 1 for 8))
-- WHERE invite_code IS NULL;

-- ========================================================================
-- league_invitations: permite invitaciones por email
-- ========================================================================
-- Esta tabla permite invitaciones explícitas
CREATE TABLE IF NOT EXISTS public.league_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(league_id, email)
);

-- =====================================================
-- POLICIES RLS
-- =====================================================

-- League_invitations policies
CREATE POLICY "Users can view invitations for their email"
  ON public.league_invitations FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      email IN (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
      invited_by = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    )
  );

CREATE POLICY "League owners can create invitations"
  ON public.league_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues 
      WHERE leagues.id = league_invitations.league_id 
      AND leagues.owner_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Users can update their own invitations"
  ON public.league_invitations FOR UPDATE
  USING (
    email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_league_invitations_league ON public.league_invitations(league_id);
CREATE INDEX IF NOT EXISTS idx_league_invitations_email ON public.league_invitations(email);
