
-- قائمة طلاب النخبة لكل حلقة
CREATE TABLE public.excellence_elite_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  added_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(halaqa_id, student_id)
);

ALTER TABLE public.excellence_elite_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view elite students" ON public.excellence_elite_students
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage elite students" ON public.excellence_elite_students
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage elite students" ON public.excellence_elite_students
  FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']));
