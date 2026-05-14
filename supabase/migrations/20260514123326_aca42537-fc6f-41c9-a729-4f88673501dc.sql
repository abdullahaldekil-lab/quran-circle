CREATE TABLE IF NOT EXISTS public.talqeen_chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  curriculum_id UUID REFERENCES public.talqeen_curricula(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  grade_group TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talqeen_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID REFERENCES public.talqeen_chapters(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  lesson_type TEXT DEFAULT 'manual',
  pdf_url TEXT,
  audio_url TEXT,
  video_url TEXT,
  pdf_storage_path TEXT,
  estimated_duration_minutes INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talqeen_program_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  curriculum_id UUID REFERENCES public.talqeen_curricula(id) ON DELETE CASCADE,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  start_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  UNIQUE(curriculum_id, halaqa_id)
);

CREATE TABLE IF NOT EXISTS public.talqeen_program_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.talqeen_program_assignments(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.talqeen_lessons(id),
  halaqa_id UUID REFERENCES public.halaqat(id),
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  teacher_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.talqeen_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talqeen_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talqeen_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talqeen_program_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view talqeen chapters" ON public.talqeen_chapters FOR SELECT TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Supervisor manage chapters" ON public.talqeen_chapters FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IN ('manager','supervisor','assistant_supervisor'));
CREATE POLICY "Staff view lessons" ON public.talqeen_lessons FOR SELECT TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Supervisor manage lessons" ON public.talqeen_lessons FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IN ('manager','supervisor','assistant_supervisor'));
CREATE POLICY "Supervisor manage assignments" ON public.talqeen_program_assignments FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IN ('manager','supervisor','assistant_supervisor'));
CREATE POLICY "Staff view assignments" ON public.talqeen_program_assignments FOR SELECT TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Staff manage progress" ON public.talqeen_program_progress FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL);