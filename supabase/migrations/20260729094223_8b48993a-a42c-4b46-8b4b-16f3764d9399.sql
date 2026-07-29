-- 1) get_staff_role must return NULL for non-staff (guardians / plain users)
CREATE OR REPLACE FUNCTION public.get_staff_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = _user_id
    AND p.role IS NOT NULL
    AND p.role NOT IN ('user','guardian')
    AND EXISTS (SELECT 1 FROM public.roles r WHERE r.name = p.role)
  LIMIT 1;
$$;

-- 2) Replace "any authenticated user" staff checks with is_staff()
DROP POLICY IF EXISTS "Staff can manage trips" ON public.trips;
CREATE POLICY "Staff can manage trips" ON public.trips FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage trip attendance" ON public.trip_attendance;
CREATE POLICY "Staff can manage trip attendance" ON public.trip_attendance FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage trip halaqat" ON public.trip_halaqat;
CREATE POLICY "Staff can manage trip halaqat" ON public.trip_halaqat FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage trip status logs" ON public.trip_status_log;
CREATE POLICY "Staff can manage trip status logs" ON public.trip_status_log FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage guardian profiles" ON public.guardian_profiles;
CREATE POLICY "Staff can manage guardian profiles" ON public.guardian_profiles FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view guardian profiles" ON public.guardian_profiles;
CREATE POLICY "Staff can view guardian profiles" ON public.guardian_profiles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage guardian links" ON public.guardian_students;
CREATE POLICY "Staff can manage guardian links" ON public.guardian_students FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert attendance audit log" ON public.attendance_audit_log;
CREATE POLICY "Staff can insert attendance audit log" ON public.attendance_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view attendance audit log" ON public.attendance_audit_log;
CREATE POLICY "Staff can view attendance audit log" ON public.attendance_audit_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 3) Storage: exact path match for document visibility
DROP POLICY IF EXISTS "Documents files respect visibility" ON storage.objects;
CREATE POLICY "Documents files respect visibility" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.visibility = 'all'
          AND (
            split_part(d.file_url, '/documents/', 2) = objects.name
            OR split_part(d.external_url, '/documents/', 2) = objects.name
          )
      )
    )
  );

-- 4) Financial attachments: explicit update/delete for manager & admin_staff
DROP POLICY IF EXISTS "Finance staff can update attachments" ON storage.objects;
CREATE POLICY "Finance staff can update attachments" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'financial-attachments' AND public.get_staff_role(auth.uid()) IN ('manager','admin_staff'))
  WITH CHECK (bucket_id = 'financial-attachments' AND public.get_staff_role(auth.uid()) IN ('manager','admin_staff'));

DROP POLICY IF EXISTS "Finance staff can delete attachments" ON storage.objects;
CREATE POLICY "Finance staff can delete attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'financial-attachments' AND public.get_staff_role(auth.uid()) IN ('manager','admin_staff'));

-- 5) Revoke direct EXECUTE on internal trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.log_student_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_student_level_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_summer_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_narration_achievements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_approved_excuse() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_approved_link_request() FROM PUBLIC, anon, authenticated;