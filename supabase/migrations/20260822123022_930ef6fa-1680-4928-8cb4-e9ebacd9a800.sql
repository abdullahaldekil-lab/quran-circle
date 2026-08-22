ALTER TABLE public.madarij_enrollments
  ADD COLUMN IF NOT EXISTS daily_pace numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pace_notes text;

CREATE OR REPLACE FUNCTION public.validate_madarij_daily_pace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.daily_pace IS NULL THEN
    NEW.daily_pace := 1;
  END IF;
  IF NEW.daily_pace NOT IN (0.5, 1) THEN
    RAISE EXCEPTION 'مسار الحفظ: السرعة اليومية يجب أن تكون نصف وجه (0.5) أو وجه كامل (1)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_madarij_daily_pace ON public.madarij_enrollments;
CREATE TRIGGER trg_validate_madarij_daily_pace
BEFORE INSERT OR UPDATE ON public.madarij_enrollments
FOR EACH ROW EXECUTE FUNCTION public.validate_madarij_daily_pace();