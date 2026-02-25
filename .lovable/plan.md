

# خطة موديول "مسار التميّز"

## ملخص

إضافة موديول متكامل لإدارة جلسات التميّز الأسبوعية (الثلاثاء بعد العشاء) يشمل: التحضير، تسجيل الأداء، الترتيب التلقائي، والتقارير الشهرية مع الطباعة.

---

## التفاصيل التقنية

### 1. قاعدة البيانات (Migration)

**4 جداول جديدة:**

```sql
-- 1) جلسات التميّز
CREATE TABLE public.excellence_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  halaqa_id UUID REFERENCES public.halaqat(id),
  created_by UUID,
  total_hizb_in_session NUMERIC DEFAULT 0,
  total_pages_displayed NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) تحضير نخبة الطلاب
CREATE TABLE public.excellence_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.excellence_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  is_present BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) أداء الطالب في الجلسة
CREATE TABLE public.excellence_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.excellence_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  pages_displayed NUMERIC DEFAULT 0,
  hizb_count NUMERIC DEFAULT 0,
  mistakes_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  lahon_count INTEGER DEFAULT 0,
  total_score NUMERIC DEFAULT 0,
  rank_in_group INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) التقرير الشهري
CREATE TABLE public.excellence_monthly_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  student_id UUID NOT NULL,
  halaqa_id UUID REFERENCES public.halaqat(id),
  total_attendance INTEGER DEFAULT 0,
  total_pages NUMERIC DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_hizb NUMERIC DEFAULT 0,
  average_score NUMERIC DEFAULT 0,
  final_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year, student_id)
);
```

**RLS Policies (لكل جدول):**
- `SELECT` → أي staff (`get_staff_role(auth.uid()) IS NOT NULL`)
- `ALL` → manager
- `INSERT/UPDATE` → teacher, assistant_teacher (للجلسات والتحضير والأداء)

**Realtime:** تفعيل `excellence_sessions` للتحديث الفوري.

### 2. المسارات والصلاحيات

**إضافة مسار `/excellence` في:**

| الملف | التعديل |
|-------|---------|
| `src/hooks/useRole.tsx` | إضافة `/excellence` لأدوار: manager, supervisor, assistant_supervisor, teacher |
| `src/App.tsx` | إضافة 3 مسارات: `/excellence`, `/excellence/:sessionId`, `/excellence/reports` |
| `src/components/AppLayout.tsx` | إضافة رابط "مسار التميّز" في مجموعة "الشؤون الأكاديمية" |

### 3. الصفحات الجديدة

#### أ) `src/pages/Excellence.tsx` — الصفحة الرئيسية
- عرض قائمة الجلسات السابقة
- زر "إنشاء جلسة جديدة" (التاريخ الافتراضي = أقرب ثلاثاء)
- اختيار الحلقة (المعلم يرى حلقته فقط)
- إحصائيات سريعة

#### ب) `src/pages/ExcellenceSession.tsx` — صفحة الجلسة الواحدة
تتضمن 3 تبويبات (Tabs):

**تبويب التحضير:**
- قائمة طلاب الحلقة مع checkbox (حاضر/غائب)
- حقل ملاحظات لكل طالب

**تبويب الأداء:**
- جدول لكل طالب حاضر يحتوي:
  - عدد الأوجه المعروضة
  - عدد الأحزاب
  - الأخطاء / اللحون / التنبيهات
  - الدرجة (تحسب تلقائيًا)
  - الترتيب (يحسب تلقائيًا عند الحفظ)
- معادلة الدرجة الافتراضية: `100 - (mistakes × 2) - (lahon × 1) - (warnings × 0.5)`
- الترتيب: بالدرجة أولاً → عدد الأحزاب → عدد الأوجه
- حفظ يحدّث `total_hizb_in_session` و `total_pages_displayed` في الجلسة

**تبويب ملخص الجلسة:**
- عدد الحاضرين
- إجمالي الأوجه والأحزاب
- ترتيب الطلاب
- زر طباعة

#### ج) `src/pages/ExcellenceReports.tsx` — التقارير
4 أقسام:

1. **تقرير الجلسة:** اختيار جلسة → عرض التفاصيل
2. **تقرير الحلقة:** اختيار حلقة → أفضل الطلاب، متوسط الأداء، نسبة الحضور
3. **تقرير المجمع:** مقارنة بين الحلقات، أفضل 10 طلاب
4. **التقرير الشهري:** اختيار شهر/سنة → حساب وعرض التقرير الشهري مع إمكانية حفظه في `excellence_monthly_report`

- زر طباعة لكل قسم

### 4. مكون الطباعة

`src/components/ExcellencePrintTemplate.tsx`

يعرض تقرير مطبوع يحتوي على: اسم الطالب، الحلقة، عدد الأوجه، عدد الأحزاب، الأخطاء، اللحون، التنبيهات، الدرجة، الترتيب. نفس نمط `NarrationPrintTemplate.tsx`.

### 5. منطق الحسابات (في الواجهة)

```text
الدرجة = 100 - (أخطاء × 2) - (لحون × 1) - (تنبيهات × 0.5)
         الحد الأدنى = 0

الترتيب:
  1. أعلى درجة
  2. أكثر أحزاب (عند التعادل)
  3. أكثر أوجه (عند التعادل)

التقرير الشهري:
  مجموع الحضور = COUNT(is_present = true)
  مجموع الأوجه = SUM(pages_displayed)
  مجموع الأحزاب = SUM(hizb_count)
  متوسط الدرجة = AVG(total_score)
  الترتيب النهائي = حسب متوسط الدرجة
```

### 6. الملفات الجديدة والمعدّلة

| الملف | النوع |
|-------|-------|
| Migration SQL | جديد |
| `src/pages/Excellence.tsx` | جديد |
| `src/pages/ExcellenceSession.tsx` | جديد |
| `src/pages/ExcellenceReports.tsx` | جديد |
| `src/components/ExcellencePrintTemplate.tsx` | جديد |
| `src/App.tsx` | تعديل (إضافة 3 مسارات) |
| `src/components/AppLayout.tsx` | تعديل (إضافة رابط في القائمة) |
| `src/hooks/useRole.tsx` | تعديل (إضافة `/excellence` للأدوار) |

### 7. ما لن يتغير

- لا حذف لأي جدول أو عمود موجود
- لا تعديل على الموديولات القائمة (مدارج، سرد، تسميع...)
- لا تغيير في RLS الحالية

