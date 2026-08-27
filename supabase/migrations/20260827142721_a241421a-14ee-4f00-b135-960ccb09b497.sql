-- ============ 1) جدول دفعات الأرشفة ============
CREATE TABLE IF NOT EXISTS public.archive_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  cutoff_date date NOT NULL,
  academic_year_label text,
  status text NOT NULL DEFAULT 'archived',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_records integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_at timestamptz,
  restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.archive_batches TO authenticated;
GRANT ALL ON public.archive_batches TO service_role;

ALTER TABLE public.archive_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view archive batches"
  ON public.archive_batches FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Managers manage archive batches"
  ON public.archive_batches FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (public.get_staff_role(auth.uid()) = 'manager');

DROP TRIGGER IF EXISTS update_archive_batches_updated_at ON public.archive_batches;
CREATE TRIGGER update_archive_batches_updated_at
  BEFORE UPDATE ON public.archive_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2) وسم الأرشفة على الجداول التشغيلية ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attendance','recitation_records','talqeen_sessions','talqeen_session_attendance',
    'madarij_daily_progress','madarij_hizb_exams','staff_attendance',
    'excellence_sessions','excellence_attendance','excellence_performance',
    'narration_sessions','narration_results','tarbawi_weekly_records','tarbawi_events',
    'summer_daily_records','summer_attendance','trips'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS archived_batch_id uuid REFERENCES public.archive_batches(id) ON DELETE SET NULL,
         ADD COLUMN IF NOT EXISTS archived_at timestamptz', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (archived_batch_id)',
      'idx_' || t || '_archived_batch', t);
  END LOOP;
END $$;

-- ============ 3) خريطة الجداول وتواريخها ============
CREATE OR REPLACE FUNCTION public.archive_targets()
RETURNS TABLE(tbl text, date_expr text, label_ar text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('attendance','attendance_date','حضور الطلاب'),
    ('recitation_records','record_date','سجلات التسميع'),
    ('talqeen_sessions','session_date','جلسات التلقين'),
    ('talqeen_session_attendance','created_at::date','حضور جلسات التلقين'),
    ('madarij_daily_progress','progress_date','المتابعة اليومية (مدارج)'),
    ('madarij_hizb_exams','COALESCE(pass_date, created_at::date)','اختبارات الحزب (مدارج)'),
    ('staff_attendance','attendance_date','حضور الموظفين'),
    ('excellence_sessions','session_date','جلسات التميز'),
    ('excellence_attendance','created_at::date','حضور التميز'),
    ('excellence_performance','created_at::date','أداء التميز'),
    ('narration_sessions','session_date','جلسات السرد'),
    ('narration_results','created_at::date','نتائج السرد'),
    ('tarbawi_weekly_records','week_start','المتابعة التربوية الأسبوعية'),
    ('tarbawi_events','event_date','الفعاليات التربوية'),
    ('summer_daily_records','record_date','السجلات اليومية الصيفية'),
    ('summer_attendance','attendance_date','الحضور الصيفي'),
    ('trips','trip_date','الرحلات')
  ) AS v(tbl, date_expr, label_ar);
$$;

REVOKE ALL ON FUNCTION public.archive_targets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_targets() TO authenticated, service_role;

-- ============ 4) معاينة الأعداد القابلة للأرشفة ============
CREATE OR REPLACE FUNCTION public.preview_archive(_cutoff date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  cnt bigint;
  out jsonb := '[]'::jsonb;
BEGIN
  IF public.get_staff_role(auth.uid()) <> 'manager' THEN
    RAISE EXCEPTION 'غير مصرح: الأرشفة للمدير فقط';
  END IF;

  FOR r IN SELECT * FROM public.archive_targets() LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE archived_batch_id IS NULL AND (%s) < $1',
      r.tbl, r.date_expr) INTO cnt USING _cutoff;
    out := out || jsonb_build_object('table', r.tbl, 'label', r.label_ar, 'count', cnt);
  END LOOP;

  RETURN out;
END $$;

REVOKE ALL ON FUNCTION public.preview_archive(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_archive(date) TO authenticated, service_role;

-- ============ 5) تنفيذ الأرشفة ============
CREATE OR REPLACE FUNCTION public.run_archive(_cutoff date, _label text, _year_label text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  cnt bigint;
  total bigint := 0;
  stats jsonb := '{}'::jsonb;
  batch_id uuid;
BEGIN
  IF public.get_staff_role(auth.uid()) <> 'manager' THEN
    RAISE EXCEPTION 'غير مصرح: الأرشفة للمدير فقط';
  END IF;

  INSERT INTO public.archive_batches (label, cutoff_date, academic_year_label, created_by)
  VALUES (COALESCE(NULLIF(_label,''), 'أرشيف ما قبل ' || _cutoff::text), _cutoff, _year_label, auth.uid())
  RETURNING id INTO batch_id;

  FOR r IN SELECT * FROM public.archive_targets() LOOP
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
END $$;

REVOKE ALL ON FUNCTION public.run_archive(date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_archive(date, text, text) TO authenticated, service_role;

-- ============ 6) استرجاع دفعة أرشفة ============
CREATE OR REPLACE FUNCTION public.restore_archive(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  cnt bigint;
  total bigint := 0;
BEGIN
  IF public.get_staff_role(auth.uid()) <> 'manager' THEN
    RAISE EXCEPTION 'غير مصرح: الاسترجاع للمدير فقط';
  END IF;

  FOR r IN SELECT * FROM public.archive_targets() LOOP
    EXECUTE format(
      'UPDATE public.%I SET archived_batch_id = NULL, archived_at = NULL WHERE archived_batch_id = $1',
      r.tbl) USING _batch_id;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    total := total + cnt;
  END LOOP;

  UPDATE public.archive_batches
     SET status = 'restored', restored_at = now(), restored_by = auth.uid()
   WHERE id = _batch_id;

  RETURN jsonb_build_object('batch_id', _batch_id, 'restored', total);
END $$;

REVOKE ALL ON FUNCTION public.restore_archive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_archive(uuid) TO authenticated, service_role;