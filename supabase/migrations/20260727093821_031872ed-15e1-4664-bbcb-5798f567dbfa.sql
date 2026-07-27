-- 1) Madarij tables: staff or the student's guardian only
DROP POLICY IF EXISTS "Authenticated can view madarij_daily_progress" ON public.madarij_daily_progress;
CREATE POLICY "Staff or guardian can view madarij_daily_progress"
ON public.madarij_daily_progress FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.madarij_enrollments e
    WHERE e.id = madarij_daily_progress.enrollment_id
      AND public.is_guardian_of(e.student_id)
  )
);

DROP POLICY IF EXISTS "Authenticated can view madarij_mistakes" ON public.madarij_mistakes;
CREATE POLICY "Staff or guardian can view madarij_mistakes"
ON public.madarij_mistakes FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR public.is_guardian_of(student_id)
);

DROP POLICY IF EXISTS "Authenticated can view madarij_enrollments" ON public.madarij_enrollments;
CREATE POLICY "Staff or guardian can view madarij_enrollments"
ON public.madarij_enrollments FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_guardian_of(student_id));

DROP POLICY IF EXISTS "Authenticated can view madarij_hizb_exams" ON public.madarij_hizb_exams;
CREATE POLICY "Staff or guardian can view madarij_hizb_exams"
ON public.madarij_hizb_exams FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.madarij_enrollments e
    WHERE e.id = madarij_hizb_exams.enrollment_id
      AND public.is_guardian_of(e.student_id)
  )
);

-- 2) profiles: self or staff
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON public.profiles;
CREATE POLICY "Users view own profile, staff view staff profiles"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_staff(auth.uid()));

-- 3) storage: documents bucket respects documents.visibility
DROP POLICY IF EXISTS "Authenticated can view documents files" ON storage.objects;
CREATE POLICY "Documents files respect visibility"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.visibility = 'all'
        AND (d.file_url LIKE '%' || storage.objects.name OR d.external_url LIKE '%' || storage.objects.name)
    )
  )
);

-- 4) storage: recitation-audio ownership checks (path = <student_id>/<file>)
DROP POLICY IF EXISTS "Authenticated can read recitation audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete audio" ON storage.objects;

CREATE POLICY "Staff or guardian can read recitation audio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'recitation-audio'
  AND (
    public.is_staff(auth.uid())
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_guardian_of(((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Staff can upload recitation audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recitation-audio' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete recitation audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recitation-audio' AND public.is_staff(auth.uid()));

-- 5) enrollment_requests: replace always-true INSERT check with validation
DROP POLICY IF EXISTS "Anyone can submit enrollment request" ON public.enrollment_requests;
CREATE POLICY "Anyone can submit a valid enrollment request"
ON public.enrollment_requests FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'pending'::enrollment_request_status
  AND length(btrim(student_full_name)) BETWEEN 2 AND 120
  AND length(btrim(guardian_full_name)) BETWEEN 2 AND 120
  AND guardian_phone ~ '^[0-9+][0-9 +-]{7,19}$'
  AND (student_birth_year IS NULL OR student_birth_year BETWEEN 1900 AND 2100)
  AND (notes IS NULL OR length(notes) <= 1000)
  AND (preferred_time IS NULL OR length(preferred_time) <= 100)
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND rejection_reason IS NULL
  AND converted_student_id IS NULL
  AND converted_guardian_id IS NULL
);

-- 6) Internal helper SECURITY DEFINER functions must not be callable from the client
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_guardian_of(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_staff_role(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, authenticated;