

# إضافة شهادة اختبار قابلة للطباعة

## الملفات الجديدة

### `src/components/quiz/QuizCertificate.tsx`
مكون طباعة يتبع نفس نمط `NarrationCertificate.tsx` الموجود:
- تصميم بـ inline styles للطباعة (700px عرض، إطار مزخرف، خلفية متدرجة)
- شعار المجمع (huwaylan-logo.jpeg)
- عنوان: "شهادة اختبار حفظ القرآن الكريم"
- بيانات الطالب: الاسم، الحلقة، المقرر المختبَر، مستوى الصعوبة
- الدرجة مع مؤشر بصري دائري (نسبة مئوية)
- التصنيف (ممتاز/جيد جداً/جيد/يحتاج مراجعة) بلون مميز
- جدول الأسئلة الخمسة مع نتيجة كل سؤال (✅/❌)
- التاريخ واسم المعلم المصحح
- خانة توقيع المعلم وختم المجمع

Props: `studentName, halaqaName, memorizedContent, difficulty, score, gradeLabel, questions[], teacherName, quizDate, notes`

## التعديلات

### `src/pages/StudentQuiz.tsx`
- استيراد `QuizCertificate` و `useRef` و `Printer` icon
- إضافة `ref` للشهادة المخفية (`display: none`)
- بعد الحفظ (عند ظهور `savedQuizId`)، إضافة زر "طباعة الشهادة" بجانب زر "اختبار طالب آخر"
- دالة `handlePrint` تستخدم `window.print()` مع إظهار/إخفاء الشهادة عبر CSS `@media print`
- جلب اسم المعلم من `profile.full_name`

لا حاجة لتعديل قاعدة البيانات.

