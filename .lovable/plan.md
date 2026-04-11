

# خطة التنفيذ — 5 تعديلات

## 1. إضافة حالة «مستأذن» لحضور الموظفين (StaffAttendance.tsx)
- إضافة `excused: { label: "مستأذن", variant: "outline" }` في `STATUS_MAP` (سطر 54-60)
- إضافة `<SelectItem value="excused">مستأذن</SelectItem>` في قائمة الحالات بنموذج التعديل اليدوي (سطر 436-441)
- إضافة بطاقة ملخص «مستأذن» بأيقونة زرقاء في شبكة البطاقات (سطر 342-348)
- تعديل `summary` ليحسب عدد المستأذنين: `const excused = records.filter(r => r.status === "excused").length`
- تعديل Badge لتظهر بلون أزرق فاتح: عند عرض حالة `excused` يُضاف `className="bg-blue-100 text-blue-800"`

## 2. تعديل المعاملات المالية للمدير (Finance.tsx)
- إضافة state: `editTarget`, `editDialogOpen`, `editForm`
- إضافة دالة `editTransaction` تنفذ `supabase.from('financial_transactions').update(...)` + تسجيل في `financial_audit_log`
- إضافة زر ✏️ في `TransactionCard` يظهر للمدير فقط (`isManager`)
- إضافة Dialog تعديل يحتوي على: المبلغ، التصنيف (منسدل)، الوصف، التاريخ
- تمرير `onEdit` callback من المكون الرئيسي إلى `TransactionCard`

## 3. فصل إدخالات التسميع بصرياً (Recitation.tsx)
- تحويل الأقسام الثلاثة (الحفظ، المراجعة، الربط) من صفوف بسيطة إلى أقسام مستقلة بخلفيات ملونة:
  - الحفظ: `bg-green-50 border-green-200` مع أيقونة BookOpen خضراء
  - المراجعة: `bg-blue-50 border-blue-200` مع أيقونة RefreshCw زرقاء
  - الربط: `bg-purple-50 border-purple-200` مع أيقونة Link بنفسجية
- نقل Slider جودة الحفظ داخل قسم الحفظ، والتجويد داخل قسم المراجعة
- استبدال Slider الأخطاء بحقل رقمي مع أزرار `+` و `-` لتسهيل الإدخال السريع

## 4. إشعارات الغياب والتأخر (Attendance.tsx)
- الكود الحالي (سطور 276-308) يرسل إشعارات بالفعل عبر `sendNotification` لكل طالب غائب/متأخر
- **التحسين**: إضافة عداد لعدد الإشعارات المُرسلة وعرض toast بعد الحفظ: `تم إرسال X إشعار لأولياء الأمور`
- إضافة `try/catch` حول حلقة الإشعارات لضمان عدم فشل الحفظ بسبب خطأ في الإشعارات

## 5. تعديل تاريخ جلسة السرد (QuranNarration.tsx)
- الجلسة تدعم التعديل بالفعل عبر `openEdit` (سطر 324-337) الذي يفتح نفس Dialog الإنشاء
- **التحسين**: إضافة زر ✏️ سريع بجانب تاريخ كل جلسة في القائمة (للمدير والمشرف فقط) يفتح Popover صغير
- Popover يحتوي على: حقل تاريخ ميلادي + عرض التاريخ الهجري المقابل تلقائياً
- عند الحفظ: `supabase.from('narration_sessions').update({ session_date: newDate }).eq('id', sessionId)` + invalidate queries

---

## تفاصيل تقنية
- لا حاجة لأي تعديل في قاعدة البيانات (جميع الأعمدة المطلوبة موجودة)
- الملفات المتأثرة: `StaffAttendance.tsx`, `Finance.tsx`, `Recitation.tsx`, `Attendance.tsx`, `QuranNarration.tsx`

