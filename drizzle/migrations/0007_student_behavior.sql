CREATE TABLE public.student_behavior (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  halaqa_id uuid REFERENCES public.halaqat(id) ON DELETE SET NULL,
  eval_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_behavior_student ON public.student_behavior(student_id, eval_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_behavior TO authenticated;
GRANT ALL ON public.student_behavior TO service_role;
ALTER TABLE public.student_behavior ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage behavior in scope" ON public.student_behavior FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND (NOT public.is_limited_teacher(auth.uid()) OR public.is_halaqa_teacher(halaqa_id)))
  WITH CHECK (public.is_staff(auth.uid()) AND (NOT public.is_limited_teacher(auth.uid()) OR public.is_halaqa_teacher(halaqa_id)));
CREATE POLICY "Guardians view own children behavior" ON public.student_behavior FOR SELECT TO authenticated
  USING (public.is_guardian_of(student_id));