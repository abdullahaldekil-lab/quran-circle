
-- Add new columns to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT true;

-- Create staff_attendance_shifts table
CREATE TABLE public.staff_attendance_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_in_minutes integer NOT NULL DEFAULT 10,
  grace_out_minutes integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create staff_attendance table
CREATE TABLE public.staff_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  status text NOT NULL DEFAULT 'absent',
  shift_id uuid REFERENCES public.staff_attendance_shifts(id),
  late_minutes integer NOT NULL DEFAULT 0,
  early_leave_minutes integer NOT NULL DEFAULT 0,
  total_work_minutes integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(staff_id, attendance_date)
);

-- Enable RLS
ALTER TABLE public.staff_attendance_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- RLS for staff_attendance_shifts
CREATE POLICY "Manager can manage shifts"
  ON public.staff_attendance_shifts FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view shifts"
  ON public.staff_attendance_shifts FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- RLS for staff_attendance
CREATE POLICY "Manager full access staff attendance"
  ON public.staff_attendance FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Admin staff can manage staff attendance"
  ON public.staff_attendance FOR ALL
  USING (get_staff_role(auth.uid()) = ANY(ARRAY['supervisor', 'assistant_supervisor', 'secretary', 'admin_staff']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY(ARRAY['supervisor', 'assistant_supervisor', 'secretary', 'admin_staff']));

CREATE POLICY "Staff can view own attendance"
  ON public.staff_attendance FOR SELECT
  USING (staff_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_staff_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
