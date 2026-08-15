-- Helpers mirroring the client-side validation in src/lib/planRanges.ts
CREATE OR REPLACE FUNCTION public.plan_range_norm(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(
    translate(coalesce(_raw, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'),
    '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.plan_range_num(_raw text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  m text[];
BEGIN
  m := regexp_match(public.plan_range_norm(_raw), '([0-9]+(\.[0-9]+)?)\s*$');
  IF m IS NULL THEN RETURN NULL; END IF;
  RETURN m[1]::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_range_name(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text := public.plan_range_norm(_raw);
BEGIN
  RETURN btrim(regexp_replace(t, '([0-9]+(\.[0-9]+)?)\s*$', ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_plan_prev_ranges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  arr jsonb := coalesce(NEW.previous_memorized_ranges, '[]'::jsonb);
  r jsonb;
  r2 jsonb;
  i int;
  j int;
  n int;
  v_from text;
  v_to text;
  v_pages numeric;
  a numeric; b numeric; c numeric; d numeric;
BEGIN
  IF jsonb_typeof(arr) <> 'array' THEN
    RAISE EXCEPTION 'مواضع الحفظ السابق يجب أن تكون قائمة';
  END IF;

  n := jsonb_array_length(arr);

  FOR i IN 0..GREATEST(n - 1, 0) LOOP
    EXIT WHEN n = 0;
    r := arr -> i;
    v_from := public.plan_range_norm(r ->> 'from');
    v_to := public.plan_range_norm(r ->> 'to');
    v_pages := NULLIF(r ->> 'pages', '')::numeric;

    -- Skip fully empty entries
    CONTINUE WHEN coalesce(v_from, '') = '' AND coalesce(v_to, '') = ''
      AND coalesce(v_pages, 0) = 0 AND coalesce(r ->> 'juz', '') = '';

    IF coalesce(v_from, '') = '' OR coalesce(v_to, '') = '' THEN
      RAISE EXCEPTION 'يرجى تحديد «من» و«إلى» في كل موضع من مواضع الحفظ السابق';
    END IF;

    IF v_pages IS NULL OR v_pages <= 0 THEN
      RAISE EXCEPTION 'عدد الأوجه في مواضع الحفظ السابق يجب أن يكون أكبر من صفر';
    END IF;

    a := public.plan_range_num(v_from);
    b := public.plan_range_num(v_to);
    IF a IS NOT NULL AND b IS NOT NULL
       AND public.plan_range_name(v_from) = public.plan_range_name(v_to)
       AND a > b THEN
      RAISE EXCEPTION '«من» يجب أن يكون أقل من أو يساوي «إلى» في مواضع الحفظ السابق';
    END IF;

    -- Overlap check against later comparable entries
    FOR j IN (i + 1)..GREATEST(n - 1, 0) LOOP
      EXIT WHEN j > n - 1;
      r2 := arr -> j;
      IF coalesce(r ->> 'juz', '') IS DISTINCT FROM coalesce(r2 ->> 'juz', '') THEN CONTINUE; END IF;
      IF public.plan_range_name(r ->> 'from') IS DISTINCT FROM public.plan_range_name(r2 ->> 'from') THEN CONTINUE; END IF;
      c := public.plan_range_num(r2 ->> 'from');
      d := public.plan_range_num(r2 ->> 'to');
      IF a IS NULL OR b IS NULL OR c IS NULL OR d IS NULL THEN CONTINUE; END IF;
      IF a <= d AND c <= b THEN
        RAISE EXCEPTION 'يوجد تداخل بين مواضع الحفظ السابق في نفس الخطة';
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_plan_prev_ranges_trg ON public.student_annual_plans;
CREATE TRIGGER validate_plan_prev_ranges_trg
BEFORE INSERT OR UPDATE ON public.student_annual_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_plan_prev_ranges();