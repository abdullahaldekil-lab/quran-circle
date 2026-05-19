
## الهدف
تعديلات على برنامج مدارج (الحفظ)، نموذج التسميع، واختبار السرد لتبسيط الإدخال وحل عدة مشاكل وظيفية.

---

## 1) إظهار الخطة السنوية في برنامج مدارج
المشكلة: عند إنشاء "خطة سنوية" تُحفظ في `student_annual_plans` لكنها لا تظهر في صفحة `Madarij` (التي تعرض `madarij_enrollments` فقط).

الحل في `src/pages/Madarij.tsx`:
- إضافة قسم/تبويب جديد "الخطط السنوية النشطة" يجلب من `student_annual_plans` (status=active) ويعرض: الطالب، الحلقة، نوع الخطة، تاريخ البداية والنهاية، المجموع المستهدف، نسبة الإنجاز (محسوبة من `student_plan_progress`).
- زر "عرض الخطة" يفتح `/student-annual-plan/:studentId`.
- ربط زر "إنشاء خطة سنوية" بتحديث القائمة بعد الحفظ (موجود `onSaved={fetchData}` — توسيع `fetchData` ليجلب الخطط أيضًا).

---

## 2) ربط تسجيل مدارج تلقائيًا بالخطة (إلغاء اختيار الجزء والحزب يدويًا)
المشكلة: تسجيل المدارج يتطلب تحديد الجزء والحزب يدويًا.

الحل في `src/pages/MadarijEnrollment.tsx`:
- عند اختيار الطالب والمسار: قراءة `student_annual_plans` النشطة للطالب → استخراج `previous_memorized_pages` لحساب الحزب/الجزء الحالي تلقائيًا (page → hizb via lookup).
- إذا لا يوجد خطة: العودة لآخر `madarij_enrollment` للطالب وأخذ آخر حزب +1.
- إخفاء حقلَي "الجزء" و"الحزب" من النموذج، وعرضهما كقيمة محسوبة فقط (read-only chip: "الحزب الحالي: X — الجزء Y") مع زر "تعديل يدوي" للمدير فقط عند الحاجة.

---

## 3) تعديلات نموذج التسميع `src/pages/Recitation.tsx`
- **إلغاء "جودة الحفظ"**: حذف `memorization_quality` من الحالة، النموذج (السلايدر سطر 320-324)، حساب الدرجة (سطر 94)، وحقل الإدراج (سطر 116).
- **إلغاء "التجويد"**: حذف `tajweed_score` بنفس الطريقة (سطر 376-378, 95, 117).
- **إعادة هيكلة فئات الأخطاء**: استبدال `{ jali, khafi, taraddod, nisyan }` بـ `{ error, lahn, warning }` (خطأ — لحن — تنبيه) في:
  - الحالة الافتراضية (سطر 41, 87)
  - مصفوفة الفئات المعروضة (سطر 339+)
  - تطبيقها على البطاقات الثلاث: الحفظ، المراجعة، الربط (نفس بنية الأخطاء لكل قسم).
- **حساب الدرجة الجديد**: مبني فقط على عدد الأخطاء/اللحن/التنبيهات (سنحدد معاملات الخصم في إعدادات التسميع — أو نستخدم نفس معاملات السرد: خطأ=2، لحن=1، تنبيه=0.5).
- **Migration على `recitations`**: إضافة عمود `mistakes_breakdown_v2` JSONB أو تحديث استخدام نفس `mistakes_breakdown` بمفاتيح جديدة (نتبع الثاني لتجنب كسر البيانات القديمة، مع دالة قراءة متوافقة).

> ملاحظة: سيتم الاحتفاظ بالأعمدة `memorization_quality` و`tajweed_score` في قاعدة البيانات (لا حذف) حفاظًا على البيانات التاريخية، مع تعطيلها في الواجهة فقط.

---

## 4) اختبار السرد — حل مشكلة عدم القدرة على إضافة اختبار ثانٍ بعد النجاح
المشكلة الحالية: زر "إعادة الاختبار" يظهر فقط للراسبين (سطر 643-647). الطالب الناجح يبقى في تبويب "النتائج" بدون أي طريقة لاختباره مجددًا على الحزب التالي.

