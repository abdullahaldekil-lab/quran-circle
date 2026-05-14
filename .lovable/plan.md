## الهدف
فصل كامل بين طلاب حلقات **التحفيظ** وطلاب حلقات **التلقين** في جميع شاشات التحفيظ، بحيث لا تظهر بيانات حلقات/طلاب التلقين داخل شاشات التسميع والسرد والمراجعة والترتيب وغيرها.

## معيار التمييز (موحَّد)
الحلقة تُعتبر **تلقين** إذا تحقق أحد الشرطين:
- `halaqat.talqeen_curriculum_id IS NOT NULL`، أو
- اسم الحلقة يحتوي على كلمة "تلقين" (للحلقات القديمة قبل ربط المنهج).

سيتم إنشاء دالة مساعدة موحَّدة `isTalqeenHalaqa(h)` و `filterTahfeezOnly(list)` في ملف `src/lib/halaqaType.ts` لاستخدامها في كل المكونات (مصدر واحد للحقيقة بدلاً من فلترة يدوية متناثرة).

## الشاشات التي ستُحدَّث (إظهار حلقات/طلاب التحفيظ فقط)
1. **التسميع** — `src/pages/Recitation.tsx` (قائمة الحلقات في الأعلى)
2. **السرد القرآني** — `src/pages/QuranNarration.tsx` (مفلتر جزئيًا حاليًا — توحيد المنطق)
3. **جلسة السرد** — `src/pages/NarrationSession.tsx`
4. **اختبار السرد** — `src/pages/NarrationTest.tsx` و `src/pages/ReviewTest.tsx`
5. **إحصائيات السرد** — `src/pages/NarrationStats.tsx`
6. **تقارير السرد** — `src/pages/NarrationReports.tsx`
7. **الترتيب الشهري** — `src/pages/Rankings.tsx`
8. **التميز** + التقارير + الجلسة — `src/pages/Excellence*.tsx`
9. **خطة الطالب السنوية** — `src/pages/StudentAnnualPlan.tsx`
10. **لوحة KPI** و**تحليلات الحلقات** — `src/pages/KpiDashboard.tsx` + `src/components/dashboard/HalaqatAnalytics.tsx` (قسم التحفيظ فقط)
11. **شاشة الحلقات** — `src/pages/Halaqat.tsx` (استبدال الفلتر الحالي القائم على الاسم بالدالة الموحَّدة)
12. **استيراد CSV / تسجيل الطلاب** — `src/pages/BulkImport.tsx`, `PreRegistration.tsx`, `EnrollmentRequests.tsx` (عند اختيار "حلقة تحفيظ")

## الشاشات التي لن تتأثر
- `TalqeenHalaqat.tsx`، `TalqeenCurricula.tsx`، وكل ما يخص التلقين يبقى كما هو.
- شاشات عامة مثل **الحضور، إدارة الطلاب، ولي الأمر، المالية** ستظل تعرض كل الحلقات (لأنها مشتركة) — *إلا إذا طلبت فصلها أيضًا*.

## التفاصيل التقنية
```ts
// src/lib/halaqaType.ts
export const isTalqeenHalaqa = (h: any) =>
  !!h?.talqeen_curriculum_id || (h?.name || "").includes("تلقين");

export const filterTahfeezOnly = <T extends { talqeen_curriculum_id?: any; name?: string }>(list: T[]) =>
  list.filter((h) => !isTalqeenHalaqa(h));
```
سيتم استبدال:
- `setHalaqat(list.filter(h => !h.name.includes("تلقين")))` → `setHalaqat(filterTahfeezOnly(list))`
- في الاستعلامات التي تجلب الطلاب لأغراض التحفيظ: جلب الحلقات أولاً وفلترتها، ثم استخدام `halaqa_id IN (...)` لجلب الطلاب — لتجنّب ظهور طلاب التلقين في قوائم التسميع/السرد/الترتيب.

## نقاط تحتاج تأكيدك
1. هل تريد تطبيق الفصل على **جميع** الشاشات المذكورة دفعة واحدة، أم البدء بالتسميع والسرد فقط؟
2. شاشة **الحضور** و**الترتيب**: هل تريد فصل التحفيظ عن التلقين فيهما أيضًا (كل قسم مستقل)، أم تركهما مشتركة؟
3. **المكافآت/الشارات/التميز**: هل تُحتسب للجميع أم لطلاب التحفيظ فقط؟

بعد تأكيدك سأبدأ بالتنفيذ مباشرة دون أي تعديل في قاعدة البيانات (التغييرات في الواجهة فقط).