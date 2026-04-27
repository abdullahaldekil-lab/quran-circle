ALTER TABLE public.talqeen_student_tests
  ADD COLUMN IF NOT EXISTS certificate_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS certificate_issued_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_talqeen_tests_cert_number
  ON public.talqeen_student_tests(certificate_number)
  WHERE certificate_number IS NOT NULL;