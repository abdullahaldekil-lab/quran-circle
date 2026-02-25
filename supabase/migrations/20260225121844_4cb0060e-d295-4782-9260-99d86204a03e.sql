
-- 1) جلسات التميّز
CREATE TABLE public.excellence_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  halaqa_id UUID REFERENCES public.halaqat(id),
  created_by UUID,
  total_hizb_in_session NUMERIC DEFAULT 0,
  total_pages_displayed NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) تحضير نخبة الطلاب
CREATE TABLE public.excellence_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.excellence_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  is_present BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) أداء الطالب في الجلسة
CREATE TABLE public.excellence_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.excellence_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  pages_displayed NUMERIC DEFAULT 0,
  hizb_count NUMERIC DEFAULT 0,
  mistakes_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  lahon_count INTEGER DEFAULT 0,
  total_score NUMERIC DEFAULT 0,
  rank_in_group INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) التقرير الشهري
CREATE TABLE public.excellence_monthly_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  student_id UUID NOT NULL,
  halaqa_id UUID REFERENCES public.halaqat(id),
  total_attendance INTEGER DEFAULT 0,
  total_pages NUMERIC DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_hizb NUMERIC DEFAULT 0,
  average_score NUMERIC DEFAULT 0,
  final_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year, student_id)
);

-- Enable RLS on all tables
ALTER TABLE public.excellence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excellence_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excellence_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excellence_monthly_report ENABLE ROW LEVEL SECURITY;

-- RLS: excellence_sessions
CREATE POLICY "Staff can view excellence sessions" ON public.excellence_sessions
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage excellence sessions" ON public.excellence_sessions
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage excellence sessions" ON public.excellence_sessions
  FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']));

-- RLS: excellence_attendance
CREATE POLICY "Staff can view excellence attendance" ON public.excellence_attendance
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage excellence attendance" ON public.excellence_attendance
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage excellence attendance" ON public.excellence_attendance
  FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']));

-- RLS: excellence_performance
CREATE POLICY "Staff can view excellence performance" ON public.excellence_performance
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage excellence performance" ON public.excellence_performance
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage excellence performance" ON public.excellence_performance
  FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']));

-- RLS: excellence_monthly_report
CREATE POLICY "Staff can view excellence monthly report" ON public.excellence_monthly_report
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage excellence monthly report" ON public.excellence_monthly_report
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Enable realtime for sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.excellence_sessions;

-- Updated at triggers
CREATE TRIGGER update_excellence_sessions_updated_at
  BEFORE UPDATE ON public.excellence_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_excellence_performance_updated_at
  BEFORE UPDATE ON public.excellence_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_excellence_monthly_report_updated_at
  BEFORE UPDATE ON public.excellence_monthly_report
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
