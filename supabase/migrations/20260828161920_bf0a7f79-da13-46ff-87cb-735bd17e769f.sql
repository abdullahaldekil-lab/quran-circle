ALTER TABLE public.preparation_config
  ADD COLUMN IF NOT EXISTS teacher_window_close_minutes INTEGER NOT NULL DEFAULT 105;

CREATE OR REPLACE FUNCTION public.run_archive(_cutoff date, _label text, _year_label text DEFAULT NULL::text, _tables text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  cnt bigint;
  _total bigint := 0;
  _stats jsonb := '{}'::jsonb;
  _batch_id uuid;
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
  RETURNING id INTO _batch_id;

  FOR r IN SELECT * FROM public.archive_targets() LOOP
    IF sel IS NOT NULL AND NOT (r.tbl = ANY(sel)) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET archived_batch_id = $1, archived_at = now()
         WHERE archived_batch_id IS NULL AND (%s) < $2',
      r.tbl, r.date_expr) USING _batch_id, _cutoff;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    _stats := _stats || jsonb_build_object(r.tbl, cnt);
    _total := _total + cnt;
  END LOOP;

  UPDATE public.archive_batches
     SET stats = _stats, total_records = _total
   WHERE id = _batch_id;

  RETURN jsonb_build_object('batch_id', _batch_id, 'total', _total, 'stats', _stats);
END $function$;