
-- 1) Maqra specialization: hifz | taahud
ALTER TABLE public.summer_maqare
  ADD COLUMN IF NOT EXISTS plan_category text
    CHECK (plan_category IN ('hifz','taahud'));

-- 2) Student plan fields (pages target + duration + daily quota)
ALTER TABLE public.summer_students
  ADD COLUMN IF NOT EXISTS pages_target integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_start_date date,
  ADD COLUMN IF NOT EXISTS plan_end_date date,
  ADD COLUMN IF NOT EXISTS daily_pages numeric(5,2) NOT NULL DEFAULT 0;

-- Ensure daily minimum can never be less than 1 when a target is set (soft rule via trigger)
CREATE OR REPLACE FUNCTION public.enforce_summer_daily_min()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pages_target > 0 AND NEW.plan_start_date IS NOT NULL AND NEW.plan_end_date IS NOT NULL THEN
    -- guarantee at least 1 wajh/day when data is complete
    IF NEW.daily_pages IS NULL OR NEW.daily_pages < 1 THEN
      NEW.daily_pages := 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_summer_students_daily_min ON public.summer_students;
CREATE TRIGGER trg_summer_students_daily_min
  BEFORE INSERT OR UPDATE ON public.summer_students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_summer_daily_min();
