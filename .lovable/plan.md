

# نظام يوم السرد القرآني المتكامل

## نظرة عامة

بناء نظام متقدم للسرد القرآني يدعم نوعين من السرد (منتظم ومتعدد) مع حسابات دقيقة للاحزاب والاوجه، وتقارير وشهادات، مع الحفاظ الكامل على الجداول والموديولات الحالية.

---

## المرحلة الاولى: تعديل قاعدة البيانات

### جداول جديدة

**1. جدول `narration_attempts` (محاولة سرد لطالب)**

| العمود | النوع | الوصف |
|--------|-------|-------|
| id | uuid PK | المعرف |
| session_id | uuid FK | مرجع للجلسة |
| student_id | uuid FK | مرجع للطالب |
| narration_type | text | `regular` او `multi` |
| total_hizb_count | numeric | مجموع الاحزاب الكلي |
| total_pages_approx | numeric | مجموع الاوجه التقريبي (= total_hizb_count * 10) |
| mistakes_count | integer | عدد الاخطاء |
| lahn_count | integer | عدد اللحون |
| warnings_count | integer | عدد التنبيهات |
| grade | numeric | الدرجة النهائية |
| status | text | `pass` / `fail` / `absent` / `pending` |
| manual_entry | boolean | ادخال يدوي (بدون حساب آلي) |
| notes | text | ملاحظات |
| created_at, updated_at | timestamp | توقيتات |

- قيد تفرد: `UNIQUE(session_id, student_id)`

**2. جدول `narration_ranges` (نطاقات الاحزاب)**

| العمود | النوع | الوصف |
|--------|-------|-------|
| id | uuid PK | المعرف |
| attempt_id | uuid FK | مرجع لمحاولة السرد |
| section | text | `regular` / `first_third` / `second_third` / `third_third` |
| from_hizb | integer | بداية الحزب |
| to_hizb | integer | نهاية الحزب |
| hizb_count | integer | عدد الاحزاب في هذا النطاق (محسوب) |
| created_at | timestamp | التوقيت |

- تحقق: `from_hizb <= to_hizb`
- تحقق حدود الاثلاث: الثلث الاول 1-20، الثاني 21-40، الثالث 41-60

**3. تعديل جدول `narration_settings` (اضافة اعمدات)**

| العمود الجديد | النوع | الافتراضي | الوصف |
|--------------|-------|-----------|-------|
| pages_per_hizb | integer | 10 | عدد الاوجه لكل حزب |
| min_hizb_required | integer | 1 | الحد الادنى للاحزاب |
| min_pages_required | integer | 10 | الحد الادنى للاوجه |
| memorization_weight | numeric | 0.5 | وزن درجة الحفظ |
| mastery_weight | numeric | 0.3 | وزن درجة الاتقان |
| performance_weight | numeric | 0.2 | وزن درجة الاداء |

### سياسات RLS

- نفس سياسات `narration_results` الحالية تُطبق على الجداول الجديدة (المدير كامل، المعلم لحلقاته، الموظفون قراءة فقط).

### الجداول الحالية

- `narration_sessions` و `narration_results` و `narration_settings` تبقى كما هي بدون اي حذف. الجدول القديم `narration_results` يظل للتوافق مع البيانات السابقة، والنظام الجديد يستخدم `narration_attempts` + `narration_ranges`.

---

## المرحلة الثانية: منطق التحقق والحسابات

### شروط دخول السرد
- مجموع الاحزاب الكلي >= 1 حزب **او** مجموع الاوجه >= 10
- اذا كان الطالب يحفظ جزءا و3 ارباع (اي 3.5 احزاب): يدخل على حزبين فقط كحد اقصى

### السرد المنتظم
- ادخال `fromHizb` و `toHizb`
- الحساب: `hizbCount = toHizb - fromHizb + 1`
- الاوجه: `hizbCount * pagesPerHizb`
- التحقق: `fromHizb <= toHizb`، والمجموع يحقق الحد الادنى

### السرد المتعدد
- 3 اقسام (اثلاث): الاول 1-20، الثاني 21-40، الثالث 41-60
- لكل قسم: عدة نطاقات (fromHizb - toHizb)
- التحقق لكل نطاق:
  - `fromHizb <= toHizb`
  - النطاق ضمن حدود الثلث
  - عدم تداخل النطاقات داخل نفس الثلث
  - عدم تكرار نفس الحزب
- الحساب: مجموع `hizbCount` لكل النطاقات عبر كل الاثلاث

### دالة التحقق من التداخل (client-side)
```text
لكل نطاقين في نفس الثلث:
  اذا (rangeA.from <= rangeB.to) و (rangeB.from <= rangeA.to)
    => تداخل => رفض
```

---

## المرحلة الثالثة: الملفات والمكونات

### ملفات جديدة

| الملف | الوصف |
|-------|-------|
| `src/components/narration/RegularNarrationForm.tsx` | نموذج السرد المنتظم (fromHizb, toHizb + حسابات) |
| `src/components/narration/MultiNarrationForm.tsx` | نموذج السرد المتعدد (3 اثلاث + نطاقات متعددة + حسابات) |
| `src/components/narration/NarrationTypeSelector.tsx` | اختيار نوع السرد (regular / multi) |
| `src/components/narration/NarrationAttemptDialog.tsx` | Dialog الادخال الكامل لمحاولة سرد طالب |
| `src/components/narration/NarrationValidation.ts` | دوال التحقق والحسابات المشتركة |
| `src/pages/NarrationReports.tsx` | صفحة تقارير السرد (على مستوى الحلقة والمجمع) |
| `src/components/narration/NarrationCertificate.tsx` | قالب شهادة قابل للطباعة |

