INSERT INTO public.notification_templates (code, title, body, default_channels, category)
VALUES
  ('general_notification', '{title}', '{body}', ARRAY['inApp'], 'system'),
  ('general', '{title}', '{body}', ARRAY['inApp'], 'system'),
  ('NEW_REQUEST', 'طلب جديد: {requestType}', '{senderName} أرسل طلباً: {title}', ARRAY['inApp'], 'system'),
  ('REQUEST_REPLY', 'رد على طلبك', '{senderName} ردّ على طلبك: {title}', ARRAY['inApp'], 'system'),
  ('REQUEST_STATUS', 'تحديث طلب', 'تم تحديث حالة طلبك «{title}» إلى: {status}', ARRAY['inApp'], 'system'),
  ('NEW_TASK', 'مهمة جديدة: {title}', 'تم إسناد مهمة إليك: {title} — الأولوية: {priority}', ARRAY['inApp'], 'system'),
  ('TASK_DUE', 'تذكير مهمة: {title}', 'موعد تسليم مهمتك «{title}» اقترب', ARRAY['inApp'], 'system'),
  ('TASK_COMPLETED', 'مهمة مكتملة: {title}', 'أكمل {staffName} المهمة: {title}', ARRAY['inApp'], 'system'),
  ('STUDENT_QUIZ_RESULT', 'نتيجة اختبار', 'الطالب {studentName} حصل على {score} في الاختبار', ARRAY['inApp'], 'academic'),
  ('excellence_enrollment', 'تسجيل في التميز', 'تم تسجيل الطالب {studentName} في مسار التميز', ARRAY['inApp'], 'academic'),
  ('ABSENCE_WARNING', 'إنذار غياب', 'الطالب {studentName} لديه إنذار غياب رقم {level}', ARRAY['inApp', 'whatsapp'], 'attendance'),
  ('TASK_REMINDER', 'تذكير: {title}', 'تذكير بمهمتك: {title} — تستحق في {dueDate}', ARRAY['inApp'], 'system')
ON CONFLICT (code) DO NOTHING;