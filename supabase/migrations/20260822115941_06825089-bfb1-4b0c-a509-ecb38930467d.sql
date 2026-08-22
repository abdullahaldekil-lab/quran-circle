-- 1) program_material_views: stop anonymous arbitrary inserts
DROP POLICY IF EXISTS "Anyone can log a material view" ON public.program_material_views;
REVOKE INSERT ON public.program_material_views FROM anon;

CREATE POLICY "Users log their own material views"
ON public.program_material_views FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_material_view(
  _material_id uuid,
  _event_type text,
  _student_code text DEFAULT NULL,
  _seconds integer DEFAULT 0,
  _percent numeric DEFAULT 0
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid;
BEGIN
  IF _material_id IS NULL OR _event_type NOT IN ('open','play','download','complete') THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.program_materials m WHERE m.id = _material_id) THEN
    RETURN false;
  END IF;

  -- Identify the student only through a real, active student code.
  IF _student_code IS NOT NULL AND length(trim(_student_code)) > 0 THEN
    SELECT s.id INTO _sid
    FROM public.students s
    WHERE upper(s.student_code) = upper(trim(_student_code))
      AND s.status = 'active'
    LIMIT 1;
    IF _sid IS NULL THEN
      RETURN false;
    END IF;
  ELSIF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.program_material_views
    (material_id, event_type, student_id, student_code, user_id, seconds_watched, completion_percent)
  VALUES (
    _material_id,
    _event_type,
    _sid,
    CASE WHEN _sid IS NULL THEN NULL ELSE upper(trim(_student_code)) END,
    auth.uid(),
    LEAST(GREATEST(COALESCE(_seconds, 0), 0), 200000),
    LEAST(GREATEST(COALESCE(_percent, 0), 0), 100)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.log_material_view(uuid, text, text, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_material_view(uuid, text, text, integer, numeric) TO anon, authenticated;

-- 2) tarbawi_events: honour visible_to_guardians for non-staff accounts
DROP POLICY IF EXISTS "authenticated read tarbawi events" ON public.tarbawi_events;
CREATE POLICY "read tarbawi events by visibility"
ON public.tarbawi_events FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR visible_to_guardians = true
);