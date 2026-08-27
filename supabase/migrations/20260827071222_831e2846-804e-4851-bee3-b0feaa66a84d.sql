DROP POLICY IF EXISTS "Managers manage program materials" ON public.program_materials;
CREATE POLICY "Managers manage program materials"
ON public.program_materials FOR ALL TO authenticated
USING (get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));