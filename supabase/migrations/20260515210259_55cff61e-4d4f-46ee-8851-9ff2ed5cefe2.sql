-- 1) Duration column on narration results
ALTER TABLE public.narration_results
  ADD COLUMN IF NOT EXISTS recitation_duration_seconds INTEGER;

-- 2) External reviewer tokens
CREATE TABLE IF NOT EXISTS public.narration_external_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.narration_sessions(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  created_by UUID REFERENCES auth.users(id),
  reviewer_name TEXT,
  reviewer_phone TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.narration_external_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read valid token" ON public.narration_external_tokens;
CREATE POLICY "Anyone can read valid token"
  ON public.narration_external_tokens
  FOR SELECT
  USING (expires_at > now());

DROP POLICY IF EXISTS "Anyone can mark token used" ON public.narration_external_tokens;
CREATE POLICY "Anyone can mark token used"
  ON public.narration_external_tokens
  FOR UPDATE
  USING (expires_at > now())
  WITH CHECK (expires_at > now());

DROP POLICY IF EXISTS "Staff can create tokens" ON public.narration_external_tokens;
CREATE POLICY "Staff can create tokens"
  ON public.narration_external_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Staff can manage tokens" ON public.narration_external_tokens;
CREATE POLICY "Staff can manage tokens"
  ON public.narration_external_tokens
  FOR DELETE
  TO authenticated
  USING (public.get_staff_role(auth.uid()) IS NOT NULL);
