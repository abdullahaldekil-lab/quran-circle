
DROP POLICY IF EXISTS "Manager and admin can view enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Manager and admin can view enrollment requests"
ON public.enrollment_requests FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
  AND p.role = ANY (ARRAY['manager','secretary','admin_staff','supervisor','assistant_supervisor','custom_1775663809732'])));

DROP POLICY IF EXISTS "Manager and admin can update enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Manager and admin can update enrollment requests"
ON public.enrollment_requests FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
  AND p.role = ANY (ARRAY['manager','secretary','admin_staff','custom_1775663809732'])));

DROP POLICY IF EXISTS "Staff can insert students" ON public.students;
CREATE POLICY "Staff can insert students"
ON public.students FOR INSERT
WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','admin_staff','supervisor','teacher','assistant_teacher','secretary','custom_1775663809732']));

DROP POLICY IF EXISTS "Staff can view pre-registrations" ON public.pre_registrations;
