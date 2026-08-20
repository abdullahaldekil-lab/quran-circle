CREATE OR REPLACE FUNCTION public.prevent_duplicate_enrollment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id_number text;
  _recent int;
BEGIN
  NEW.student_full_name := btrim(NEW.student_full_name);
  NEW.guardian_phone := regexp_replace(NEW.guardian_phone, '\s', '', 'g');
  _id_number := nullif(btrim(coalesce(NEW.form_data->>'student_id_number','')), '');

  IF _id_number IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.enrollment_requests er
    WHERE er.form_data->>'student_id_number' = _id_number
      AND er.status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_ID_NUMBER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.enrollment_requests er
    WHERE lower(btrim(er.student_full_name)) = lower(NEW.student_full_name)
      AND regexp_replace(er.guardian_phone, '\s', '', 'g') = NEW.guardian_phone
      AND er.status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_STUDENT_REQUEST';
  END IF;

  SELECT count(*) INTO _recent FROM public.enrollment_requests er
  WHERE regexp_replace(er.guardian_phone, '\s', '', 'g') = NEW.guardian_phone
    AND er.created_at > now() - interval '1 hour';

  IF _recent >= 3 THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_enrollment_request ON public.enrollment_requests;
CREATE TRIGGER prevent_duplicate_enrollment_request
BEFORE INSERT ON public.enrollment_requests
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_enrollment_request();