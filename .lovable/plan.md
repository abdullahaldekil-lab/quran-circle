

# إصلاح مشكلة التاريخ الهجري (NaN)

## سبب المشكلة

الدالة `formatHijriArabic()` تستقبل أي نص وتفترض أنه تاريخ ميلادي فتحوّله للهجري. لكن في عدة أماكن يتم تمريرها تاريخ **هجري مسبقاً** (مثل `session_hijri_date` = `"1447/09/15"`) فتحدث تحويل مزدوج ينتج `NaN` وسنة خاطئة مثل `1355`.

## الحل

### 1. إضافة دالة جديدة في `src/lib/hijri.ts`

إنشاء دالة `formatHijriStringArabic(hijriStr)` تأخذ نص هجري بصيغة `YYYY/MM/DD` وتعرضه بالعربي مباشرة **بدون تحويل**:

```typescript
export function formatHijriStringArabic(hijriStr: string): string {
  const parts = hijriStr.split("/").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return hijriStr;
  const [year, month, day] = parts;
  const monthName = HIJRI_MONTHS[month - 1] || "";
  return `${day} ${monthName} ${year} هـ`;
}
```

### 2. استبدال الاستدعاءات الخاطئة في 4 ملفات

| الملف | السطر | التغيير |
|---|---|---|
| `Excellence.tsx` | 279, 361, 392 | `formatHijriArabic(s.session_hijri_date)` → `formatHijriStringArabic(s.session_hijri_date)` |
| `ExcellenceSession.tsx` | 371 | `formatHijriArabic(sessionHijri)` → `formatHijriStringArabic(sessionHijri)` |
| `ExcellenceReports.tsx` | 83, 318 | نفس الاستبدال للحقول الهجرية |
| `StudentProfile.tsx` | 246 | `formatHijriArabic(student.birth_date_hijri)` → `formatHijriStringArabic(student.birth_date_hijri)` |

الملفات التي تمرر تاريخ ميلادي فعلي (`new Date()` أو `session_date` أو `created_at`) تبقى كما هي بدون تغيير.

### النتيجة المتوقعة

بدلاً من `NaN ذو الحجة 1355 هـ` سيظهر التاريخ صحيحاً مثل: `7 شوّال 1447 هـ`

