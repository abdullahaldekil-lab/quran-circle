CREATE OR REPLACE FUNCTION public.guardian_trip_ids(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT th.trip_id FROM trip_halaqat th
  JOIN students s ON s.halaqa_id = th.halaqa_id
  JOIN guardian_students gs ON gs.student_id = s.id
  WHERE gs.guardian_id = _uid
$$;
REVOKE EXECUTE ON FUNCTION public.guardian_trip_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.guardian_trip_ids(uuid) TO authenticated;

DROP POLICY IF EXISTS "Guardians can view trip halaqat" ON public.trip_halaqat;
CREATE POLICY "Guardians can view trip halaqat" ON public.trip_halaqat FOR SELECT TO authenticated
  USING (trip_id IN (SELECT public.guardian_trip_ids(auth.uid())));

DROP POLICY IF EXISTS "Guardians can view trips via halaqat" ON public.trips;
CREATE POLICY "Guardians can view trips via halaqat" ON public.trips FOR SELECT TO authenticated
  USING (id IN (SELECT public.guardian_trip_ids(auth.uid())));

DROP POLICY IF EXISTS "Guardians can view trip status logs" ON public.trip_status_log;
CREATE POLICY "Guardians can view trip status logs" ON public.trip_status_log FOR SELECT TO authenticated
  USING (trip_id IN (SELECT public.guardian_trip_ids(auth.uid())));