
-- Student status change log table
CREATE TABLE public.student_status_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason_category TEXT NOT NULL DEFAULT 'other',
  reason_detail TEXT,
  transfer_destination TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.student_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view status log" ON public.student_status_log
  FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can insert status log" ON public.student_status_log
  FOR INSERT TO authenticated
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

-- Add inactivation fields to students table
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS inactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS inactivation_date DATE,
  ADD COLUMN IF NOT EXISTS warning_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_destination TEXT;
