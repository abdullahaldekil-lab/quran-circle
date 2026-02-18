
# ربط وإضافة الطلاب إلى جلسات السرد

## المشكلة الحالية

بعد فحص الكود وقاعدة البيانات، وجدت مشكلتين:

**المشكلة الأولى — خطأ في استعلام الطلاب:**
في `NarrationSession.tsx` السطر 113، يتم جلب الطلاب بـ `.eq("active", true)` لكن جدول `students` لا يحتوي على عمود `active`، بل يستخدم عمود `status` بقيمة `'active'`. هذا يتسبب في عدم ظهور أي طلاب في الجلسة.

**المشكلة الثانية — لا توجد آلية لإضافة طلاب من خارج الحلقة:**
الآلية الحالية تجلب فقط طلاب الحلقة المرتبطة بالجلسة، دون إمكانية إضافة طالب من حلقة أخرى (مفيد ليوم السرد الجماعي).

---

## التعديلات المطلوبة

### 1. إصلاح استعلام الطلاب في `NarrationSession.tsx`
تغيير `.eq("active", true)` إلى `.eq("status", "active")` لجلب الطلاب النشطين بشكل صحيح.

### 2. إضافة زر "إضافة طالب" يدويًا في `NarrationSession.tsx`
زر يفتح نافذة بحث تتيح:
- البحث عن أي طالب في النظام (من أي حلقة)
- عرض اسم الطالب + اسم حلقته
- إضافته مباشرةً إلى جدول النتائج في الجلسة الحالية

### 3. منع إضافة طالب مكرر
إذا كان الطالب موجوداً بالفعل في الجلسة (سواء عبر الحلقة أو الإضافة اليدوية)، يُمنع إضافته مجدداً مع رسالة تنبيه.

---

## تفاصيل التنفيذ التقني

### الملف الوحيد المعدّل: `src/pages/NarrationSession.tsx`

**التعديل 1 — إصلاح الاستعلام (السطر 113):**
```typescript
// قبل (خطأ):
.eq("active", true)

// بعد (صحيح):
.eq("status", "active")
```

**التعديل 2 — إضافة state وquery للبحث:**
```typescript
const [showAddStudent, setShowAddStudent] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
```

```typescript
// جلب جميع الطلاب النشطين للبحث
const { data: allStudents = [] } = useQuery({
  queryKey: ["all-students-search"],
  queryFn: async () => {
    const { data } = await supabase
      .from("students")
      .select("id, full_name, halaqa_id, halaqat(name)")
      .eq("status", "active")
      .order("full_name");
    return data || [];
  },
  enabled: showAddStudent, // يُجلب فقط عند فتح النافذة
});
```

**التعديل 3 — دالة إضافة الطالب:**
```typescript
const addStudentManually = (student: { id: string; full_name: string }) => {
  // منع الإضافة المكررة
  if (rows.some((r) => r.student_id === student.id)) {
    toast({ title: "الطالب موجود بالفعل في الجلسة", variant: "destructive" });
    return;
  }
  const maxGrade = settings?.max_grade ?? 100;
  const newRow: StudentResult = {
    student_id: student.id,
    student_name: student.full_name,
    hizb_from: 1,
    hizb_to: 1,
    mistakes_count: 0,
    lahn_count: 0,
    warnings_count: 0,
    grade: maxGrade,
    status: "pending",
    notes: "",
    manual_entry: false,
  };
  setRows((prev) => [...prev, newRow]);
  setIsDirty(true);
  setShowAddStudent(false);
  setSearchQuery("");
};
```

**التعديل 4 — Dialog البحث والإضافة في الواجهة:**
زر "إضافة طالب" يظهر فقط لأصحاب صلاحية الكتابة (`canWrite`) بجانب عنوان "نتائج الطلاب" في رأس الجدول. النافذة تحتوي على:
- حقل بحث بالاسم
- قائمة نتائج تُصفّى لحظيًا
- يظهر اسم الطالب + اسم حلقته
- الطلاب المضافون بالفعل تظهر بلون رمادي مع نص "مضاف"
- زر إضافة لكل طالب

---

## ترتيب التنفيذ

1. إصلاح الاستعلام (`.eq("active", true)` → `.eq("status", "active")`)
2. إضافة state للبحث والـ Dialog
3. إضافة query لجلب جميع الطلاب
4. إضافة دالة `addStudentManually`
5. إضافة زر + Dialog في واجهة المستخدم

## ما لن يتغير
- جداول قاعدة البيانات لا تحتاج أي تعديل
- منطق الحفظ (`upsert`) يعمل بشكل صحيح مع الطلاب المضافين يدويًا
- جميع الصفحات الأخرى لا تتأثر
