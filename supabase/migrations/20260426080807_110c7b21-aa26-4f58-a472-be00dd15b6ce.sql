-- 1) إضافة حقول جديدة لجدول talqeen_sessions
ALTER TABLE public.talqeen_sessions
  ADD COLUMN IF NOT EXISTS executed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_notes TEXT,
  ADD COLUMN IF NOT EXISTS homework TEXT,
  ADD COLUMN IF NOT EXISTS homework_due_date DATE,
  ADD COLUMN IF NOT EXISTS educational_program_title TEXT,
  ADD COLUMN IF NOT EXISTS educational_program_details TEXT;

-- 2) جدول حضور جلسات التلقين
CREATE TABLE IF NOT EXISTS public.talqeen_session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.talqeen_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present', -- present | absent | late | excused
  homework_status TEXT NOT NULL DEFAULT 'not_submitted', -- not_submitted | submitted | late
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_talqeen_attendance_session ON public.talqeen_session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_talqeen_attendance_student ON public.talqeen_session_attendance(student_id);

ALTER TABLE public.talqeen_session_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage talqeen attendance" ON public.talqeen_session_attendance;
CREATE POLICY "Staff can manage talqeen attendance"
  ON public.talqeen_session_attendance
  FOR ALL
  TO authenticated
  USING (public.get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL);

-- trigger لتحديث updated_at
DROP TRIGGER IF EXISTS trg_talqeen_attendance_updated ON public.talqeen_session_attendance;
CREATE TRIGGER trg_talqeen_attendance_updated
  BEFORE UPDATE ON public.talqeen_session_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();