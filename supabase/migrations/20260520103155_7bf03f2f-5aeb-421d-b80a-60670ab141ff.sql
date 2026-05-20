
DROP POLICY IF EXISTS "Staff can view students" ON public.students;
CREATE POLICY "Staff can view students" ON public.students
FOR SELECT USING (
  get_staff_role(auth.uid()) = ANY (ARRAY[
    'manager','admin_staff','supervisor','assistant_supervisor',
    'secretary','teacher','assistant_teacher','custom_1775663809732'
  ])
);

DROP POLICY IF EXISTS "Staff can update students" ON public.students;
CREATE POLICY "Staff can update students" ON public.students
FOR UPDATE USING (
  get_staff_role(auth.uid()) = ANY (ARRAY[
    'manager','admin_staff','supervisor','assistant_supervisor',
    'secretary','teacher','assistant_teacher','custom_1775663809732'
  ])
);
