import { useRef } from "react";
import { formatDateSmart } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";

interface Props {
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  halaqaName: string;
  approvedAt: string | null;
  requestId: string;
}

const AcceptanceLetterTemplate = ({ studentName, guardianName, guardianPhone, halaqaName, approvedAt, requestId }: Props) => {
  const printRef = useRef<HTMLDivElement>(null);
  const refNumber = requestId.slice(0, 8).toUpperCase();
  const dateDisplay = approvedAt ? formatDateSmart(approvedAt) : formatDateSmart(new Date());

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
      <head>
        <title>خطاب قبول - ${studentName}</title>
        <style>
          @page { size: A4; margin: 10mm 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 15px; line-height: 1.6; direction: rtl; color: #000; }
          .page { max-width: 100%; margin: 0 auto; page-break-inside: avoid; }
          .header { text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #000; }
          .header img { width: 70px; height: 70px; border-radius: 10px; object-fit: contain; }
          .header h1 { font-size: 20px; color: #000; margin: 6px 0 2px; }
          .header p { font-size: 13px; color: #000; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: #000; border-bottom: 1.5px solid #000; padding-bottom: 5px; }
          .letter-body { margin: 10px 0; font-size: 15px; line-height: 1.8; }
          .letter-body p { margin-bottom: 6px; }
          .highlight { color: #000; font-weight: 700; }
          .info-table { width: 100%; border-collapse: collapse; margin: 8px 0; border: 1.5px solid #000; }
          .info-table td { padding: 6px 12px; border: 1px solid #000; font-size: 14px; }
          .info-table td:first-child { background: #f0f0f0; font-weight: 600; color: #000; width: 150px; }
          .section-divider { border: none; border-top: 1.5px solid #000; margin: 10px 0; }
          .instructions { border: 1.5px solid #000; border-right: 4px solid #000; padding: 8px 14px; margin: 10px 0; font-size: 13px; line-height: 1.7; }
          .instructions h3 { font-size: 14px; color: #000; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 4px; font-weight: 700; }
          .instructions li { margin-right: 18px; margin-bottom: 2px; }
          .signature-area { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 10px; border-top: 1.5px solid #000; }
          .sig-box { text-align: center; width: 180px; }
          .sig-line { border-bottom: 1px solid #000; height: 35px; margin-bottom: 4px; }
          .sig-label { font-size: 13px; color: #000; font-weight: 600; }
          .footer { text-align: center; margin-top: 12px; font-size: 11px; color: #000; border-top: 1.5px solid #000; padding-top: 6px; }
          .stamp-area { text-align: center; }
          .stamp-placeholder { display: inline-block; width: 75px; height: 75px; border: 2px dashed #000; border-radius: 50%; line-height: 75px; font-size: 11px; color: #000; }
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

  return (
    <div>
      <Button onClick={handlePrint} variant="outline" className="w-full mb-4">
        <Printer className="w-4 h-4 ml-2" />
        طباعة خطاب القبول
      </Button>

      {/* Hidden print content */}
      <div ref={printRef} style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div className="page">
          <div className="header">
            <img src={huwaylanLogo} alt="logo" />
            <h1>مجمع حويلان لتحفيظ القرآن الكريم</h1>
            <p>خطاب قبول طالب</p>
          </div>

          <div className="meta">
            <span>الرقم المرجعي: <strong>{refNumber}</strong></span>
            <span>التاريخ: <strong>{dateDisplay}</strong></span>
          </div>

          <div className="letter-body">
            <p>بسم الله الرحمن الرحيم</p>
            <p>الأخ الكريم / <span className="highlight">{guardianName}</span> &nbsp;&nbsp; حفظه الله</p>
            <p>السلام عليكم ورحمة الله وبركاته،،، وبعد:</p>
            <p>
              يسُرّ إدارة مجمع حويلان لتحفيظ القرآن الكريم أن تُبشّركم بقبول ابنكم
              <span className="highlight"> {studentName} </span>
              في المجمع، سائلين الله عز وجل أن يجعله من حفظة كتابه الكريم.
            </p>
          </div>

          <table className="info-table">
            <tbody>
              <tr>
                <td>اسم الطالب</td>
                <td>{studentName}</td>
              </tr>
              <tr>
                <td>ولي الأمر</td>
                <td>{guardianName}</td>
              </tr>
              <tr>
                <td>رقم التواصل</td>
                <td>{guardianPhone}</td>
              </tr>
              <tr>
                <td>الحلقة المعيّنة</td>
                <td>{halaqaName || "سيتم التحديد لاحقاً"}</td>
              </tr>
              <tr>
                <td>تاريخ القبول</td>
                <td>{dateDisplay}</td>
              </tr>
            </tbody>
          </table>

          <div className="instructions">
            <h3>تعليمات مهمة:</h3>
            <ol>
              <li>الالتزام بمواعيد الحلقة المحددة وعدم التأخر.</li>
              <li>إحضار المصحف الشريف والأدوات المطلوبة.</li>
              <li>الالتزام بالسلوك الحسن واحترام المعلمين والزملاء.</li>
              <li>التواصل المستمر مع معلم الحلقة ومتابعة تقدم الطالب.</li>
              <li>إبلاغ الإدارة في حال الغياب مسبقاً.</li>
            </ol>
          </div>

          <div className="signature-area">
            <div className="sig-box">
              <div className="sig-line"></div>
              <div className="sig-label">توقيع ولي الأمر</div>
            </div>
            <div className="stamp-area">
              <div className="stamp-placeholder">ختم المجمع</div>
            </div>
            <div className="sig-box">
              <div className="sig-line"></div>
              <div className="sig-label">مدير المجمع</div>
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

export default AcceptanceLetterTemplate;
