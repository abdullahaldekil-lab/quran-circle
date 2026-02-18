
-- ==========================================
-- نظام يوم السرد القرآني
-- ==========================================

-- 1. جدول إعدادات السرد (صف واحد)
CREATE TABLE public.narration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_grade integer NOT NULL DEFAULT 70,
  max_grade integer NOT NULL DEFAULT 100,
  deduction_per_mistake numeric NOT NULL DEFAULT 2,
  deduction_per_lahn numeric NOT NULL DEFAULT 1,
  deduction_per_warning numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. جدول جلسات السرد
CREATE TABLE public.narration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  halaqa_id uuid REFERENCES public.halaqat(id) ON DELETE SET NULL,
  title text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. جدول نتائج الطلاب في السرد
CREATE TABLE public.narration_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.narration_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  hizb_from integer NOT NULL DEFAULT 1,
  hizb_to integer NOT NULL DEFAULT 1,
  mistakes_count integer NOT NULL DEFAULT 0,
  lahn_count integer NOT NULL DEFAULT 0,
  warnings_count integer NOT NULL DEFAULT 0,
  grade numeric NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  manual_entry boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- ==========================================
-- Triggers للـ updated_at
-- ==========================================

CREATE TRIGGER update_narration_settings_updated_at
  BEFORE UPDATE ON public.narration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_narration_sessions_updated_at
  BEFORE UPDATE ON public.narration_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_narration_results_updated_at
  BEFORE UPDATE ON public.narration_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- تفعيل RLS
-- ==========================================

ALTER TABLE public.narration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narration_results ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- سياسات narration_settings
-- ==========================================

CREATE POLICY "Staff can view narration settings"
  ON public.narration_settings FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage narration settings"
  ON public.narration_settings FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- ==========================================
-- سياسات narration_sessions
-- ==========================================

CREATE POLICY "Staff can view narration sessions"
  ON public.narration_sessions FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage narration sessions"
  ON public.narration_sessions FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage own narration sessions"
  ON public.narration_sessions FOR ALL
  USING (get_staff_role(auth.uid()) = ANY(ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY(ARRAY['teacher', 'assistant_teacher']));

-- ==========================================
-- سياسات narration_results
-- ==========================================

CREATE POLICY "Staff can view narration results"
  ON public.narration_results FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage narration results"
  ON public.narration_results FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage narration results"
  ON public.narration_results FOR ALL
  USING (get_staff_role(auth.uid()) = ANY(ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY(ARRAY['teacher', 'assistant_teacher']));

-- ==========================================
-- إدراج إعدادات افتراضية
-- ==========================================

INSERT INTO public.narration_settings (min_grade, max_grade, deduction_per_mistake, deduction_per_lahn, deduction_per_warning)
VALUES (70, 100, 2, 1, 0.5);
