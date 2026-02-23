
-- 1) جدول قوالب الإشعارات
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  default_channels TEXT[] NOT NULL DEFAULT ARRAY['inApp'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view notification templates"
  ON public.notification_templates FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage notification templates"
  ON public.notification_templates FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- 2) جدول الإشعارات المرسلة
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'inApp',
  status TEXT NOT NULL DEFAULT 'pending',
  meta_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى إشعاراته فقط
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- المستخدم يمكنه تحديث إشعاراته (تعليم كمقروء)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- المدير يرى كل الإشعارات
CREATE POLICY "Manager can view all notifications"
  ON public.notifications FOR SELECT
  USING (get_staff_role(auth.uid()) = 'manager');

-- النظام يمكنه إدراج إشعارات (عبر service role)
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- المدير يمكنه حذف الإشعارات
CREATE POLICY "Manager can delete notifications"
  ON public.notifications FOR DELETE
  USING (get_staff_role(auth.uid()) = 'manager');

-- 3) جدول تفضيلات الإشعارات
CREATE TABLE public.user_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  enable_in_app BOOLEAN NOT NULL DEFAULT true,
  enable_email BOOLEAN NOT NULL DEFAULT false,
  enable_whatsapp BOOLEAN NOT NULL DEFAULT false,
  academic_notifications BOOLEAN NOT NULL DEFAULT true,
  attendance_notifications BOOLEAN NOT NULL DEFAULT true,
  system_notifications BOOLEAN NOT NULL DEFAULT true,
  rewards_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى ويعدّل تفضيلاته
CREATE POLICY "Users can view own preferences"
  ON public.user_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.user_notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.user_notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- المدير يدير تفضيلات الجميع
CREATE POLICY "Manager can manage all preferences"
  ON public.user_notification_preferences FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Trigger لتحديث updated_at
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- إدراج قوالب افتراضية
INSERT INTO public.notification_templates (code, title, body, default_channels, category) VALUES
  ('STUDENT_ABSENT', 'غياب طالب', 'الطالب {studentName} غائب بتاريخ {date}', ARRAY['inApp', 'whatsapp'], 'attendance'),
  ('STUDENT_LATE', 'تأخر طالب', 'الطالب {studentName} تأخر بتاريخ {date}', ARRAY['inApp'], 'attendance'),
  ('NEW_RECITATION', 'تسجيل تسميع جديد', 'تم تسجيل تسميع للطالب {studentName} - الدرجة: {grade}', ARRAY['inApp'], 'academic'),
  ('LEVEL_UP', 'اجتياز مستوى', 'الطالب {studentName} اجتاز المستوى بنجاح', ARRAY['inApp', 'whatsapp'], 'academic'),
  ('NEW_NARRATION', 'جلسة سرد جديدة', 'تم تسجيل نتيجة سرد للطالب {studentName} - الدرجة: {grade}', ARRAY['inApp'], 'academic'),
  ('NARRATION_PASSED', 'نجاح في السرد', 'الطالب {studentName} نجح في جلسة السرد بدرجة {grade}', ARRAY['inApp', 'whatsapp'], 'academic'),
  ('BADGE_EARNED', 'شارة جديدة', 'الطالب {studentName} حصل على شارة: {badgeName}', ARRAY['inApp'], 'rewards'),
  ('REWARD_NOMINATION', 'ترشيح لمكافأة', 'تم ترشيح الطالب {studentName} لمكافأة: {rewardName}', ARRAY['inApp'], 'rewards'),
  ('NEW_INSTRUCTION', 'توجيه جديد', 'لديك توجيه جديد: {title}', ARRAY['inApp', 'email'], 'system'),
  ('PERMISSION_CHANGED', 'تغيير صلاحيات', 'تم تعديل صلاحياتك في النظام', ARRAY['inApp'], 'system'),
  ('STAFF_ATTENDANCE', 'تسجيل حضور موظف', 'تم تسجيل حضورك بتاريخ {date}', ARRAY['inApp'], 'attendance'),
  ('MADARIJ_PROGRESS', 'تقدم في مدارج', 'الطالب {studentName} أحرز تقدماً في مدارج', ARRAY['inApp'], 'academic'),
  ('ENROLLMENT_STATUS', 'تحديث طلب تسجيل', 'تم تحديث حالة طلب التسجيل للطالب {studentName}', ARRAY['inApp', 'whatsapp'], 'system');
