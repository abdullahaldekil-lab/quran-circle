
-- Talqeen Curricula module
CREATE TABLE IF NOT EXISTS public.talqeen_curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  total_weeks INTEGER NOT NULL DEFAULT 10,
  year_hijri TEXT DEFAULT '1447',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talqeen_curriculum_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID NOT NULL REFERENCES public.talqeen_curricula(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  title TEXT,
  lesson_topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(curriculum_id, week_number)
);

CREATE TABLE IF NOT EXISTS public.talqeen_curriculum_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.talqeen_curriculum_weeks(id) ON DELETE CASCADE,
  day_name TEXT NOT NULL, -- السبت, الأحد, ...
  day_order INTEGER NOT NULL,
  lesson TEXT,
  quran_homework TEXT,
  written_homework TEXT,
  educational TEXT,
  reading_in_class TEXT,
  reading_at_home TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curr_weeks_cid ON public.talqeen_curriculum_weeks(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_curr_days_wid ON public.talqeen_curriculum_days(week_id);

-- Link halaqa to curriculum
ALTER TABLE public.halaqat ADD COLUMN IF NOT EXISTS talqeen_curriculum_id UUID REFERENCES public.talqeen_curricula(id) ON DELETE SET NULL;

-- Link individual students to curriculum (per halaqa enrollment)
CREATE TABLE IF NOT EXISTS public.talqeen_student_curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  curriculum_id UUID NOT NULL REFERENCES public.talqeen_curricula(id) ON DELETE CASCADE,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE SET NULL,
  start_date DATE DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, curriculum_id)
);

ALTER TABLE public.talqeen_curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talqeen_curriculum_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talqeen_curriculum_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talqeen_student_curricula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view talqeen curricula" ON public.talqeen_curricula FOR SELECT TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Staff can manage talqeen curricula" ON public.talqeen_curricula FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL) WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can view curriculum weeks" ON public.talqeen_curriculum_weeks FOR SELECT TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Staff can manage curriculum weeks" ON public.talqeen_curriculum_weeks FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL) WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can view curriculum days" ON public.talqeen_curriculum_days FOR SELECT TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Staff can manage curriculum days" ON public.talqeen_curriculum_days FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL) WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can view student curricula" ON public.talqeen_student_curricula FOR SELECT TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Staff can manage student curricula" ON public.talqeen_student_curricula FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL) WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE TRIGGER trg_talqeen_curricula_updated BEFORE UPDATE ON public.talqeen_curricula FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_talqeen_curr_weeks_updated BEFORE UPDATE ON public.talqeen_curriculum_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_talqeen_student_curr_updated BEFORE UPDATE ON public.talqeen_student_curricula FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
