
-- =============================================
-- برنامج مدارج - جداول قاعدة البيانات
-- =============================================

-- 1. جدول المسارات
CREATE TABLE public.madarij_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  days_required integer NOT NULL DEFAULT 20,
  repetition_rules jsonb DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.madarij_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view madarij_tracks"
  ON public.madarij_tracks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage madarij_tracks"
  ON public.madarij_tracks FOR ALL
  USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

-- 2. جدول تسجيل الطالب في مدارج
CREATE TABLE public.madarij_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.madarij_tracks(id) ON DELETE CASCADE,
  level_track_id uuid REFERENCES public.level_tracks(id),
  branch_id uuid REFERENCES public.level_branches(id),
  part_number integer NOT NULL DEFAULT 1,
  hizb_number integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.madarij_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view madarij_enrollments"
  ON public.madarij_enrollments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage madarij_enrollments"
  ON public.madarij_enrollments FOR ALL
  USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE TRIGGER update_madarij_enrollments_updated_at
  BEFORE UPDATE ON public.madarij_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. جدول المتابعة اليومية
CREATE TABLE public.madarij_daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.madarij_enrollments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  progress_date date NOT NULL DEFAULT CURRENT_DATE,
  memorization text,
  listening integer DEFAULT 0,
  repetition_before integer DEFAULT 0,
  repetition_after integer DEFAULT 0,
  grade integer DEFAULT 0,
  linking text,
  mistakes_count integer DEFAULT 0,
  review text,
  execution text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.madarij_daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view madarij_daily_progress"
  ON public.madarij_daily_progress FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage madarij_daily_progress"
  ON public.madarij_daily_progress FOR ALL
  USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

-- 4. جدول تدوين الأخطاء
CREATE TABLE public.madarij_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.madarij_enrollments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mistake_text text NOT NULL,
  surah text,
  ayah text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.madarij_mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view madarij_mistakes"
  ON public.madarij_mistakes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage madarij_mistakes"
  ON public.madarij_mistakes FOR ALL
  USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

-- 5. جدول اختبار نهاية الحزب
CREATE TABLE public.madarij_hizb_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.madarij_enrollments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  segment1_errors integer DEFAULT 0,
  segment1_warnings integer DEFAULT 0,
  segment1_grade integer DEFAULT 0,
  segment2_errors integer DEFAULT 0,
  segment2_warnings integer DEFAULT 0,
  segment2_grade integer DEFAULT 0,
  segment3_errors integer DEFAULT 0,
  segment3_warnings integer DEFAULT 0,
  segment3_grade integer DEFAULT 0,
  segment4_errors integer DEFAULT 0,
  segment4_warnings integer DEFAULT 0,
  segment4_grade integer DEFAULT 0,
  segment5_errors integer DEFAULT 0,
  segment5_warnings integer DEFAULT 0,
  segment5_grade integer DEFAULT 0,
  review_total numeric DEFAULT 0,
  memorization_grade numeric DEFAULT 0,
  extra_points numeric DEFAULT 0,
  final_grade numeric DEFAULT 0,
  examiner_name text,
  supervisor_approval text,
  pass_date date,
  passed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.madarij_hizb_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view madarij_hizb_exams"
  ON public.madarij_hizb_exams FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage madarij_hizb_exams"
  ON public.madarij_hizb_exams FOR ALL
  USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE TRIGGER update_madarij_hizb_exams_updated_at
  BEFORE UPDATE ON public.madarij_hizb_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- بذر بيانات المسارات الأربعة
-- =============================================
INSERT INTO public.madarij_tracks (name, description, days_required, repetition_rules) VALUES
  ('الفضي', 'مسار الفضي - 20 يوم', 20, '{"repetition": 20}'),
  ('الذهبي', 'مسار الذهبي - 10 أيام', 10, '{"repetition": 20}'),
  ('الفضي إتقان', 'مسار الفضي إتقان - 20 يوم', 20, '{"two_pages": 15, "three_pages": 10}'),
  ('الذهبي إتقان', 'مسار الذهبي إتقان - 10 أيام', 10, '{"two_pages": 15, "three_pages": 10}');
