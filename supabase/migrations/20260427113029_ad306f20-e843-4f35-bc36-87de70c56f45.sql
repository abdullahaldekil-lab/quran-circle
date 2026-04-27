ALTER TABLE public.talqeen_student_tests
  ADD COLUMN IF NOT EXISTS attendance_score numeric,
  ADD COLUMN IF NOT EXISTS attendance_max numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS homework_score numeric,
  ADD COLUMN IF NOT EXISTS homework_max numeric DEFAULT 100;