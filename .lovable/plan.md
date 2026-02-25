

## ملخص الخطة

تطبيق نظام ربط 1:1 بين المعلمين والحلقات، مع منطق تحقق يمنع التعارضات ورسائل خطأ واضحة.

---

## التفاصيل التقنية

### 1. تعديل قاعدة البيانات (Migration)

**إضافة عمود `assigned_halaqa_id` لجدول `profiles`:**

```sql
ALTER TABLE public.profiles 
ADD COLUMN assigned_halaqa_id UUID REFERENCES public.halaqat(id);

-- إضافة UNIQUE constraint على teacher_id في halaqat لضمان 1:1
CREATE UNIQUE INDEX unique_teacher_per_halaqa 
ON public.halaqat(teacher_id) 
WHERE teacher_id IS NOT NULL AND active = true;

-- إضافة UNIQUE constraint على assigned_halaqa_id في profiles
CREATE UNIQUE INDEX unique_halaqa_per_teacher 
ON public.profiles(assigned_halaqa_id) 
WHERE assigned_halaqa_id IS NOT NULL AND active = true;
```

هذا يضمن على مستوى قاعدة البيانات أن كل معلم مرتبط بحلقة واحدة فقط وكل حلقة بمعلم واحد فقط.

### 2. تعديل صفحة الحلقات (`src/pages/Halaqat.tsx`)

**تعديل قائمة المعلمين المتاحة:**
- عند إضافة حلقة جديدة: عرض فقط المعلمين غير المرتبطين بحلقات أخرى (تصفية بناءً على `assigned_halaqa_id IS NULL` أو المعلمين الذين ليس لهم حلقات نشطة)
- عند تعديل حلقة: عرض المعلم الحالي + المعلمين غير المرتبطين

**إضافة منطق التحقق في `handleAdd` و `handleEditHalaqa`:**
- قبل الحفظ: التحقق من أن المعلم المختار ليس مرتبطاً بحلقة أخرى نشطة
- قبل الحفظ: التحقق من أن الحلقة ليست مرتبطة بمعلم آخر (في حالة التعديل)
- عند الربط الناجح: تحديث `assigned_halaqa_id` في جدول `profiles` بالتزامن مع تحديث `teacher_id` في جدول `halaqat`
- عند تغيير المعلم: إزالة `assigned_halaqa_id` من المعلم القديم قبل ربط الجديد

**رسائل الخطأ:**
- `"هذا المعلم مرتبط بالفعل بحلقة أخرى ولا يمكن ربطه بحلقة إضافية."` - عند محاولة ربط معلم مرتبط
- `"هذه الحلقة لديها معلم بالفعل ولا يمكن ربط معلم آخر بها."` - عند محاولة ربط حلقة مرتبطة
- `"تم ربط المعلم بالحلقة بنجاح."` - عند النجاح

### 3. تعديل `fetchData` في الحلقات

- جلب `assigned_halaqa_id` مع بيانات المعلمين لتحديد المتاح منهم
- تصفية قائمة المعلمين في الـ Select لإظهار المتاحين فقط (مع علامة على المرتبطين)

### 4. دالة مساعدة للربط المتزامن

إنشاء دالة `linkTeacherToHalaqa(teacherId, halaqaId, oldTeacherId?)` تقوم بـ:
1. التحقق من عدم وجود تعارض
2. إزالة الربط القديم إن وُجد (تحديث المعلم القديم + الحلقة القديمة)
3. تحديث `halaqat.teacher_id` و `profiles.assigned_halaqa_id` معاً

### 5. الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| Migration جديد | إضافة عمود `assigned_halaqa_id` + UNIQUE indexes |
| `src/pages/Halaqat.tsx` | منطق التحقق + تصفية المعلمين + الربط المتزامن |

### 6. ما لن يتغير

- لا تعديل على بنية الجداول الأساسية
- لا حذف لأي جدول أو عمود موجود
- لا تغيير في الـ RLS policies الحالية
- الحقل `assistant_teacher_id` يبقى كما هو (خارج نطاق هذا التعديل)

