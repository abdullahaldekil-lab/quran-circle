
CREATE TABLE public.narration_test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL DEFAULT 'narration',
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  hizb_number INTEGER,
  mistakes INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,
  narration_score NUMERIC NOT NULL DEFAULT 0,
  total_score NUMERIC NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  sections JSONB,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.narration_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view narration test results"
  ON public.narration_test_results FOR SELECT
  TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can insert narration test results"
  ON public.narration_test_results FOR INSERT
  TO authenticated
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage narration test results"
  ON public.narration_test_results FOR ALL
  TO authenticated
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');
