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

  // Helper: resolve boolean field from multiple possible formats
  const bool = (key: string): boolean => {
    const v = (fd[key] || "").toLowerCase();
    return v === "true" || v === "نعم" || v === "yes";
  };

  // Helper: radio circle
  const rc = (checked: boolean) => checked ? "●" : "○";

  // Determine individual health conditions
  const hasIndividualHealth = Object.keys(fd).some(k => k.startsWith("has_") && k !== "has_chronic_diseases" && k !== "has_medications" && k !== "has_allergies");

  const healthConditions = [
    { key: "has_diabetes",           label: "السكري" },
    { key: "has_hearing_impairment", label: "ضعف السمع" },
    { key: "has_asthma",             label: "الربو" },
    { key: "has_epilepsy",           label: "نوبات الصرع" },
    { key: "has_vision_impairment",  label: "ضعف البصر" },
    { key: "has_anemia",             label: "فقر الدم" },
    { key: "has_hypertension",       label: "ارتفاع ضغط الدم" },
    { key: "has_chest_sensitivity",  label: "حساسية الصدر" },
    { key: "has_frequent_urination", label: "كثرة التبول" },
  ];

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
          @page { size: A4; margin: 12mm 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.6; direction: rtl; color: #1a1a1a; }

          .page-break { page-break-after: always; break-after: page; }

          /* ─── Header ─── */
          .header { text-align: center; padding-bottom: 10px; border-bottom: 3px double #b8860b; margin-bottom: 12px; }
          .header-inner { display: flex; align-items: center; justify-content: center; gap: 14px; }
          .header img { width: 60px; height: 60px; border-radius: 10px; object-fit: contain; }
          .header-text h1 { font-size: 17px; color: #1a365d; font-weight: 700; }
          .header-text p { font-size: 10px; color: #666; margin-top: 2px; }
          .header-sub { font-size: 13px; font-weight: 700; color: #8b6914; margin-top: 6px; }

          .meta-row { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #e8e8e8; padding-bottom: 5px; }

          /* ─── Acceptance letter ─── */
          .letter-body { font-size: 12px; line-height: 2; margin: 10px 0 12px; }
          .letter-body p { margin-bottom: 6px; }
          .highlight { color: #1a365d; font-weight: 700; }
          .info-table { width: 100%; border-collapse: collapse; margin: 10px 0 12px; }
          .info-table td { padding: 6px 10px; border: 1px solid #d0d0c0; font-size: 11px; }
          .info-table td:first-child { background: #f0f4f8; font-weight: 600; color: #1a365d; width: 130px; }
          .instructions { background: #fafaf8; border: 1px solid #e2e2d0; border-radius: 6px; padding: 9px 12px; font-size: 10.5px; line-height: 1.85; }
          .instructions h3 { font-size: 11px; color: #1a365d; font-weight: 700; margin-bottom: 4px; }
          .instructions ol { padding-right: 16px; }
          .instructions li { margin-bottom: 2px; }

          /* ─── Signature ─── */
          .signature-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc; }
          .sig-box { text-align: center; width: 150px; }
          .sig-line { border-bottom: 1px solid #333; height: 40px; margin-bottom: 4px; }
          .sig-label { font-size: 10px; color: #555; font-weight: 600; }
          .stamp-circle { width: 72px; height: 72px; border: 2px dashed #b8860b; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 10px; color: #b8860b; text-align: center; padding: 8px; }

          /* ─── Registration form tables ─── */
          .reg-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
          .reg-table td, .reg-table th { border: 1px solid #000; padding: 4px 6px; font-size: 10.5px; }
          .section-header { background: #d0d0d0; font-weight: bold; text-align: center; font-size: 11px; }
          .field-label { font-weight: 600; background: #f5f5f5; width: 120px; }
          .id-boxes { display: flex; flex-direction: row-reverse; gap: 2px; }
          .id-box { border: 1px solid #000; width: 16px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; }
          .health-header { background: #e8e8e8; font-weight: bold; text-align: center; }

          /* ─── Commitments ─── */
          .commitments { border: 1px solid #d8d8c8; padding: 8px 10px; font-size: 10px; line-height: 1.85; margin: 6px 0; }

          .footer { text-align: center; margin-top: 12px; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  // ID digit boxes renderer
  const IdBoxes = ({ value }: { value?: string }) => {
    const digits = Array.from({ length: 10 }, (_, i) => (value || "")[i] || "");
    return (
      <div className="id-boxes">
        {digits.map((d, i) => <div key={i} className="id-box">{d}</div>)}
      </div>
    );
  };

  const livesWithVal = fd.living_with || fd.lives_with || "";
  const fatherAlive = fd.father_alive ? bool("father_alive") : !fd.parents_status?.includes("الأب متوفى");
  const motherAlive = fd.mother_alive ? bool("mother_alive") : !fd.parents_status?.includes("الأم متوفاة");
  const prevEnrolled = fd.previous_enrollment === "نعم" || bool("previously_enrolled");

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
            <div className="sig-box"><div className="sig-line" /><div className="sig-label">توقيع ولي الأمر</div></div>
            <div><div className="stamp-circle">ختم<br />المجمع</div></div>
            <div className="sig-box"><div className="sig-line" /><div className="sig-label">مدير المجمع</div></div>
          </div>
          <div className="footer">مجمع حويلان لتحفيظ القرآن الكريم — جميع الحقوق محفوظة</div>
        </div>

        {/* ══════════════════════════════════════
            الصفحة الثانية — استمارة التسجيل
        ══════════════════════════════════════ */}
        <div>
          {/* Header */}
          <div className="header">
            <div className="header-inner">
              <img src={huwaylanLogo} alt="شعار المجمع" />
              <div className="header-text">
                <h1>مجمع حويلان لتحفيظ القرآن الكريم</h1>
                <p>الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة — ترخيص رقم (٦ / م ٢٦)</p>
              </div>
            </div>
            <div className="header-sub">استمارة تسجيل طالب بالمجمع</div>
          </div>

          {/* ── القسم الأول: خاص بالطالب ── */}
          <table className="reg-table">
            <tbody>
              <tr><td colSpan={6} className="section-header">خاص بالطالب</td></tr>
              <tr>
                <td colSpan={3}>
                  <div>رقم السجل المدني</div>
                  <IdBoxes value={fd.student_id_number} />
                </td>
                <td colSpan={3}><strong>اسم الطالب رباعي: </strong>{studentName}</td>
              </tr>
              <tr>
                <td colSpan={2}><strong>الجنسية: </strong>{fd.student_nationality || "—"}</td>
                <td colSpan={2}><strong>العمر: </strong>{fd.student_age || "—"}</td>
                <td colSpan={2}><strong>تاريخ الميلاد: </strong>{birthHijri}</td>
              </tr>
              <tr>
                <td colSpan={2}><strong>اسم المدرسة: </strong>{fd.student_school || "—"}</td>
                <td colSpan={2}><strong>مقدار الحفظ: </strong>{fd.memorization_amount || "—"}</td>
                <td colSpan={2}><strong>الصف: </strong>{fd.student_grade || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* ── القسم الثاني: البيانات الاجتماعية ── */}
          <table className="reg-table">
            <tbody>
              <tr><td colSpan={4} className="section-header">البيانات الاجتماعية للطالب</td></tr>
              <tr>
                <td>
                  <strong>غيرهما: </strong>
                  {livesWithVal === "غيرهما" ? (fd.lives_with_other || "..........") : ".........."}
                </td>
                <td>
                  <strong>مع من يسكن: </strong>
                  {["الوالدين","الأب","الأم","غيرهما"].map(opt => (
                    <span key={opt} style={{ marginLeft: 6 }}>{rc(livesWithVal === opt || (opt === "الوالدين" && !livesWithVal))} {opt}</span>
                  ))}
                </td>
                <td>
                  <strong>هل الأم على قيد الحياة: </strong>
                  <span style={{ marginLeft: 4 }}>{rc(motherAlive)} نعم</span>
                  <span style={{ marginRight: 4 }}>{rc(!motherAlive)} لا</span>
                </td>
                <td>
                  <strong>هل الأب على قيد الحياة: </strong>
                  <span style={{ marginLeft: 4 }}>{rc(fatherAlive)} نعم</span>
                  <span style={{ marginRight: 4 }}>{rc(!fatherAlive)} لا</span>
                </td>
              </tr>
              <tr>
                <td colSpan={2}><strong>موقع السكن: </strong>{fd.residence_location || fd.guardian_address || "—"}</td>
                <td colSpan={2}><strong>مع من يحضر للمجمع: </strong>{fd.accompanied_by || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* ── القسم الثالث: الحالة الصحية ── */}
          <table className="reg-table">
            <tbody>
              <tr><td colSpan={9} className="section-header">الحالة الصحية للطالب</td></tr>
              <tr>
                <td colSpan={9} style={{ background: "#f5f5f5" }}>هل يعاني الطالب من الأمراض المزمنة التالية:</td>
              </tr>
              <tr>
                <th className="health-header">المرض</th><th className="health-header">نعم</th><th className="health-header">لا</th>
                <th className="health-header">المرض</th><th className="health-header">نعم</th><th className="health-header">لا</th>
                <th className="health-header">المرض</th><th className="health-header">نعم</th><th className="health-header">لا</th>
              </tr>
              {[0, 1, 2].map(row => (
                <tr key={row}>
                  {[0, 1, 2].map(col => {
                    const item = healthConditions[row * 3 + col];
                    const val = hasIndividualHealth
                      ? bool(item.key)
                      : (fd.has_chronic_diseases === "نعم" && fd.chronic_diseases_details?.includes(item.label));
                    return (
                      <>
                        <td key={item.key + "l"}>{item.label}</td>
                        <td key={item.key + "y"} style={{ textAlign: "center" }}>{val ? "●" : ""}</td>
                        <td key={item.key + "n"} style={{ textAlign: "center" }}>{!val ? "●" : ""}</td>
                      </>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td colSpan={9}>
                  <strong>أي أمراض أخرى أو حالات صحية يلزم العناية بها: </strong>
                  {fd.other_health_conditions || (fd.has_chronic_diseases === "نعم" ? fd.chronic_diseases_details : "") || ""}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── القسم الرابع: خاص بولي الأمر ── */}
          <table className="reg-table">
            <tbody>
              <tr><td colSpan={4} className="section-header">خاص بولي الأمر</td></tr>
              <tr>
                <td colSpan={2}>
                  <div>رقم السجل المدني</div>
                  <IdBoxes value={fd.guardian_id_number} />
                </td>
                <td colSpan={2}><strong>اسم ولي الأمر رباعي: </strong>{guardianName}</td>
              </tr>
              <tr>
                <td colSpan={2}><strong>عمل ولي الأمر: </strong>{fd.guardian_work || "—"}</td>
                <td colSpan={2}><strong>صلة القرابة بالطالب: </strong>{fd.guardian_relationship || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* ── القسم الخامس: بيانات الاتصال ── */}
          <table className="reg-table">
            <tbody>
              <tr><td colSpan={4} className="section-header">بيانات الاتصال</td></tr>
              <tr>
                <td colSpan={2}><strong>جوال الطالب: </strong>{fd.student_phone || "—"}</td>
                <td colSpan={2}><strong>جوال ولي الأمر: </strong>{guardianPhone}</td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <strong>هل سبق التسجيل في حلقة: </strong>
                  <span style={{ marginLeft: 6 }}>{rc(!prevEnrolled)} لا</span>
                  <span style={{ marginRight: 6 }}>{rc(prevEnrolled)} نعم</span>
                </td>
                <td colSpan={2}><strong>جوال آخر للتواصل: </strong>{fd.guardian_phone_alt || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* التعهدات */}
          <div className="commitments">
            أتعهد أنا ولي أمر الطالب / <strong>{guardianName}</strong> بأن أكون متابعاً لسير دراسة ابني بالمجمع،
            ومتعاوناً مع إدارة المجمع في كل ما يخص ابني دراسياً وسلوكياً وانتظاماً، وأتعهد بأن جميع البيانات
            المدخلة بالنموذج صحيحة وأتحمل المسؤولية الكاملة إذا كانت خلاف ذلك.
          </div>

          {/* الذيل */}
          <div className="signature-area">
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">اسم ولي الأمر: {guardianName}</div>
            </div>
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">التوقيع</div>
            </div>
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-label">تاريخ التسجيل: {today}</div>
            </div>
          </div>

          {notes && (
            <div style={{ marginTop: 8, fontSize: 10, borderTop: "1px solid #ccc", paddingTop: 6 }}>
              <strong>ملاحظات: </strong>{notes}
            </div>
          )}

          <div className="footer">مجمع حويلان لتحفيظ القرآن الكريم — جميع الحقوق محفوظة</div>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentCombinedPrint;
