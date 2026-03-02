import { useRef } from "react";
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
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 12px; line-height: 1.6; direction: rtl; color: #1a1a1a; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 3px double #b8860b; padding-bottom: 12px; }
          .header img { width: 60px; height: 60px; border-radius: 12px; object-fit: contain; }
          .header h1 { font-size: 18px; color: #1a365d; margin: 6px 0 2px; }
          .header p { font-size: 11px; color: #666; }
          .section { margin-bottom: 12px; }
          .section-title { background: #f0f4f8; padding: 5px 10px; font-weight: bold; font-size: 13px; border-right: 4px solid #b8860b; margin-bottom: 8px; color: #1a365d; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
          .field { display: flex; gap: 4px; padding: 3px 0; border-bottom: 1px dotted #ddd; }
          .field-label { font-weight: 600; white-space: nowrap; min-width: 100px; color: #444; }
          .field-value { flex: 1; }
          .full-width { grid-column: 1 / -1; }
          .commitments { border: 1px solid #ddd; border-radius: 6px; padding: 10px; font-size: 11px; line-height: 1.8; background: #fafaf8; margin-top: 8px; }
          .signature-area { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc; }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-bottom: 1px solid #333; height: 40px; margin-bottom: 4px; }
          .sig-label { font-size: 11px; color: #666; }
          .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
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

  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

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
            <Field label="تاريخ الميلاد هجري" value={data.student_birth_date_hijri} />
            <Field label="تاريخ الميلاد ميلادي" value={data.student_birth_date_gregorian} />
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
