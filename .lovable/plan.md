

# خطة الإصلاحات

## 1. إصلاح عداد الطلبات المعلقة في Dashboard.tsx
**المشكلة**: استعلام `internal_requests` يفلتر بـ `to_user_id` و `to_role` للجميع، مما يمنع المدير من رؤية كل الطلبات.

**الحل**: إضافة شرط `isManager` لتجاوز الفلتر:
```typescript
const isManagerRole = profile?.role === 'manager';
let reqQuery = supabase.from('internal_requests')
  .select('id', { count: 'exact', head: true })
  .in('status', ['new', 'in_progress']);
if (!isManagerRole) {
  reqQuery = reqQuery.or(`to_user_id.eq.${user.id},to_role.eq.${role}`);
}
```

**الملف**: `src/pages/Dashboard.tsx` (سطر ~128-133)

---

## 2. تحسين معالجة أخطاء الحضور في Attendance.tsx
**الحل**: إضافة `console.error` ورسالة واجهة عند فشل استعلام الحضور، والتأكد من أن تغيير التاريخ يعمل بدقة مع التنسيق `yyyy-MM-dd`.

**الملف**: `src/pages/Attendance.tsx`

---

## ملاحظات - بنود لا تحتاج تعديل
- **أدوار التعيين**: `roleLabels` يحتوي بالفعل على الأدوار السبعة كاملة ويُستخدم في نماذج الإنشاء والتعديل عبر `Object.entries(roleLabels).map()`
- **تقارير التميز الشهرية**: `loadMonthlyReport` تفلتر بالفعل بنطاق تاريخ هجري→ميلادي وتستخدم `sessionIds` للأداء

---

## تفاصيل تقنية
- لا حاجة لتعديل قاعدة البيانات
- ملفان فقط يتأثران: `Dashboard.tsx` و `Attendance.tsx`

