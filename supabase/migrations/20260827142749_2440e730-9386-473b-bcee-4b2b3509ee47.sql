CREATE OR REPLACE FUNCTION public.archive_targets()
RETURNS TABLE(tbl text, date_expr text, label_ar text)
LANGUAGE sql
IMMUTABLE
SET search_path = public
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