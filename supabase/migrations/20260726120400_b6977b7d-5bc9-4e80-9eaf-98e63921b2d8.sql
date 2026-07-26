-- جدولة الدوال الدورية.
--
-- لم يكن في المشروع أي جدولة إطلاقًا: الدوال المصمَّمة للعمل دوريًا
-- (staff-attendance-monitor و task-reminders و check-absence-warnings) لم تكن
-- تعمل أبدًا. هذا الترحيل يجدولها ويضيف مراقب حضور الطلاب الجديد.
--
-- ⚠️ قبل تطبيق هذا الترحيل:
--   1. انشر الدوال:  supabase functions deploy student-attendance-monitor
--   2. اضبط السر:    supabase secrets set CRON_SECRET=<قيمة عشوائية>
--   3. أنشئ سرّي Vault أدناه (project_url و cron_secret)
--
--   select vault.create_secret('https://ijzivmrodhxtjnjxsgvo.supabase.co', 'project_url');
--   select vault.create_secret('<نفس قيمة CRON_SECRET>', 'cron_secret');
--
-- التوقيت بـ UTC والرياض = UTC+3، لذا 10-16 UTC تغطي 13:00-19:00 بتوقيت الرياض
-- (العصر يقع ضمنها على مدار السنة). أيام الأسبوع 0-4 = الأحد إلى الخميس.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- إعادة الجدولة آمنة: نُلغي الوظيفة إن وُجدت قبل إنشائها.
CREATE OR REPLACE FUNCTION public.schedule_edge_function(
  _job_name TEXT,
  _schedule TEXT,
  _function_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  PERFORM cron.unschedule(_job_name) WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = _job_name
  );

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;

  IF v_url IS NULL THEN
    RAISE NOTICE 'project_url secret is missing — skipping schedule for %', _job_name;
    RETURN;
  END IF;

  PERFORM cron.schedule(
    _job_name,
    _schedule,
    format(
      $cmd$SELECT extensions.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );$cmd$,
      v_url || '/functions/v1/' || _function_name,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE(v_secret, '')
      )::text
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_edge_function(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- حضور الطلاب: كل ٥ دقائق خلال نافذة الحلقة (الأحد–الخميس)
SELECT public.schedule_edge_function(
  'student-attendance-monitor', '*/5 10-16 * * 0,1,2,3,4', 'student-attendance-monitor');

-- حضور الموظفين: كل ١٠ دقائق خلال النافذة نفسها
SELECT public.schedule_edge_function(
  'staff-attendance-monitor', '*/10 10-16 * * 0,1,2,3,4', 'staff-attendance-monitor');

-- تذكيرات المهام: كل ساعة
SELECT public.schedule_edge_function(
  'task-reminders', '0 * * * *', 'task-reminders');

-- إنذارات الغياب المتكرر: مرة أسبوعيًا صباح الأحد (05:00 UTC = 08:00 الرياض)
SELECT public.schedule_edge_function(
  'check-absence-warnings', '0 5 * * 0', 'check-absence-warnings');
