-- 1) summer_daily_records: drop wildcard custom_% role matching
DROP POLICY IF EXISTS "Managers manage summer daily records" ON public.summer_daily_records;
CREATE POLICY "Managers manage summer daily records"
ON public.summer_daily_records FOR ALL TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_summer_programs')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
             AND p.role = ANY (ARRAY['manager','talqeen_supervisor','talqeen_assistant_supervisor']))
)
WITH CHECK (
  public.has_permission(auth.uid(), 'manage_summer_programs')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
             AND p.role = ANY (ARRAY['manager','talqeen_supervisor','talqeen_assistant_supervisor']))
);

-- 2) documents bucket: explicit manager-scoped UPDATE policy
DROP POLICY IF EXISTS "Manager can update documents files" ON storage.objects;
CREATE POLICY "Manager can update documents files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND public.get_staff_role(auth.uid()) = 'manager')
WITH CHECK (bucket_id = 'documents' AND public.get_staff_role(auth.uid()) = 'manager');

-- 3) level_tracks / level_branches / level_parts: authenticated-only reads
DROP POLICY IF EXISTS "Authenticated can view level_tracks" ON public.level_tracks;
CREATE POLICY "Authenticated can view level_tracks"
ON public.level_tracks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can view level_branches" ON public.level_branches;
CREATE POLICY "Authenticated can view level_branches"
ON public.level_branches FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can view level_parts" ON public.level_parts;
CREATE POLICY "Authenticated can view level_parts"
ON public.level_parts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.level_tracks FROM anon;
REVOKE SELECT ON public.level_branches FROM anon;
REVOKE SELECT ON public.level_parts FROM anon;

-- 4) staff_checkin_qr: staff only
DROP POLICY IF EXISTS "Authenticated can read active QR" ON public.staff_checkin_qr;
CREATE POLICY "Staff can read active QR"
ON public.staff_checkin_qr FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND (active = true OR public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor'])));

-- 5) student_annual_plans: scope staff reads/inserts
DROP POLICY IF EXISTS "Staff can view student annual plans" ON public.student_annual_plans;
CREATE POLICY "Staff can view student annual plans"
ON public.student_annual_plans FOR SELECT TO authenticated
USING (
  public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','secretary','supervisor','assistant_supervisor'])
  OR public.is_halaqa_teacher(halaqa_id)
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_annual_plans.student_id AND public.is_halaqa_teacher(s.halaqa_id))
);
DROP POLICY IF EXISTS "Staff can insert student annual plans" ON public.student_annual_plans;
CREATE POLICY "Staff can insert student annual plans"
ON public.student_annual_plans FOR INSERT TO authenticated
WITH CHECK (
  public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor'])
  OR public.is_halaqa_teacher(halaqa_id)
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_annual_plans.student_id AND public.is_halaqa_teacher(s.halaqa_id))
);

-- 6) summer_attendance: staff + linked guardians only
DROP POLICY IF EXISTS "Authenticated can read summer attendance" ON public.summer_attendance;
CREATE POLICY "Staff and guardians can read summer attendance"
ON public.summer_attendance FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.summer_students ss
    WHERE ss.id = summer_attendance.summer_student_id
      AND ss.student_id IS NOT NULL
      AND public.is_guardian_of(ss.student_id)
  )
);

-- 7) summer_maqare: staff or own teacher
DROP POLICY IF EXISTS "Authenticated can read maqare" ON public.summer_maqare;
CREATE POLICY "Staff can read maqare"
ON public.summer_maqare FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR teacher_id = auth.uid());

-- 8) summer_students: staff, own maqra teacher, linked guardians
DROP POLICY IF EXISTS "Authenticated can read summer students" ON public.summer_students;
CREATE POLICY "Staff and guardians can read summer students"
ON public.summer_students FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.summer_maqare m WHERE m.id = summer_students.maqra_id AND m.teacher_id = auth.uid())
  OR (student_id IS NOT NULL AND public.is_guardian_of(student_id))
);