-- 1. Strict staff-role helper
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.role IS NOT NULL
      AND p.role NOT IN ('user','guardian')
      AND EXISTS (SELECT 1 FROM public.roles r WHERE r.name = p.role)
  )
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_guardian_of(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_students gs
    WHERE gs.student_id = _student_id AND gs.guardian_id = auth.uid() AND gs.active
  )
$$;
REVOKE ALL ON FUNCTION public.is_guardian_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(uuid) TO authenticated, service_role;

-- 2. student_status_log -> strict staff
DROP POLICY IF EXISTS "Staff can view status log" ON public.student_status_log;
DROP POLICY IF EXISTS "Staff can insert status log" ON public.student_status_log;
CREATE POLICY "Staff can view status log" ON public.student_status_log
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert status log" ON public.student_status_log
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- 3. buses -> restricted roles only
DROP POLICY IF EXISTS "Staff can view buses" ON public.buses;
CREATE POLICY "Transport staff can view buses" ON public.buses
FOR SELECT TO authenticated
USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','admin_staff','secretary','supervisor']));

-- 4. student_badges
DROP POLICY IF EXISTS "Authenticated can view student badges" ON public.student_badges;
DROP POLICY IF EXISTS "Authenticated can award badges" ON public.student_badges;
DROP POLICY IF EXISTS "Staff can update student badges" ON public.student_badges;
DROP POLICY IF EXISTS "Staff can delete student badges" ON public.student_badges;
CREATE POLICY "Staff or guardian can view student badges" ON public.student_badges
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_guardian_of(student_id));
CREATE POLICY "Staff can award badges" ON public.student_badges
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update student badges" ON public.student_badges
FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete student badges" ON public.student_badges
FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- 5. student_points
DROP POLICY IF EXISTS "Authenticated can view points" ON public.student_points;
DROP POLICY IF EXISTS "System can insert points" ON public.student_points;
CREATE POLICY "Staff or guardian can view points" ON public.student_points
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_guardian_of(student_id));
CREATE POLICY "Staff can insert points" ON public.student_points
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- 6. student_levels
DROP POLICY IF EXISTS "Authenticated can manage student_levels" ON public.student_levels;
DROP POLICY IF EXISTS "Authenticated can view student_levels" ON public.student_levels;
CREATE POLICY "Staff or guardian can view student_levels" ON public.student_levels
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_guardian_of(student_id));
CREATE POLICY "Staff can manage student_levels" ON public.student_levels
FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 7. reward_nominations
DROP POLICY IF EXISTS "Authenticated can manage nominations" ON public.reward_nominations;
DROP POLICY IF EXISTS "Authenticated can view nominations" ON public.reward_nominations;
CREATE POLICY "Staff can view nominations" ON public.reward_nominations
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can manage nominations" ON public.reward_nominations
FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 8. talqeen_student_tests
DROP POLICY IF EXISTS "Authenticated users can view talqeen tests" ON public.talqeen_student_tests;
CREATE POLICY "Staff can view talqeen tests" ON public.talqeen_student_tests
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 9. narration_external_tokens: no public listing; access via secure RPC
DROP POLICY IF EXISTS "Anyone can read valid token" ON public.narration_external_tokens;
DROP POLICY IF EXISTS "Anyone can mark token used" ON public.narration_external_tokens;
CREATE POLICY "Staff can view tokens" ON public.narration_external_tokens
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_external_narration_token(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 10 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', t.id,
    'session_id', t.session_id,
    'expires_at', t.expires_at,
    'used_at', t.used_at,
    'session_date', s.session_date
  ) INTO v
  FROM public.narration_external_tokens t
  LEFT JOIN public.narration_sessions s ON s.id = t.session_id
  WHERE t.token = _token AND t.expires_at > now()
  LIMIT 1;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_external_narration_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_external_narration_token(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_external_narration_review(_token text, _reviewer_name text, _reviewer_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF _token IS NULL OR length(_token) < 10 THEN RETURN false; END IF;
  IF _reviewer_name IS NULL OR length(trim(_reviewer_name)) = 0 OR length(_reviewer_name) > 120 THEN RETURN false; END IF;
  IF _reviewer_phone IS NULL OR length(trim(_reviewer_phone)) = 0 OR length(_reviewer_phone) > 30 THEN RETURN false; END IF;
  UPDATE public.narration_external_tokens
  SET reviewer_name = left(trim(_reviewer_name), 120),
      reviewer_phone = left(trim(_reviewer_phone), 30),
      used_at = now()
  WHERE token = _token AND expires_at > now()
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_external_narration_review(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_external_narration_review(text, text, text) TO anon, authenticated, service_role;

-- 10. Avatars bucket: stop bulk listing (public URLs keep working)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Users can view own avatar objects" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 11. Realtime: staff cannot read per-user topics
DROP POLICY IF EXISTS "Authenticated users can receive their own notifications" ON realtime.messages;
CREATE POLICY "Scoped realtime topic access" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE ('%' || (auth.uid())::text || '%')
  OR (
    public.is_staff(auth.uid())
    AND realtime.topic() !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  )
);

-- 12. Revoke direct execution of internal trigger functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_narration_achievements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_summer_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_approved_excuse() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_approved_link_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_staff_role(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM anon;
