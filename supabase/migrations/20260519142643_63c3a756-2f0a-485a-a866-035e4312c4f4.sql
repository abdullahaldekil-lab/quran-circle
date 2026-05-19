
-- Add lahn column to narration test results
ALTER TABLE public.narration_test_results
  ADD COLUMN IF NOT EXISTS lahn INTEGER NOT NULL DEFAULT 0;

-- Narration test settings (singleton-ish: one active row)
CREATE TABLE IF NOT EXISTS public.narration_test_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_deduction NUMERIC NOT NULL DEFAULT 5,
  lahn_deduction NUMERIC NOT NULL DEFAULT 2,
  warning_deduction NUMERIC NOT NULL DEFAULT 1,
  pass_threshold NUMERIC NOT NULL DEFAULT 60,
  attendance_score NUMERIC NOT NULL DEFAULT 50,
  narration_max NUMERIC NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.narration_test_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read narration settings"
  ON public.narration_test_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Manager/supervisor can insert narration settings"
  ON public.narration_test_settings FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid())
    IN ('manager','supervisor')
  );

CREATE POLICY "Manager/supervisor can update narration settings"
  ON public.narration_test_settings FOR UPDATE
  TO authenticated USING (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid())
    IN ('manager','supervisor')
  );

-- Seed default row if none exists
INSERT INTO public.narration_test_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.narration_test_settings);
