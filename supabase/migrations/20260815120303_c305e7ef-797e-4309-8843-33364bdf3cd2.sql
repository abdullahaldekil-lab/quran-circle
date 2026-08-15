ALTER TABLE public.student_annual_plans
  ADD COLUMN IF NOT EXISTS term TEXT NOT NULL DEFAULT 'annual';

UPDATE public.student_annual_plans SET term = 'annual' WHERE term IS NULL OR term = '';

ALTER TABLE public.student_annual_plans
  DROP CONSTRAINT IF EXISTS student_annual_plans_term_check;

ALTER TABLE public.student_annual_plans
  ADD CONSTRAINT student_annual_plans_term_check
  CHECK (term IN ('annual','first','second','summer'));

CREATE INDEX IF NOT EXISTS idx_student_annual_plans_term
  ON public.student_annual_plans (student_id, term, status);