### ملفات معدلة

| الملف | التعديل |
|-------|---------|
| `src/pages/NarrationSession.tsx` | استخدام الجداول الجديدة + اضافة زر ادخال مع Dialog نوع السرد |
| `src/pages/QuranNarration.tsx` | اضافة تبويب "التقارير" + تحديث الاحصائيات لتشمل مجموع الاحزاب الحقيقي |
| `src/components/NarrationPrintTemplate.tsx` | تحديث لعرض نوع السرد ونطاقات الاحزاب |
| `src/App.tsx` | اضافة route للتقارير `/quran-narration/reports` |
| `src/integrations/supabase/types.ts` | يتحدث تلقائيا بعد الـ migration |

---

## المرحلة الرابعة: واجهة ادخال نتائج الطالب

### التدفق الجديد في NarrationSession

1. المستخدم يضغط على اسم الطالب في الجدول (او زر "ادخال النتيجة")
2. يفتح `NarrationAttemptDialog` ويحتوي على:
   - **اختيار نوع السرد** (RadioGroup): منتظم / متعدد
   - **نموذج السرد** حسب النوع المختار:
     - منتظم: حقلان (من حزب - الى حزب) + عرض تلقائي للمجموع والاوجه
     - متعدد: 3 اقسام كل قسم يحتوي على زر "اضافة نطاق" مع حقلين لكل نطاق
   - **ملخص الحسابات**: مجموع الاحزاب + الاوجه + رسالة تحقق
   - **حقول التقييم**: اخطاء، لحون، تنبيهات
   - **الدرجة**: محسوبة تلقائيا مع خيار الادخال اليدوي (manual_entry)
   - **الحالة**: تتحدد تلقائيا (ناجح/راسب) بناء على الدرجة والحد الادنى
   - **ملاحظات**
3. عند الحفظ:
   - التحقق من شروط الدخول
   - التحقق من عدم تداخل النطاقات
   - حفظ في `narration_attempts` + `narration_ranges`

### الجدول الرئيسي (ملخص)

يعرض جدول مختصر للطلاب يحتوي على:
- اسم الطالب
- نوع السرد (منتظم/متعدد)
- مجموع الاحزاب
- الاوجه
- الاخطاء + اللحون + التنبيهات
- الدرجة
- الحالة
- زر تعديل + زر حذف

---

## المرحلة الخامسة: التقارير

### صفحة تقارير الحلقة
- عدد احزاب النجاح والرسوب
- النسبة الكلية لكل طالب
- ترتيب الطلاب داخل الحلقة حسب الدرجة
- مجموع الاحزاب الكلية المسرودة

### صفحة تقارير المجمع
- نفس المؤشرات على مستوى المجمع
- ترتيب الحلقات حسب الاداء (متوسط الدرجات، نسبة الاجتياز)
- النسبة العامة ومجموع الاحزاب الكلية

---

## المرحلة السادسة: الشهادات

قالب `NarrationCertificate.tsx` قابل للطباعة (A4) يحتوي على:
- شعار المجمع
- اسم الطالب والحلقة
- عدد الاحزاب المسرودة
- الدرجة والحالة (ناجح/راسب)
- الترتيب داخل الحلقة
- الترتيب داخل المجمع
- تاريخ السرد
- مكان للتوقيعات

---

## المرحلة السابعة: اعدادات الدرجات المحدثة

اضافة قسم في تبويب "الاعدادات" في QuranNarration:
- الحد الادنى للنجاح (min_grade)
- الحد الاعلى للدرجة (max_grade)
- خصم لكل خطأ / لحن / تنبيه
- اوزان التقسيم (حفظ، اتقان، اداء)
- عدد الاوجه لكل حزب
- الحد الادنى للاحزاب / الاوجه للدخول

---

## ترتيب التنفيذ

1. Migration لانشاء الجداول الجديدة + تعديل الاعدادات + سياسات RLS
2. ملف `NarrationValidation.ts` (دوال الحسابات والتحقق)
3. مكونات النماذج (`RegularNarrationForm`, `MultiNarrationForm`, `NarrationTypeSelector`)
4. `NarrationAttemptDialog` (الجامع لكل ما سبق)
5. تحديث `NarrationSession.tsx` لاستخدام النظام الجديد
6. `NarrationReports.tsx` + تحديث `QuranNarration.tsx` بتبويب التقارير
7. `NarrationCertificate.tsx` + قالب الطباعة
8. تحديث `App.tsx` بالمسارات الجديدة
9. تحديث `NarrationPrintTemplate.tsx`

## ما لن يتغير

- جدول `narration_sessions` يبقى كما هو
- جدول `narration_results` يبقى كما هو (للتوافق الخلفي)
- جدول `narration_settings` يبقى مع اضافة اعمدة جديدة فقط
- جميع الموديولات الاخرى (الحضور، التسميع، مدارج...) لا تتأثر اطلاقا

