-- بنية الرصد التلقائي للحضور: تخزين مواقيت الصلاة، وسجل الإجراءات التلقائية،
-- وإعدادات العتبات (تأخر 70 دقيقة / غياب 100 دقيقة) في preparation_config.

-- 1) تخزين مواقيت الصلاة ليوم واحد — تُجلب مرة واحدة بدل كل تشغيل للمراقب.
CREATE TABLE IF NOT EXISTS public.prayer_times_cache (
  prayer_date DATE PRIMARY KEY,
  fajr TEXT,
  dhuhr TEXT,
  asr TEXT,
  maghrib TEXT,
  isha TEXT,
  date TEXT,
  hijri_date TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prayer_times_cache TO anon, authenticated;
GRANT ALL ON public.prayer_times_cache TO service_role;

ALTER TABLE public.prayer_times_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read prayer times" ON public.prayer_times_cache;
CREATE POLICY "Anyone can read prayer times" ON public.prayer_times_cache
  FOR SELECT TO anon, authenticated USING (true);
-- الكتابة عبر service_role فقط (يتجاوز RLS) — لا سياسة كتابة للمستخدمين.

-- 2) سجل الإجراءات التلقائية.
--
-- القيد الفريد (student_id, attendance_date, stage) هو ما يمنع التكرار: يحاول
-- المراقب الإدراج، فإن لم يُرجع صفًا فالإجراء نُفِّذ سابقًا. هذا يحل محل حيلة
-- كتابة علامات إيموجي داخل حقل الملاحظات المستخدمة في مراقب الموظفين، وهي هشّة
-- لأن أي تعديل يدوي للملاحظات يُعيد تشغيل الإشعار أو يكتمه نهائيًا.
CREATE TABLE IF NOT EXISTS public.attendance_auto_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('late', 'absent')),
  attendance_id UUID,
  guardians_notified INTEGER NOT NULL DEFAULT 0,
  minutes_after_start INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendance_auto_marks UNIQUE (student_id, attendance_date, stage)
);

CREATE INDEX IF NOT EXISTS idx_attendance_auto_marks_date
  ON public.attendance_auto_marks (attendance_date);

GRANT SELECT ON public.attendance_auto_marks TO authenticated;
GRANT ALL ON public.attendance_auto_marks TO service_role;

ALTER TABLE public.attendance_auto_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view auto marks" ON public.attendance_auto_marks;
CREATE POLICY "Staff can view auto marks" ON public.attendance_auto_marks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- نظير الجدول لحضور الموظفين، بدل علامات الإيموجي في notes.
CREATE TABLE IF NOT EXISTS public.staff_attendance_auto_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('late', 'absent')),
  minutes_after_start INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_staff_attendance_auto_marks UNIQUE (staff_id, attendance_date, stage)
);

GRANT SELECT ON public.staff_attendance_auto_marks TO authenticated;
GRANT ALL ON public.staff_attendance_auto_marks TO service_role;

ALTER TABLE public.staff_attendance_auto_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view own auto marks" ON public.staff_attendance_auto_marks;
CREATE POLICY "Staff can view own auto marks" ON public.staff_attendance_auto_marks
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR public.has_permission(auth.uid(), 'view_staff_attendance'));

-- 3) إعدادات العتبات. العمودان tardiness_minutes و absent_minutes موجودان أصلًا
--    لكنهما لم يكونا مستخدمين للطلاب.
ALTER TABLE public.preparation_config
  ADD COLUMN IF NOT EXISTS attendance_auto_mark_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS teacher_window_close_minutes INTEGER NOT NULL DEFAULT 105;

UPDATE public.preparation_config
   SET tardiness_minutes = COALESCE(tardiness_minutes, 70),
       absent_minutes    = COALESCE(absent_minutes, 100);

-- 4) قناة واتساب لرسالة التأخر (كانت داخل التطبيق فقط، بخلاف رسالة الغياب).
UPDATE public.notification_templates
   SET default_channels = ARRAY['inApp', 'whatsapp']
 WHERE code = 'STUDENT_LATE'
   AND NOT ('whatsapp' = ANY(default_channels));

-- 5) قالبان للعاملين. القالب الموجود STAFF_ATTENDANCE نصّه "تم تسجيل حضورك"
--    وهو لتأكيد البصمة، فلا يصلح للتأخر ولا للغياب.
INSERT INTO public.notification_templates (code, title, body, default_channels, category)
VALUES
  ('STAFF_LATE',   'تذكير بتسجيل الحضور',
   'مضى {minutes} دقيقة على بداية الدوام دون تسجيل حضورك. يرجى المبادرة قبل احتساب الغياب.',
   ARRAY['inApp', 'whatsapp'], 'attendance'),
  ('STAFF_ABSENT', 'تم تسجيل غياب',
   'تم تسجيل غيابك تلقائياً بتاريخ {date} لعدم تسجيل الحضور خلال {minutes} دقيقة من بداية الدوام.',
   ARRAY['inApp', 'whatsapp'], 'attendance')
ON CONFLICT (code) DO NOTHING;
