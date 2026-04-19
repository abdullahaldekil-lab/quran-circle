
The user uploaded a CSV showing the current paper-based system used at the complex (مجمع) for narration/review tests. Let me analyze its structure:

**Structure observed:**
- Halaqa name (الحلقة): أبي سعيد الخدري
- Student selected (الطالب): مالك الفريدي
- Two test types: اختبار (Test) and المراجعة (Review)
- 5 segments/sections (مقاطع 1-5) — student scores per segment
- Total (المجموع): 87
- Date: Gregorian (ميلادي) + Hijri (هجري)
- Right column: full student roster of the halaqa (~26 students)

**Key insight:** Their current paper system uses a **5-segment scoring model** for both اختبار السرد and اختبار المراجعة, where each segment gets a score and they sum to a total. This is DIFFERENT from our current `NarrationTest.tsx` which uses errors×5 + warnings×1 deducted from 50.

I already explored `NarrationTest.tsx` (uses errors/warnings model). Now I need a plan to add the **5-segment scoring** model alongside, without affecting the existing module.

Approach: Add a new "اختبار المراجعة" page (`/review-test`) that mirrors the CSV layout exactly — halaqa selector, full student roster on the side, 5-segment score entry, dual-date stamping, persisted to existing `narration_test_results` table using a `test_type='review'` discriminator + `sections` JSONB field. This keeps the current narration test untouched.

<lov-plan>

## الخطة: بناء وحدة "اختبار المراجعة" بنظام المقاطع الخمسة

### الفكرة العامة
إضافة صفحة جديدة `/review-test` مطابقة تماماً لتصميم الجدول الورقي الحالي في المجمع (5 مقاطع لكل طالب)، **بدون أي تعديل** على وحدة `NarrationTest` الحالية أو أي موديول آخر.

### المكونات

**1. صفحة جديدة: `src/pages/ReviewTest.tsx`**
- اختيار الحلقة (Dropdown)
- عرض كامل قائمة طلاب الحلقة على الجانب (مثل العمود الأيمن في CSV)
- جدول إدخال يحتوي لكل طالب:
  - الاسم
  - عرض المرة (الأولى/الثانية/الثالثة) — تلقائي مع تعديل يدوي
  - 5 خانات للمقاطع (مقطع 1، 2، 3، 4، 5)
  - **المجموع التلقائي** = مجموع المقاطع الخمسة
  - النتيجة: ناجح (≥60) / راسب — مع لون (أخضر/برتقالي/أحمر حسب المحاولة)
- تذييل بالتاريخ المزدوج (هجري + ميلادي) كما في النموذج الورقي

**2. الحفظ والتوثيق**
- استخدام جدول `narration_test_results` الموجود مع:
  - `test_type = 'review'` (مميّز عن `narration`)
  - `sections` (JSONB جديد) لتخزين درجات المقاطع: `{seg1, seg2, seg3, seg4, seg5}`
  - `total_score` = مجموع المقاطع
  - `passed` = (total ≥ 60)
  - `attempt_number` تلقائي
- إذا كانت `sections` غير موجودة → migration بسيط لإضافتها (آمن وغير مدمر)

**3. التصدير والطباعة**
- زر **طباعة** بنفس تنسيق الجدول الورقي الحالي
- تصدير **Excel** و **PDF**
- زر **حفظ النتائج** في قاعدة البيانات

**4. تكامل مع الملف الشخصي للطالب**
- النتائج تظهر تلقائياً في تبويب "الاختبارات" بملف الطالب وبوابة ولي الأمر (موجود مسبقاً عبر `narration_test_results`)
- لا حاجة لأي تعديل في الموديولات الأخرى

**5. تبويب "السجل السابق"**
- داخل نفس الصفحة: تبويب يعرض تاريخ اختبارات المراجعة لكل حلقة مع إمكانية الفلترة بالتاريخ والطالب

### الملفات

| ملف | إجراء |
|---|---|
| `src/pages/ReviewTest.tsx` | **جديد** |
| `src/App.tsx` | إضافة Route `/review-test` فقط |
| `src/components/AppLayout.tsx` | إضافة رابط في القائمة الجانبية |
| Migration | إضافة عمود `sections JSONB` إلى `narration_test_results` (إن لم يكن موجوداً) |

### الضمانات
- ✅ لا مساس بـ `NarrationTest.tsx` ولا بأي وحدة قائمة
- ✅ نفس قاعدة البيانات (لا تكرار) — تمييز عبر `test_type`
- ✅ نتائج موثقة وقابلة للوصول من ملف الطالب وبوابة ولي الأمر
- ✅ مطابق 100% للجدول الورقي المستخدم حالياً في المجمع

