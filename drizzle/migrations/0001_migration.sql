CREATE OR REPLACE FUNCTION public.is_limited_teacher(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.get_staff_role(_uid) IN ('teacher','assistant_teacher'), false)
$$;

DROP POLICY IF EXISTS "Staff can view halaqat" ON public.halaqat;
CREATE POLICY "Staff can view halaqat" ON public.halaqat FOR SELECT TO authenticated
USING (public.get_staff_role(auth.uid()) IS NOT NULL AND (NOT public.is_limited_teacher(auth.uid()) OR teacher_id = auth.uid() OR assistant_teacher_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can manage attendance" ON public.attendance;
CREATE POLICY "Staff can manage attendance" ON public.attendance FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IS NOT NULL AND (NOT public.is_limited_teacher(auth.uid()) OR public.is_halaqa_teacher(halaqa_id)))
WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL AND (NOT public.is_limited_teacher(auth.uid()) OR public.is_halaqa_teacher(halaqa_id)));

DROP POLICY IF EXISTS "Staff can manage talqeen sessions" ON public.talqeen_sessions;
CREATE POLICY "Staff can manage talqeen sessions" ON public.talqeen_sessions FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IS NOT NULL AND (NOT public.is_limited_teacher(auth.uid()) OR public.is_halaqa_teacher(halaqa_id)))
WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL AND (NOT public.is_limited_teacher(auth.uid()) OR public.is_halaqa_teacher(halaqa_id)));

DROP POLICY IF EXISTS "Staff can manage talqeen attendance" ON public.talqeen_session_attendance;
CREATE POLICY "Staff can manage talqeen attendance" ON public.talqeen_session_attendance FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IS NOT NULL AND (NOT public.is_limited_teacher(auth.uid()) OR EXISTS (SELECT 1 FROM public.talqeen_sessions ts WHERE ts.id = session_id AND public.is_halaqa_teacher(ts.halaqa_id))))
WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL AND (NOT public.is_limited_teacher(auth.uid()) OR EXISTS (SELECT 1 FROM public.talqeen_sessions ts WHERE ts.id = session_id AND public.is_halaqa_teacher(ts.halaqa_id))));