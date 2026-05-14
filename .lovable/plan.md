## خطة تطوير بوابة ولي الأمر

إضافة 8 مهام جديدة على بوابة ولي الأمر بشكل تدريجي ومتكامل مع النظام الحالي.

### المرحلة 1 — إضافات بدون تغييرات قاعدة بيانات (سريعة)

1. **مركز الإشعارات داخل البوابة**
   - زر جرس في `GuardianLayout` يعرض إشعارات ولي الأمر (غياب، إنذار، رحلة، شارة جديدة)
   - يستفيد من جدول `notifications` الموجود (filter على guardian user_id)
   - Realtime subscription لظهور فوري

2. **تقرير الحضور الشهري القابل للطباعة**
   - تبويب جديد "تقرير شهري" في `GuardianChildProfile`
   - شبكة شهرية (هجري/ميلادي) مع رموز الحالات
   - زر طباعة وزر تصدير PDF (بنفس نمط `StudentAttendanceReport`)

3. **المستحقات المالية وسجل المدفوعات**
   - تبويب "المالية" يعرض من جدول `student_finances` / `financial_transactions` الموجود
   - الرسوم المستحقة والمدفوعة والمتبقية
   - قائمة الإيصالات مع تواريخ

4. **متابعة الباص**
   - تبويب "الباص" يعرض اسم الباص ورقم السائق ومسار الذهاب/العودة من جدول `buses` و`bus_students`
   - حالة الباص الحالية إن توفرت

5. **إعدادات الحساب**
   - صفحة `/guardian/settings` لتحديث الاسم والجوال وتغيير كلمة المرور
   - زر تسجيل الخروج موجود مسبقاً

### المرحلة 2 — تحتاج جداول جديدة

6. **التواصل مع المعلم/الإدارة**
   - جدول `guardian_messages` (sender_id, recipient_role, student_id, subject, body, status, replied_at)
   - صفحة `/guardian/messages` صندوق وارد + إرسال جديد
   - شاشة مقابلة في لوحة الإدارة لمتابعة الرسائل والرد

7. **الاستئذان المسبق**
   - جدول `student_excuse_requests` (student_id, guardian_id, date_from, date_to, reason, status: pending/approved/rejected, reviewed_by)
   - عند الموافقة → تسجيل تلقائي كـ `excused` في جدول `attendance` للأيام المحددة
   - شاشة موافقة في الإدارة

8. **تقييم المعلم**
   - جدول `teacher_evaluations` (guardian_id, teacher_id, student_id, term, ratings JSONB, comment, created_at)
   - استبيان دوري (5 محاور: التعامل، الأداء، التواصل، الالتزام، التطوير) من 1-5
   - تقرير مجمع للإدارة فقط (سرّية المقيّم)

### Technical Details

**ملفات جديدة (مرحلة 1):**
- `src/components/GuardianNotificationBell.tsx`
- `src/pages/guardian/GuardianAttendanceReport.tsx` (أو tab داخل الملف الشخصي)
- `src/pages/guardian/GuardianFinance.tsx`
- `src/pages/guardian/GuardianBus.tsx`
- `src/pages/guardian/GuardianSettings.tsx`
- إضافة روابط في `GuardianLayout` (قائمة منسدلة موسعة)

**ملفات جديدة (مرحلة 2):**
- `src/pages/guardian/GuardianMessages.tsx` + `src/pages/admin/GuardianMessagesAdmin.tsx`
- `src/pages/guardian/GuardianExcuses.tsx` + شاشة موافقة في الإدارة
- `src/pages/guardian/GuardianEvaluation.tsx` + تقرير في `KpiDashboard` أو صفحة منفصلة

**Migrations مطلوبة (مرحلة 2):**
- `guardian_messages` + RLS (ولي الأمر يرى/يرسل رسائله فقط، الإدارة ترى الكل)
- `student_excuse_requests` + RLS + trigger يدخل في `attendance` عند الموافقة
- `teacher_evaluations` + RLS (المُقيّم يكتب فقط، الإدارة فقط تقرأ التجميع)

**التنقل:**
توسيع القائمة المنسدلة في `GuardianLayout` لتشمل: الرئيسية، الرسائل، الاستئذان، التقييم، الإعدادات، تسجيل الخروج.

### تسلسل التنفيذ المقترح
أبدأ بالمرحلة 1 كاملة (لا تتطلب موافقة على migrations)، ثم أنتقل للمرحلة 2 جدول بجدول.
