

# نظام إدارة الصلاحيات المتقدم

## الوضع الحالي

النظام يعتمد حاليًا على حقل `role` في جدول `profiles` مع صلاحيات مُعرّفة برمجيًا في `useRole.tsx`. هذا النهج محدود ولا يسمح بتخصيص صلاحيات فردية لكل مستخدم.

## التغييرات المطلوبة

### 1. إنشاء جداول قاعدة البيانات الجديدة

سيتم إنشاء 4 جداول جديدة مع سياسات أمان (RLS) ودالة أمان:

- **`roles`** -- تعريف الأدوار (معلم، مشرف، مدير، دور مخصص...)
- **`permissions`** -- تعريف كل صلاحية (مثل: عرض الطلاب، إضافة حلقة، تسجيل الحضور...)
- **`role_permissions`** -- ربط كل دور بمجموعة صلاحيات
- **`user_permissions`** -- صلاحيات فردية مخصصة لمستخدم معين (تتجاوز صلاحيات الدور)

ملاحظة: لن يتم إنشاء جدول `user_roles` منفصل لأن حقل `role` موجود بالفعل في `profiles` وسيتم ربط الأدوار الجديدة به.

سيتم تعبئة الجداول ببيانات أولية تشمل:
- 7 أدوار افتراضية (مدير، مشرف، مساعد مشرف، سكرتير، موظف إداري، معلم، معلم مساعد)
- ~35 صلاحية تغطي جميع الوحدات
- ربط الصلاحيات بالأدوار الافتراضية وفق النظام الحالي

### 2. دالة فحص الصلاحيات (Security Definer)

إنشاء دالة `has_permission(user_id, permission_name)` تعمل بالمنطق التالي:
1. المدير يملك جميع الصلاحيات تلقائيًا
2. فحص `user_permissions` للصلاحيات الفردية
3. فحص `role_permissions` عبر دور المستخدم من `profiles`

### 3. تعديل Hook الصلاحيات

تعديل `useRole.tsx` لإضافة دالة `hasPermission(permissionName)` التي تحمّل الصلاحيات الفعلية من قاعدة البيانات بدلاً من الاعتماد على القوائم الثابتة.

سيتم الحفاظ على جميع الدوال الحالية (`hasAccess`, `canWrite`, `isManager`...) لتجنب كسر أي شيء موجود، مع إضافة الدالة الجديدة.

### 4. إنشاء صفحة "إدارة الصلاحيات"

صفحة جديدة `/permissions-management` تحتوي على 3 تبويبات:

**تبويب الأدوار:**
- عرض قائمة الأدوار
- إضافة / تعديل / حذف دور
- عند فتح دور: قائمة بجميع الصلاحيات مع مفاتيح تفعيل/تعطيل

**تبويب الصلاحيات:**
- عرض جميع الصلاحيات المتاحة في النظام
- مُنظّمة حسب الفئة (حلقات، طلاب، حضور، تسميع، إلخ)

**تبويب المستخدمين:**
- البحث عن مستخدم
- عرض الدور المرتبط به
- قائمة بجميع الصلاحيات مع إمكانية تفعيل/تعطيل فردي
- الصلاحيات الموروثة من الدور تظهر بشكل مختلف عن المضافة فرديًا

### 5. تحديث التوجيه والقوائم

- إضافة مسار `/permissions-management` في `App.tsx`
- إضافة رابط "إدارة الصلاحيات" في القائمة الجانبية (للمدير فقط)
- إضافة المسار لصلاحيات المدير في `useRole.tsx`

---

## التفاصيل التقنية

### الملفات الجديدة
| الملف | الوصف |
|---|---|
| `src/pages/PermissionsManagement.tsx` | صفحة إدارة الصلاحيات بالتبويبات الثلاثة |
| `src/hooks/usePermissions.ts` | Hook لتحميل وفحص صلاحيات المستخدم الحالي |

### الملفات المعدّلة
| الملف | التعديل |
|---|---|
| `src/hooks/useRole.tsx` | إضافة `hasPermission()` مع الحفاظ على كل شيء موجود |
| `src/App.tsx` | إضافة مسار `/permissions-management` |
| `src/components/AppLayout.tsx` | إضافة رابط "إدارة الصلاحيات" في مجموعة الإدارة |

### الجداول الجديدة (Migration)

```text
roles (id, name, description, is_system, created_at)
permissions (id, name, name_ar, category, description, created_at)
role_permissions (id, role_id, permission_id)
user_permissions (id, user_id, permission_id, granted)
```

### قائمة الصلاحيات المبدئية (~35 صلاحية)

```text
الحلقات: view_halaqat, create_halaqa, edit_halaqa, delete_halaqa, assign_teacher
الطلاب: view_students, create_student, edit_student, delete_student
الحضور: mark_attendance, edit_attendance, view_attendance_log
التسميع: mark_recitation, edit_recitation, view_recitations
المستويات: manage_levels
مدارج: manage_madarij_tracks, manage_madarij_levels, manage_madarij_progress, manage_madarij_exams
المكافآت: manage_rewards, manage_rankings
الرحلات: manage_trips
الباصات: manage_buses
المالية: manage_finance
التخطيط: manage_strategic_plan, view_kpi
المستخدمين: manage_users, manage_permissions
المستندات: manage_documents
التعليمات: manage_instructions
القبول: manage_pre_registration, manage_enrollment
الإعدادات: manage_settings, manage_academic_calendar
```

### ما لن يتغير
- جدول `profiles` (بقاء حقل `role` كما هو)
- جميع الموديولات الحالية
- سياسات RLS الموجودة
- جميع الصفحات والمكونات الحالية

