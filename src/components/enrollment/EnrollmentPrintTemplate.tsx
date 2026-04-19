import { useRef } from "react";
import { formatDateSmart, formatHijriStringArabic, formatDateHijriOnly } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { EnrollmentFormData } from "./EnrollmentForm";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";

interface Props {
  data: EnrollmentFormData;
}

const EnrollmentPrintTemplate = ({ data }: Props) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
      <head>
        <title>استمارة تسجيل - ${data.student_full_name}</title>
        <style>
          @page { size: A4; margin: 8mm 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 12px; line-height: 1.4; direction: rtl; color: #000; }
          .page { page-break-inside: avoid; }
          .header { text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 6px; }
          .header img { width: 50px; height: 50px; border-radius: 8px; object-fit: contain; }
          .header h1 { font-size: 17px; color: #000; margin: 4px 0 2px; }
          .header p { font-size: 11px; color: #000; }
          .section { margin-bottom: 6px; border-bottom: 1.5px solid #000; padding-bottom: 4px; }
          .section:last-of-type { border-bottom: none; }
          .section-title { background: #f0f0f0; padding: 3px 10px; font-weight: bold; font-size: 12.5px; border-right: 4px solid #000; margin-bottom: 4px; color: #000; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 14px; }
          .field { display: flex; gap: 4px; padding: 2px 0; border-bottom: 1px dotted #555; font-size: 12px; }
          .field-label { font-weight: 600; white-space: nowrap; min-width: 95px; color: #000; }
          .field-value { flex: 1; color: #000; }
          .full-width { grid-column: 1 / -1; }
          .commitments { border: 1.5px solid #000; border-right: 4px solid #000; padding: 6px 12px; font-size: 11.5px; line-height: 1.5; margin-top: 6px; }
          .signature-area { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1.5px solid #000; }
          .sig-box { text-align: center; width: 180px; }
          .sig-line { border-bottom: 1px solid #000; height: 30px; margin-bottom: 4px; }
          .sig-label { font-size: 11.5px; color: #000; font-weight: 600; }
          .footer { text-align: center; margin-top: 8px; font-size: 10px; color: #000; border-top: 1.5px solid #000; padding-top: 4px; }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="field">
      <span className="field-label">{label}:</span>
      <span className="field-value">{value || "—"}</span>
    </div>
  );

  const today = formatDateSmart(new Date());

  return (
    <div>
      <Button onClick={handlePrint} variant="outline" className="w-full mb-4">
        <Printer className="w-4 h-4 ml-2" />
        طباعة الاستمارة
      </Button>

      {/* Hidden print content */}
      <div ref={printRef} style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div className="header">
          <img src={huwaylanLogo} alt="logo" />
          <h1>مجمع حويلان لتحفيظ القرآن الكريم</h1>
          <p>استمارة تسجيل طالب جديد</p>
        </div>

        <div className="section">
          <div className="section-title">بيانات الطالب</div>
          <div className="grid">
            <Field label="اسم الطالب رباعي" value={data.student_full_name} />
            <Field label="الجنسية" value={data.student_nationality} />
            <Field label="رقم الهوية / الإقامة" value={data.student_id_number} />
            <Field label="تاريخ الميلاد هجري" value={data.student_birth_date_hijri ? formatHijriStringArabic(data.student_birth_date_hijri) : (data.student_birth_date_gregorian ? formatDateHijriOnly(data.student_birth_date_gregorian) : "")} />
            <Field label="المدرسة" value={data.student_school} />
            <Field label="الصف الدراسي" value={data.student_grade} />
          </div>
        </div>

        <div className="section">
          <div className="section-title">البيانات الاجتماعية</div>
          <div className="grid">
            <Field label="يعيش مع" value={data.living_with} />
            <Field label="حالة الوالدين" value={data.parents_status} />
          </div>
        </div>

        <div className="section">
          <div className="section-title">بيانات ولي الأمر</div>
          <div className="grid">
            <Field label="اسم ولي الأمر" value={data.guardian_full_name} />
            <Field label="صلة القرابة" value={data.guardian_relationship} />
            <Field label="رقم الهوية" value={data.guardian_id_number} />
            <Field label="رقم الجوال" value={data.guardian_phone} />
            <div className="full-width">
              <Field label="عنوان السكن" value={data.guardian_address} />
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">الحالة الصحية</div>
          <div className="grid">
            <Field label="أمراض مزمنة" value={data.has_chronic_diseases === "نعم" ? `نعم - ${data.chronic_diseases_details}` : "لا"} />
            <Field label="أدوية مستمرة" value={data.has_medications === "نعم" ? `نعم - ${data.medications_details}` : "لا"} />
            <Field label="حساسية" value={data.has_allergies === "نعم" ? `نعم - ${data.allergies_details}` : "لا"} />
          </div>
        </div>

        <div className="section">
          <div className="section-title">المعلومات القرآنية</div>
          <div className="grid">
            <Field label="تسجيل سابق" value={data.previous_enrollment === "نعم" ? `نعم - ${data.previous_place}` : "لا"} />
            <Field label="مقدار الحفظ" value={data.memorization_amount} />
            <Field label="العمر" value={data.student_age} />
            <Field label="المرحلة الدراسية" value={data.student_grade} />
            {data.notes && <div className="full-width"><Field label="ملاحظات" value={data.notes} /></div>}
          </div>
        </div>

        <div className="commitments">
          <strong>التعهدات:</strong><br />
          أتعهد أنا ولي الأمر بصحة البيانات المذكورة أعلاه، وأتعهد بالتزام ابني بأنظمة المجمع وتعليماته، وأتحمل المسؤولية الكاملة في حال مخالفة ذلك. كما أتعهد بمتابعة ابني في حفظ القرآن الكريم ومراجعته والتواصل المستمر مع إدارة المجمع.
        </div>

        <div className="signature-area">
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-label">توقيع ولي الأمر</div>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-label">التاريخ: {today}</div>
          </div>
        </div>

        <div className="footer">
          مجمع حويلان لتحفيظ القرآن الكريم — جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
};

export default EnrollmentPrintTemplate;
