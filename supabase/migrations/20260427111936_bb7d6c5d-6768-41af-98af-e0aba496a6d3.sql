
-- Test type enum-like check
CREATE TABLE public.talqeen_student_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  curriculum_id UUID REFERENCES public.talqeen_curricula(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('internal_1','internal_2','promotion')),
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score NUMERIC(5,2),
  max_score NUMERIC(5,2) DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','failed')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, curriculum_id, test_type)
);

CREATE INDEX idx_talqeen_tests_student ON public.talqeen_student_tests(student_id);
CREATE INDEX idx_talqeen_tests_curriculum ON public.talqeen_student_tests(curriculum_id);

ALTER TABLE public.talqeen_student_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view talqeen tests"
  ON public.talqeen_student_tests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Guardians can view their children talqeen tests"
  ON public.talqeen_student_tests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guardian_students gs
    WHERE gs.student_id = talqeen_student_tests.student_id
      AND gs.guardian_id = auth.uid()
  ));

CREATE POLICY "Staff can insert talqeen tests"
  ON public.talqeen_student_tests FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid())
      IN ('manager','supervisor','teacher','assistant_teacher','custom_1775663809732')
  );

CREATE POLICY "Staff can update talqeen tests"
  ON public.talqeen_student_tests FOR UPDATE TO authenticated
  USING (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid())
      IN ('manager','supervisor','teacher','assistant_teacher','custom_1775663809732')
  );

CREATE POLICY "Manager and talqeen supervisor can delete talqeen tests"
  ON public.talqeen_student_tests FOR DELETE TO authenticated
  USING (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid())
      IN ('manager','custom_1775663809732')
  );

CREATE TRIGGER trg_talqeen_tests_updated_at
  BEFORE UPDATE ON public.talqeen_student_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
