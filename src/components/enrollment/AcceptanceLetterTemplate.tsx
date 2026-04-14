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
          @page { size: A4; margin: 20mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 14px; line-height: 1.8; direction: rtl; color: #1a1a1a; }
          .page { max-width: 700px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px double #b8860b; }
          .header img { width: 70px; height: 70px; border-radius: 12px; object-fit: contain; }
          .header h1 { font-size: 20px; color: #1a365d; margin: 8px 0 2px; }
          .header p { font-size: 12px; color: #666; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; color: #555; }
          .letter-body { margin: 24px 0; font-size: 15px; line-height: 2; }
          .letter-body p { margin-bottom: 12px; }
          .highlight { color: #1a365d; font-weight: 700; }
          .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          .info-table td { padding: 8px 12px; border: 1px solid #ddd; font-size: 13px; }
          .info-table td:first-child { background: #f0f4f8; font-weight: 600; color: #1a365d; width: 140px; }
          .instructions { background: #fafaf8; border: 1px solid #e2e2d8; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 12px; line-height: 2; }
          .instructions h3 { font-size: 13px; color: #1a365d; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          .instructions li { margin-right: 16px; }
          .signature-area { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px; }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 4px; }
          .sig-label { font-size: 11px; color: #666; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; border-top: 2px solid #b8860b; padding-top: 10px; }
          .stamp-area { text-align: center; margin-top: 10px; }
          .stamp-placeholder { display: inline-block; width: 80px; height: 80px; border: 2px dashed #b8860b; border-radius: 50%; line-height: 80px; font-size: 10px; color: #b8860b; }
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
            <span>الرقم المرجعي: {refNumber}</span>
            <span>التاريخ: {dateDisplay}</span>
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