الحل في `src/pages/NarrationTest.tsx`:
- **لكل طالب ناجح**: عرض زر "اختبار الحزب التالي" في قسم "الناجحون".
- **منطق الحزب التالي**: يُحدَّد تلقائيًا من `madarij_enrollments.hizb_number` النشط للطالب (الذي يحدّثه المعلم عند إنهاء الحفظ). إذا كان الحزب الحالي > آخر حزب مختبَر → الزر فعّال. إذا لم يتقدم بعد → الزر معطّل مع tooltip: "بانتظار تحديث المعلم لإنهاء حفظ الحزب التالي".
- عند الضغط: يضاف الطالب إلى `selectedIds` مع `currentHizb` المحدّث، وينتقل لتبويب "الاختبار".
- توسيع `categorized` لإعادة وضع الطالب في `notTested` تلقائيًا إذا تقدّم حزبه (currentHizb > آخر hizb مختبَر).

---

## 5) إضافة "لحن" إلى اختبار السرد
- إضافة عمود `lahn` (INTEGER DEFAULT 0) إلى `narration_test_results` عبر migration.
- تحديث `StudentRow` بإضافة `lahn` ، عمود في الجدول بين "الأخطاء" و"التنبيهات".
- تحديث `calcNarrationScore(errors, lahn, warnings)` ليأخذ في الحسبان: `score = 50 - errors*errDed - lahn*lahnDed - warnings*warnDed`.

---

## 6) إعدادات اختبارات السرد
صفحة جديدة `/narration-test-settings` (للمدير والمشرف):
- جدول جديد `narration_test_settings` (صف واحد):
  - `error_deduction` (default 2)
  - `lahn_deduction` (default 1)
  - `warning_deduction` (default 0.5)
  - `pass_threshold` (default 85)
  - `attendance_score` (default 50)
  - `narration_max` (default 50)
- نموذج بسيط لتحرير القيم.
- `NarrationTest.tsx` يقرأ هذه الإعدادات بدل الثوابت الحالية (`ERROR_DEDUCTION`, `WARNING_DEDUCTION`, `PASS_THRESHOLD`, `ATTENDANCE_SCORE`).
- إضافة الرابط في القائمة الجانبية ضمن "الاختبارات" أو "الإعدادات".

---

## التفاصيل التقنية

### Migrations المطلوبة
```sql
-- لحن في اختبار السرد
ALTER TABLE public.narration_test_results
  ADD COLUMN IF NOT EXISTS lahn INTEGER DEFAULT 0;

-- إعدادات اختبارات السرد
CREATE TABLE IF NOT EXISTS public.narration_test_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_deduction NUMERIC NOT NULL DEFAULT 2,
  lahn_deduction NUMERIC NOT NULL DEFAULT 1,
  warning_deduction NUMERIC NOT NULL DEFAULT 0.5,
  pass_threshold NUMERIC NOT NULL DEFAULT 85,
  attendance_score NUMERIC NOT NULL DEFAULT 50,
  narration_max NUMERIC NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.narration_test_settings ENABLE ROW LEVEL SECURITY;
-- سياسات: قراءة للجميع المصادقين، تعديل للمدير/المشرف فقط
INSERT INTO public.narration_test_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;
```

### الملفات المتأثرة
- `src/pages/Madarij.tsx` — إضافة قسم الخطط السنوية
- `src/pages/MadarijEnrollment.tsx` — إخفاء حقول الجزء/الحزب + جلب تلقائي
- `src/pages/Recitation.tsx` — إزالة جودة/تجويد + تعديل فئات الأخطاء
- `src/pages/NarrationTest.tsx` — إضافة لحن + زر "الحزب التالي" + قراءة الإعدادات
- `src/pages/NarrationTestSettings.tsx` — جديد
- `src/App.tsx` + `src/components/AppLayout.tsx` — إضافة الرابط
- Migrations جديدة

---

## أسئلة للتأكيد قبل التنفيذ
1. **معاملات خصم نموذج التسميع الجديد (خطأ/لحن/تنبيه)**: هل نستخدم نفس قيم السرد (2 / 1 / 0.5) أم قيم مختلفة؟
2. **بطاقات الأخطاء في التسميع**: هل تظهر فئات (خطأ/لحن/تنبيه) منفصلة لكل قسم (حفظ، مراجعة، ربط) — أي 9 عدادات إجمالًا — أم فئة موحدة لكل قسم؟
3. **شرط فتح اختبار الحزب التالي**: هل يكفي تقدّم حزب المدارج، أم تريد علامة صريحة من المعلم "أنهى الحفظ — جاهز للاختبار" تُحرّك زر التفعيل؟
