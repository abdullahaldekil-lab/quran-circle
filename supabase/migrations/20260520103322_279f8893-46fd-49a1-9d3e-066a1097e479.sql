
DROP POLICY IF EXISTS "Supervisor manage chapters" ON public.talqeen_chapters;
CREATE POLICY "Supervisor manage chapters" ON public.talqeen_chapters
FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor','custom_1775663809732']));

DROP POLICY IF EXISTS "Supervisor manage lessons" ON public.talqeen_lessons;
CREATE POLICY "Supervisor manage lessons" ON public.talqeen_lessons
FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor','custom_1775663809732']));

DROP POLICY IF EXISTS "Supervisor manage assignments" ON public.talqeen_program_assignments;
CREATE POLICY "Supervisor manage assignments" ON public.talqeen_program_assignments
FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor','custom_1775663809732']));
