ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS marked_by uuid DEFAULT auth.uid();

CREATE POLICY "Guardians view child talqeen attendance" ON public.talqeen_session_attendance FOR SELECT TO authenticated USING (public.is_guardian_of(student_id));
CREATE POLICY "Guardians view child talqeen sessions" ON public.talqeen_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students s WHERE s.halaqa_id = talqeen_sessions.halaqa_id AND public.is_guardian_of(s.id)));

CREATE TABLE public.guardian_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guardian_edit_log TO authenticated;
GRANT ALL ON public.guardian_edit_log TO service_role;
ALTER TABLE public.guardian_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff or guardian view edit log" ON public.guardian_edit_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR guardian_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guardian_update_student(_student_id uuid, _fields jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed text[] := ARRAY['guardian_phone','guardian_work','guardian_phone_alt','residence_location','school_name','grade','student_phone'];
  k text; clean jsonb := '{}'::jsonb; old jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_guardian_of(_student_id) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  FOR k IN SELECT jsonb_object_keys(_fields) LOOP
    IF k = ANY(allowed) THEN clean := clean || jsonb_build_object(k, left(coalesce(_fields->>k,''), 200)); END IF;
  END LOOP;
  IF clean = '{}'::jsonb THEN RETURN false; END IF;
  SELECT to_jsonb(s) INTO old FROM (SELECT guardian_phone, guardian_work, guardian_phone_alt, residence_location, school_name, grade, student_phone FROM public.students WHERE id = _student_id) s;
  UPDATE public.students SET
    guardian_phone = CASE WHEN clean ? 'guardian_phone' THEN nullif(clean->>'guardian_phone','') ELSE guardian_phone END,
    guardian_work = CASE WHEN clean ? 'guardian_work' THEN nullif(clean->>'guardian_work','') ELSE guardian_work END,
    guardian_phone_alt = CASE WHEN clean ? 'guardian_phone_alt' THEN nullif(clean->>'guardian_phone_alt','') ELSE guardian_phone_alt END,
    residence_location = CASE WHEN clean ? 'residence_location' THEN nullif(clean->>'residence_location','') ELSE residence_location END,
    school_name = CASE WHEN clean ? 'school_name' THEN nullif(clean->>'school_name','') ELSE school_name END,
    grade = CASE WHEN clean ? 'grade' THEN nullif(clean->>'grade','') ELSE grade END,
    student_phone = CASE WHEN clean ? 'student_phone' THEN nullif(clean->>'student_phone','') ELSE student_phone END,
    updated_at = now()
  WHERE id = _student_id;
  INSERT INTO public.guardian_edit_log(student_id, guardian_id, old_values, new_values) VALUES (_student_id, auth.uid(), coalesce(old,'{}'::jsonb), clean);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.guardian_update_student(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.guardian_update_student(uuid, jsonb) TO authenticated;