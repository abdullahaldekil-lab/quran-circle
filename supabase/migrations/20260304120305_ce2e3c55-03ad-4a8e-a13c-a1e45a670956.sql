
-- جدول اختبارات الطلاب
CREATE TABLE public.student_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  halaqa_id UUID REFERENCES public.halaqat(id),
  teacher_id UUID REFERENCES public.profiles(id),
  quiz_date DATE NOT NULL DEFAULT CURRENT_DATE,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  total_questions INTEGER NOT NULL DEFAULT 5,
  correct_answers INTEGER DEFAULT 0,
  score NUMERIC DEFAULT 0,
  grade_label TEXT,
  memorized_content TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول أسئلة الاختبار
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.student_quizzes(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  expected_answer TEXT,
  student_answer TEXT,
  is_correct BOOLEAN,
  teacher_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.student_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- سياسات student_quizzes
CREATE POLICY "Staff can view quizzes" ON public.student_quizzes
  FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can manage quizzes" ON public.student_quizzes
  FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Guardians can view student quizzes" ON public.student_quizzes
  FOR SELECT TO authenticated
  USING (student_id IN (
    SELECT gs.student_id FROM public.guardian_students gs WHERE gs.guardian_id = auth.uid()
  ));

-- سياسات quiz_questions
CREATE POLICY "Staff can view quiz questions" ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_quizzes sq WHERE sq.id = quiz_id AND get_staff_role(auth.uid()) IS NOT NULL
  ));

CREATE POLICY "Staff can manage quiz questions" ON public.quiz_questions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_quizzes sq WHERE sq.id = quiz_id AND get_staff_role(auth.uid()) IS NOT NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.student_quizzes sq WHERE sq.id = quiz_id AND get_staff_role(auth.uid()) IS NOT NULL
  ));

CREATE POLICY "Guardians can view quiz questions" ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_quizzes sq 
    JOIN public.guardian_students gs ON gs.student_id = sq.student_id
    WHERE sq.id = quiz_id AND gs.guardian_id = auth.uid()
  ));
