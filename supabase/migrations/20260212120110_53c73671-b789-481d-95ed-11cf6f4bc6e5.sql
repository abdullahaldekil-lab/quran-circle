
-- 1) جدول مسارات الحفظ (المستويات الخمسة)
CREATE TABLE public.level_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level_number INTEGER NOT NULL,
  description TEXT,
  branches_count INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.level_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view level_tracks" ON public.level_tracks FOR SELECT USING (true);
CREATE POLICY "Managers can manage level_tracks" ON public.level_tracks FOR ALL USING (true) WITH CHECK (true);

-- 2) جدول فروع المستوى
CREATE TABLE public.level_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_track_id UUID NOT NULL REFERENCES public.level_tracks(id) ON DELETE CASCADE,
  branch_number INTEGER NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.level_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view level_branches" ON public.level_branches FOR SELECT USING (true);
CREATE POLICY "Managers can manage level_branches" ON public.level_branches FOR ALL USING (true) WITH CHECK (true);

-- 3) جدول أجزاء الحفظ لكل فرع
CREATE TABLE public.level_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_track_id UUID NOT NULL REFERENCES public.level_tracks(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.level_branches(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.level_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view level_parts" ON public.level_parts FOR SELECT USING (true);
CREATE POLICY "Managers can manage level_parts" ON public.level_parts FOR ALL USING (true) WITH CHECK (true);

-- 4) جدول مستوى الطالب (تقدمه الحالي)
CREATE TABLE public.student_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  level_track_id UUID NOT NULL REFERENCES public.level_tracks(id),
  branch_id UUID REFERENCES public.level_branches(id),
  part_number INTEGER NOT NULL DEFAULT 1,
  progress_percentage NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completion_date DATE,
  updated_by_manager BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id)
);

ALTER TABLE public.student_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view student_levels" ON public.student_levels FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage student_levels" ON public.student_levels FOR ALL USING (true) WITH CHECK (true);

-- 5) إضافة حقل المسار إلى الحلقات
ALTER TABLE public.halaqat ADD COLUMN level_track_id UUID REFERENCES public.level_tracks(id);

-- 6) تحديث updated_at تلقائياً
CREATE TRIGGER update_student_levels_updated_at
  BEFORE UPDATE ON public.student_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7) إدخال البيانات الأساسية للمستويات الخمسة
INSERT INTO public.level_tracks (name, level_number, description, branches_count, sort_order) VALUES
  ('التأهيل', 1, 'مستوى التأهيل الأساسي للطلاب الجدد', 3, 1),
  ('النجباء', 2, 'مستوى النجباء للطلاب المتميزين', 4, 2),
  ('الفرسان', 3, 'مستوى الفرسان للطلاب المتقدمين', 5, 3),
  ('الحفاظ', 4, 'مستوى الحفاظ لمن أتم حفظ أجزاء كبيرة', 6, 4),
  ('الخريجين', 5, 'مستوى الخريجين لمن أتم حفظ القرآن كاملاً', 1, 5);

-- 8) إدخال الفروع لكل مستوى
DO $$
DECLARE
  track RECORD;
  i INTEGER;
BEGIN
  FOR track IN SELECT id, branches_count, level_number FROM public.level_tracks ORDER BY level_number LOOP
    FOR i IN 1..track.branches_count LOOP
      INSERT INTO public.level_branches (level_track_id, branch_number, description, sort_order)
      VALUES (track.id, i, 'الفرع ' || i || ' من المستوى ' || track.level_number, i);
    END LOOP;
  END LOOP;
END $$;

-- 9) إدخال الأجزاء لكل فرع (كل فرع يحتوي على أجزاء من القرآن)
DO $$
DECLARE
  branch RECORD;
  track RECORD;
  parts_per_branch INTEGER;
  j INTEGER;
BEGIN
  FOR track IN SELECT id, level_number, branches_count FROM public.level_tracks ORDER BY level_number LOOP
    -- توزيع 30 جزء على المستويات
    CASE track.level_number
      WHEN 1 THEN parts_per_branch := 2;  -- التأهيل: 2 أجزاء لكل فرع
      WHEN 2 THEN parts_per_branch := 2;  -- النجباء: 2 أجزاء لكل فرع
      WHEN 3 THEN parts_per_branch := 2;  -- الفرسان: 2 أجزاء لكل فرع
      WHEN 4 THEN parts_per_branch := 2;  -- الحفاظ: 2 أجزاء لكل فرع
      WHEN 5 THEN parts_per_branch := 30; -- الخريجين: مراجعة كامل القرآن
    END CASE;

    FOR branch IN SELECT id FROM public.level_branches WHERE level_track_id = track.id ORDER BY branch_number LOOP
      FOR j IN 1..parts_per_branch LOOP
        INSERT INTO public.level_parts (level_track_id, branch_id, part_number, sort_order)
        VALUES (track.id, branch.id, j, j);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
