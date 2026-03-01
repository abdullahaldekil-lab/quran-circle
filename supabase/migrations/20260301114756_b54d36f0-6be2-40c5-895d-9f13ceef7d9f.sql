ALTER TABLE public.narration_sessions
  ADD COLUMN IF NOT EXISTS external_teacher_name TEXT,
  ADD COLUMN IF NOT EXISTS external_teacher_phone TEXT,
  ADD COLUMN IF NOT EXISTS hizb_from INTEGER,
  ADD COLUMN IF NOT EXISTS hizb_to INTEGER;