

# خطة إعادة هيكلة موديول "مسار التميّز" — مسارات متعددة وربط بالطالب مباشرة

## ملخص

إعادة بناء موديول التميّز ليدعم مسارات متعددة قابلة للتعديل، مع ربط الطلاب بالمسارات عبر هويتهم (وليس الحلقة)، وإضافة إعدادات لكل مسار، وإشعارات لولي الأمر، وتقارير تفصيلية.

---

## التفاصيل التقنية

### 1. قاعدة البيانات (3 جداول جديدة)

**لا يتم حذف أي جدول قائم.** الجداول الجديدة تعمل بالتوازي مع الجداول الحالية.

```sql
-- 1) مسارات التميّز
CREATE TABLE public.excellence_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) الطلاب المميزون
CREATE TABLE public.distinguished_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.excellence_tracks(id) ON DELETE CASCADE,
  is_star BOOLEAN NOT NULL DEFAULT true,
  added_by UUID,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(student_id, track_id)
);

-- 3) إعدادات المسار
CREATE TABLE public.excellence_track_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.excellence_tracks(id) ON DELETE CASCADE UNIQUE,
  min_monthly_performance NUMERIC DEFAULT 0,
  min_attendance_rate NUMERIC DEFAULT 0,
  min_hizb_count NUMERIC DEFAULT 0,
  auto_remove_on_failure BOOLEAN DEFAULT false,
  auto_notify_parent BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS:**
- SELECT → `get_staff_role(auth.uid()) IS NOT NULL`
- ALL → manager
- INSERT/UPDATE على `distinguished_students` → teacher, assistant_teacher, manager

**Triggers:** `updated_at` على الجداول الثلاثة.

### 2. تعديل جدول `excellence_elite_students` القائم

لن يُحذف. سيبقى للتوافق مع جلسات التميّز الأسبوعية الحالية. النظام الجديد يعمل بالتوازي.

### 3. تعديل صفحة الطلاب (`Students.tsx`)

**التعديل على النجمة الحالية:**
- عند الضغط على النجمة → يظهر Dialog لاختيار المسار من `excellence_tracks`
- إذا كان الطالب مسجلاً مسبقاً → تظهر رسالة "هذا الطالب مسجل مسبقًا في مسار التميّز"
- عند إزالة النجمة → يُحذف من `distinguished_students`
- الشارة تعرض اسم المسار بدلاً من "تميّز" فقط

### 4. الصفحات الجديدة

#### أ) `src/pages/ExcellenceTracks.tsx` — إدارة المسارات
- عرض قائمة المسارات مع حالة التفعيل
- Dialog لإضافة/تعديل مسار (الاسم، الوصف، المعايير JSON)
- زر تفعيل/تعطيل
- عدد الطلاب في كل مسار
- الوصول: المدير فقط

#### ب) `src/pages/DistinguishedStudents.tsx` — الطلاب المميزون
- عرض قائمة الطلاب المميزين مع فلتر حسب المسار
- بحث بالاسم
- إضافة طالب (بحث من كل الطلاب، اختيار مسار)
- نقل طالب لمسار آخر
- إزالة طالب
- إظهار تاريخ الانضمام والمسار الحالي
- الوصول: المدير والمعلم

#### ج) `src/pages/ExcellenceTrackSettings.tsx` — إعدادات المسار
- اختيار مسار → عرض/تعديل الإعدادات
- الحد الأدنى للأداء الشهري
- الحد الأدنى لنسبة الحضور
- الحد الأدنى لعدد الأحزاب
- تفعيل الإزالة التلقائية عند الإخفاق
- تفعيل إشعارات ولي الأمر
- الوصول: المدير فقط

#### د) تعديل `src/pages/ExcellenceReports.tsx` — إضافة تبويبين
- **تقرير المسار:** اختيار مسار → عدد الطلاب، أفضل الطلاب، متوسط الأداء، نسبة الالتزام
- **تقرير الطالب المميز:** اختيار طالب → تاريخ الانضمام، المؤشرات الشهرية/الفصلية/السنوية (من بيانات `excellence_performance` المرتبطة)

### 5. المسارات (Routing)

| المسار | الصفحة |
|--------|--------|
| `/excellence/tracks` | ExcellenceTracks |
| `/excellence/distinguished` | DistinguishedStudents |
| `/excellence/track-settings` | ExcellenceTrackSettings |

تُضاف في `App.tsx` مع حماية بالصلاحيات.

### 6. التنقل (`AppLayout.tsx`)

إضافة روابط فرعية تحت "مسار التميّز":
- إدارة المسارات
- الطلاب المميزون
- إعدادات المسارات

### 7. الصلاحيات (`useRole.tsx`)

المسارات الجديدة تندرج تحت `/excellence` الموجود أصلاً، فلا تعديل مطلوب.

### 8. الربط مع الجلسات الأسبوعية

في `ExcellenceSession.tsx`:
- عند فتح جلسة، يتم جلب الطلاب من `distinguished_students` (بالإضافة للمصدر الحالي `excellence_elite_students`)
- إذا وُجد طلاب في `distinguished_students` للمسار النشط → يُستخدمون
- يتم تحديث مؤشراتهم الشهرية والفصلية من بيانات الأداء

### 9. الإشعارات

عند إضافة طالب لمسار تميّز (وكان `auto_notify_parent = true`):
- استدعاء `sendNotification` بقالب `excellence_enrollment`
- المستلم: ولي أمر الطالب (عبر `guardian_students`)

عند إزالة طالب:
- إشعار تنبيه لولي الأمر

### 10. ملخص الملفات

| الملف | النوع |
|-------|-------|
| Migration SQL (3 جداول + RLS) | جديد |
| `src/pages/ExcellenceTracks.tsx` | جديد |
| `src/pages/DistinguishedStudents.tsx` | جديد |
| `src/pages/ExcellenceTrackSettings.tsx` | جديد |
| `src/pages/Students.tsx` | تعديل (النجمة → اختيار مسار) |
| `src/pages/Excellence.tsx` | تعديل (إضافة روابط للصفحات الجديدة) |
| `src/pages/ExcellenceReports.tsx` | تعديل (تبويبان جديدان) |
| `src/pages/ExcellenceSession.tsx` | تعديل (جلب من distinguished_students) |
| `src/App.tsx` | تعديل (3 مسارات جديدة) |
| `src/components/AppLayout.tsx` | تعديل (روابط فرعية) |

### 11. ما لن يتغير
- لا حذف لأي جدول قائم
- لا تعديل على الموديولات الأخرى (مدارج، سرد، تسميع...)
- الجداول القائمة (`excellence_sessions`, `excellence_performance`, `excellence_elite_students`, `excellence_settings`) تبقى كما هي

