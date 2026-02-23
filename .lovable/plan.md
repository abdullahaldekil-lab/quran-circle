
# اصلاح اخطاء البناء واختبار الاشعارات

## المشكلات الحالية

### 1. خطا CSS - ترتيب @import
ملف `src/index.css` يضع `@import` للخط العربي بعد تعليمات `@tailwind`، بينما يتطلب المعيار ان يكون `@import` قبل اي تعليمات اخرى.

**الحل:** نقل سطر `@import url(...)` الى اول سطر في الملف، قبل `@tailwind base`.

### 2. خطا d3-path - حزمة recharts
حزمة `d3-path` المستخدمة داخليا من `recharts` بها مشكلة في ملف `package.json` الخاص بها. هذا خطا شائع في بيئات معينة.

**الحل:** اضافة `d3-path` كتبعية مباشرة في `package.json` لحل مشكلة الاستيراد.

---

## الملفات المعدلة

| الملف | التعديل |
|-------|---------|
| `src/index.css` | نقل `@import` قبل `@tailwind` |
| `package.json` | اضافة `d3-path` كتبعية مباشرة |

---

## خطوات التنفيذ

1. تعديل `src/index.css` - نقل سطر الـ import الى اعلى الملف
2. اضافة `d3-path` في `package.json`
3. اختبار ان التطبيق يعمل بنجاح
4. التحقق من عمل نظام الاشعارات عبر التنقل في الصفحات

---

## القسم التقني

```text
قبل:
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  @import url('...');

بعد:
  @import url('...');
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
```
