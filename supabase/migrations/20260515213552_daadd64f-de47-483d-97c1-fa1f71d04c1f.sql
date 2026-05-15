CREATE TABLE IF NOT EXISTS public.program_quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.talqeen_lessons(id),
  curriculum_id UUID REFERENCES public.talqeen_curricula(id),
  generated_by UUID,
  quiz_type TEXT DEFAULT 'multiple_choice',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  week_number INTEGER,
  status TEXT DEFAULT 'draft',
  scores_separate BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.program_quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES public.program_quizzes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id),
  answers JSONB DEFAULT '[]'::jsonb,
  program_score NUMERIC,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.program_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage program quizzes" ON public.program_quizzes
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff manage program quiz results" ON public.program_quiz_results
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_program_quizzes_halaqa ON public.program_quizzes(halaqa_id);
CREATE INDEX IF NOT EXISTS idx_program_quiz_results_quiz ON public.program_quiz_results(quiz_id);