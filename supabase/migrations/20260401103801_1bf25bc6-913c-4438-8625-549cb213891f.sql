
CREATE TABLE public.student_annual_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT '1446-1447',
  plan_type TEXT NOT NULL DEFAULT 'silver',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  total_target_pages INTEGER NOT NULL DEFAULT 0,
  daily_target_pages NUMERIC NOT NULL DEFAULT 0.5,
  working_days_per_week INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.student_annual_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view student annual plans"
  ON public.student_annual_plans FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can insert student annual plans"
  ON public.student_annual_plans FOR INSERT TO authenticated
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage student annual plans"
  ON public.student_annual_plans FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE TABLE public.student_plan_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.student_annual_plans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL DEFAULT 1,
  month_number INTEGER NOT NULL DEFAULT 1,
  target_pages INTEGER NOT NULL DEFAULT 0,
  actual_pages INTEGER NOT NULL DEFAULT 0,
  attendance_days INTEGER NOT NULL DEFAULT 0,
  commitment_percentage NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'on_track',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.student_plan_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view student plan progress"
  ON public.student_plan_progress FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can insert student plan progress"
  ON public.student_plan_progress FOR INSERT TO authenticated
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage student plan progress"
  ON public.student_plan_progress FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');
