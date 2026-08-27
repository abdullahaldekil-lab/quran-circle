CREATE OR REPLACE FUNCTION public.run_archive(_cutoff date, _label text, _year_label text DEFAULT NULL::text, _tables text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  cnt bigint;
  total bigint := 0;
  stats jsonb := '{}'::jsonb;
  batch_id uuid;
  sel text[];
BEGIN
  IF public.get_staff_role(auth.uid()) <> 'manager' THEN
    RAISE EXCEPTION 'غير مصرح: الأرشفة للمدير فقط';
  END IF;

  sel := _tables;
  IF sel IS NOT NULL AND array_length(sel, 1) IS NULL THEN
    RAISE EXCEPTION 'يجب اختيار نوع بيانات واحد على الأقل للأرشفة';
  END IF;

  INSERT INTO public.archive_batches (label, cutoff_date, academic_year_label, created_by)
  VALUES (COALESCE(NULLIF(_label,''), 'أرشيف ما قبل ' || _cutoff::text), _cutoff, _year_label, auth.uid())
  RETURNING id INTO batch_id;

  FOR r IN SELECT * FROM public.archive_targets() LOOP
    IF sel IS NOT NULL AND NOT (r.tbl = ANY(sel)) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET archived_batch_id = $1, archived_at = now()
         WHERE archived_batch_id IS NULL AND (%s) < $2',
      r.tbl, r.date_expr) USING batch_id, _cutoff;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    stats := stats || jsonb_build_object(r.tbl, cnt);
    total := total + cnt;
  END LOOP;

  UPDATE public.archive_batches
     SET stats = stats, total_records = total
   WHERE id = batch_id;

  RETURN jsonb_build_object('batch_id', batch_id, 'total', total, 'stats', stats);
END $function$;

REVOKE ALL ON FUNCTION public.run_archive(date, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_archive(date, text, text, text[]) TO authenticated, service_role;
DROP FUNCTION IF EXISTS public.run_archive(date, text, text);