
-- Attendance audit log for tracking historical edits
CREATE TABLE public.attendance_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id),
  attendance_date DATE NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES public.profiles(id),
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated staff can read audit log
CREATE POLICY "Staff can view attendance audit log"
  ON public.attendance_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));

-- Staff can insert audit entries
CREATE POLICY "Staff can insert attendance audit log"
  ON public.attendance_audit_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_attendance_audit_date ON public.attendance_audit_log(attendance_date);
CREATE INDEX idx_attendance_audit_student ON public.attendance_audit_log(student_id);
