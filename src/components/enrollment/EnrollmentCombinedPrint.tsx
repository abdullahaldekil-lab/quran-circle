import { useRef } from "react";
import { formatDateHijriOnly, formatHijriStringArabic } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";

interface CombinedPrintProps {
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  halaqaName: string;
  approvedAt: string | null;
  requestId: string;
  formData?: Record<string, string>;
  notes?: string | null;
}

const EnrollmentCombinedPrint = ({
  studentName, guardianName, guardianPhone, halaqaName,
  approvedAt, requestId, formData = {}, notes,
}: CombinedPrintProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const refNumber = requestId.slice(0, 8).toUpperCase();
  const today = approvedAt ? formatDateHijriOnly(approvedAt) : formatDateHijriOnly(new Date().toISOString().slice(0, 10));

  const fd = formData as Record<string, string>;
  const birthHijri = fd.student_birth_date_hijri
    ? formatHijriStringArabic(fd.student_birth_date_hijri)
    : fd.student_birth_date_gregorian
    ? formatDateHijriOnly(fd.student_birth_date_gregorian)
    : "—";

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
      <head>
        <title>استمارات التسجيل والقبول — ${studentName}</title>
        <style>
          @page { size: A4; margin: 15mm 18mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; line-height: 1.85; direction: rtl; color: #1a1a1a; }

          /* ─── Page break ─── */
          .page-break { page-break-after: always; break-after: page; }

          /* ─── Header ─── */
          .header { text-align: center; padding-bottom: 14px; border-bottom: 3px double #b8860b; margin-bottom: 16px; }
          .header-inner { display: flex; align-items: center; justify-content: center; gap: 16px; }
          .header img { width: 80px; height: 80px; border-radius: 10px; object-fit: contain; }
          .header-text h1 { font-size: 20px; color: #1a365d; font-weight: 700; }
          .header-text p { font-size: 12px; color: #666; margin-top: 3px; }
          .header-sub { font-size: 14px; font-weight: 700; color: #8b6914; margin-top: 8px; letter-spacing: 0.5px; border-top: 1px solid #e8d8a0; padding-top: 6px; display: inline-block; }

          /* ─── Meta row ─── */
          .meta-row { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-bottom: 16px; border-bottom: 2px solid #e0d8c8; padding-bottom: 8px; }

          /* ─── Acceptance letter ─── */
          .letter-body { font-size: 14px; line-height: 2.2; margin: 12px 0 16px; }
          .letter-body p { margin-bottom: 10px; }
          .highlight { color: #1a365d; font-weight: 700; }
          .info-table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; border: 2px solid #c8b870; }
          .info-table td { padding: 9px 12px; border: 1px solid #ccc; font-size: 13px; }
          .info-table td:first-child { background: #f0f4f8; font-weight: 600; color: #1a365d; width: 145px; }
          .instructions { background: #fafaf8; border: 1px solid #c8b870; border-right: 4px solid #b8860b; border-radius: 6px; padding: 12px 16px; font-size: 12px; line-height: 2; margin-top: 16px; }
          .instructions h3 { font-size: 13px; color: #1a365d; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #d0c8a0; padding-bottom: 5px; }
          .instructions ol { padding-right: 20px; }
          .instructions li { margin-bottom: 4px; }

          /* ─── Signature area ─── */
          .signature-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 16px; border-top: 2px solid #e0d8c8; }
          .sig-box { text-align: center; width: 160px; }
          .sig-line { border-bottom: 1px solid #333; height: 48px; margin-bottom: 6px; }
          .sig-label { font-size: 12px; color: #444; font-weight: 600; }
          .stamp-circle { width: 90px; height: 90px; border: 2px dashed #b8860b; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 11px; color: #b8860b; text-align: center; padding: 8px; }

          /* ─── Section (registration form) ─── */
          .section { margin-bottom: 14px; border-bottom: 1px solid #e8e8e0; padding-bottom: 10px; }
          .section:last-of-type { border-bottom: none; }
          .section-title { background: linear-gradient(90deg, #eef2f8, #f8f8f2); padding: 6px 12px; font-weight: 700; font-size: 13px; border-right: 4px solid #b8860b; color: #1a365d; margin-bottom: 9px; border-radius: 0 4px 4px 0; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
          .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px; }
          .field { display: flex; gap: 5px; padding: 4px 0; border-bottom: 1px dotted #d8d8d0; font-size: 12.5px; align-items: baseline; }
          .field-label { font-weight: 600; white-space: nowrap; min-width: 95px; color: #444; flex-shrink: 0; }
          .field-value { flex: 1; color: #1a1a1a; }
          .full-span { grid-column: 1 / -1; }
          .commitments { border: 1px solid #c8b870; border-right: 4px solid #b8860b; border-radius: 6px; padding: 12px 16px; font-size: 12px; line-height: 2; background: #fafaf8; margin: 10px 0; }

          /* ─── Footer ─── */
          .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #888; border-top: 2px solid #b8860b; padding-top: 8px; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const F = ({ label, value }: { label: string; value?: string }) => (
    <div className="field">
      <span className="field-label">{label}:</span>
      <span className="field-value">{value || "—"}</span>
    </div>
  );

  return (
    <div>
      <Button onClick={handlePrint} className="w-full mb-4 gap-2">
        <Printer className="w-4 h-4" />
        طباعة الاستمارتين (القبول + التسجيل)
      </Button>

      <div ref={printRef} style={{ position: "absolute", left: "-9999px", top: 0 }}>

        {/* ══════════════════════════════════════
            الصفحة الأولى — خطاب القبول
        ══════════════════════════════════════ */}
        <div className="page-break">
          <div className="header">
            <div className="header-inner">
              <img src={huwaylanLogo} alt="شعار المجمع" />
              <div className="header-text">
                <h1>مجمع حويلان لتحفيظ القرآن الكريم</h1>
                <p>نحفظ القرآن — نبني الأجيال</p>
              </div>
            </div>
            <div className="header-sub">خطاب قبول طالب</div>
          </div>

          <div className="meta-row">
            <span>رقم المرجع: <strong>{refNumber}</strong></span>
            <span>التاريخ: <strong>{today}</strong></span>
          </div>

          <div className="letter-body">
            <p>بسم الله الرحمن الرحيم</p>
            <p>الأخ الكريم / <span className="highlight">{guardianName}</span> &nbsp; حفظه الله</p>
            <p>السلام عليكم ورحمة الله وبركاته،،، وبعد:</p>
            <p>
              يسُرّ إدارة <strong>مجمع حويلان لتحفيظ القرآن الكريم</strong> أن تُبشّركم بقبول ابنكم{" "}
              <span className="highlight">{studentName}</span> في المجمع، سائلين الله عز وجل أن يجعله
              من حفظة كتابه الكريم وأن يبارك في وقته وجهده.
            </p>
          </div>

          <table className="info-table">
            <tbody>
              <tr><td>اسم الطالب</td><td>{studentName}</td></tr>
              <tr><td>ولي الأمر</td><td>{guardianName}</td></tr>
              <tr><td>رقم التواصل</td><td>{guardianPhone}</td></tr>
              <tr><td>الحلقة المعيّنة</td><td>{halaqaName || "سيتم التحديد لاحقاً"}</td></tr>
              <tr><td>تاريخ الميلاد</td><td>{birthHijri}</td></tr>
              <tr><td>تاريخ القبول</td><td>{today}</td></tr>
            </tbody>
          </table>

          <div className="instructions">
            <h3>تعليمات مهمة يُرجى الالتزام بها:</h3>
            <ol>
              <li>الالتزام بمواعيد الحلقة المحددة وعدم التأخر.</li>
              <li>إحضار المصحف الشريف والأدوات المطلوبة في كل جلسة.</li>
              <li>الالتزام بالسلوك الحسن واحترام المعلمين والزملاء.</li>
              <li>التواصل المستمر مع معلم الحلقة ومتابعة تقدم الطالب يومياً.</li>
              <li>إبلاغ إدارة المجمع مسبقاً في حال الغياب أو التأخر.</li>
              <li>المراجعة اليومية وتلاوة ما تم حفظه أمام ولي الأمر.</li>
            </ol>
          </div>

          <div className="signature-area">
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">توقيع ولي الأمر</div>
            </div>
            <div>
              <div className="stamp-circle">ختم<br />المجمع</div>
            </div>
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">مدير المجمع</div>
            </div>
          </div>

          <div className="footer">
            مجمع حويلان لتحفيظ القرآن الكريم — جميع الحقوق محفوظة
          </div>
        </div>

        {/* ══════════════════════════════════════
            الصفحة الثانية — استمارة التسجيل
        ══════════════════════════════════════ */}
        <div>
          <div className="header">
            <div className="header-inner">
              <img src={huwaylanLogo} alt="شعار المجمع" />
              <div className="header-text">
                <h1>مجمع حويلان لتحفيظ القرآن الكريم</h1>
                <p>نحفظ القرآن — نبني الأجيال</p>
              </div>
            </div>
            <div className="header-sub">استمارة تسجيل طالب</div>
          </div>

          <div className="meta-row">
            <span>رقم الطلب: <strong>{refNumber}</strong></span>
            <span>تاريخ التسجيل: <strong>{today}</strong></span>
          </div>

          {/* بيانات الطالب */}
          <div className="section">
            <div className="section-title">أولاً: بيانات الطالب</div>
            <div className="grid2">
              <F label="اسم الطالب رباعي" value={studentName} />
              <F label="الجنسية" value={fd.student_nationality} />
              <F label="رقم الهوية / الإقامة" value={fd.student_id_number} />
              <F label="تاريخ الميلاد" value={birthHijri} />
              <F label="العمر" value={fd.student_age} />
              <F label="الصف الدراسي" value={fd.student_grade} />
              <div className="full-span">
                <F label="المدرسة" value={fd.student_school} />
              </div>
            </div>
          </div>

          {/* البيانات الاجتماعية */}
          <div className="section">
            <div className="section-title">ثانياً: البيانات الاجتماعية</div>
            <div className="grid2">
              <F label="يعيش مع" value={fd.living_with} />
              <F label="الحالة الاجتماعية للوالدين" value={fd.parents_status} />
            </div>
          </div>

          {/* بيانات ولي الأمر */}
          <div className="section">
            <div className="section-title">ثالثاً: بيانات ولي الأمر</div>
            <div className="grid2">
              <F label="اسم ولي الأمر" value={guardianName} />
              <F label="صلة القرابة" value={fd.guardian_relationship} />
              <F label="رقم الهوية" value={fd.guardian_id_number} />
              <F label="رقم الجوال" value={guardianPhone} />
              <div className="full-span">
                <F label="عنوان السكن" value={fd.guardian_address} />
              </div>
            </div>
          </div>

          {/* الحالة الصحية */}
          <div className="section">
            <div className="section-title">رابعاً: الحالة الصحية</div>
            <div className="grid3">
              <F
                label="أمراض مزمنة"
                value={fd.has_chronic_diseases === "نعم" ? `نعم — ${fd.chronic_diseases_details || "غير محدد"}` : "لا"}
              />
              <F
                label="أدوية مستمرة"
                value={fd.has_medications === "نعم" ? `نعم — ${fd.medications_details || "غير محدد"}` : "لا"}
              />
              <F
                label="حساسية"
                value={fd.has_allergies === "نعم" ? `نعم — ${fd.allergies_details || "غير محدد"}` : "لا"}
              />
            </div>
          </div>

          {/* المعلومات القرآنية */}
          <div className="section">
            <div className="section-title">خامساً: المعلومات القرآنية</div>
            <div className="grid2">
              <F
                label="تسجيل سابق"
                value={fd.previous_enrollment === "نعم" ? `نعم — ${fd.previous_place || "غير محدد"}` : "لا"}
              />
              <F label="مقدار الحفظ الحالي" value={fd.memorization_amount} />
              <F label="الحلقة المعيّنة" value={halaqaName} />
              {notes && (
                <div className="full-span">
                  <F label="ملاحظات" value={notes} />
                </div>
              )}
            </div>
          </div>

          {/* التعهدات */}
          <div className="commitments">
            <strong>التعهدات:</strong><br />
            أتعهد أنا ولي الأمر بصحة البيانات المذكورة أعلاه، وأتعهد بالتزام ابني بأنظمة المجمع وتعليماته،
            وأتحمل المسؤولية الكاملة في حال مخالفة ذلك. كما أتعهد بمتابعة ابني في حفظ القرآن الكريم
            ومراجعته والتواصل المستمر مع إدارة المجمع.
          </div>

          <div className="signature-area">
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">توقيع ولي الأمر</div>
            </div>
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">التاريخ: {today}</div>
            </div>
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">توقيع المدير</div>
            </div>
          </div>

          <div className="footer">
            مجمع حويلان لتحفيظ القرآن الكريم — جميع الحقوق محفوظة
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentCombinedPrint;
