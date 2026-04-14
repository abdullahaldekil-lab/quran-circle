import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { formatHijriArabic, formatDateHijriOnly } from "@/lib/hijri";

interface Props {
  enrollment: any;
  dailyProgress: any[];
  mistakes: any[];
  exam: any;
  onClose: () => void;
}

const FollowUpPrintTemplate = ({ enrollment, dailyProgress, mistakes, exam, onClose }: Props) => {
  const studentName = (enrollment.students as any)?.full_name || "—";
  const halaqaName = (enrollment.students as any)?.halaqat?.name || "—";
  const trackName = (enrollment.madarij_tracks as any)?.name || "—";
  const daysRequired = (enrollment.madarij_tracks as any)?.days_required || 0;

  const handlePrint = () => window.print();

  return (
    <div className="bg-background min-h-screen">
      {/* Controls - hidden on print */}
      <div className="print:hidden flex items-center gap-2 p-4 border-b sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        <Button onClick={handlePrint}>طباعة</Button>
      </div>

      {/* Print content */}
      <div className="p-6 max-w-[210mm] mx-auto print:p-4 print:max-w-none" dir="rtl">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; top: 0; right: 0; width: 100%; }
            .print\\:hidden { display: none !important; }
            table { border-collapse: collapse; width: 100%; font-size: 10px; }
            th, td { border: 1px solid #333 !important; padding: 3px 6px; text-align: center; }
            th { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>

        <div className="print-area space-y-4">
          {/* Header */}
          <div className="text-center space-y-1 border-b pb-3">
            <h1 className="text-xl font-bold">برنامج مَدارج — مجمع حويلان</h1>
            <h2 className="text-lg font-semibold">نموذج المتابعة اليومية</h2>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-4 gap-2 text-sm border p-3 rounded">
            <div><strong>الطالب:</strong> {studentName}</div>
            <div><strong>الحلقة:</strong> {halaqaName}</div>
            <div><strong>المسار:</strong> {trackName}</div>
            <div><strong>الأيام المطلوبة:</strong> {daysRequired}</div>
            <div><strong>الجزء:</strong> {enrollment.part_number}</div>
            <div><strong>الحزب:</strong> {enrollment.hizb_number}</div>
            <div><strong>الفرع:</strong> {enrollment.branch_id ? "محدد" : "—"}</div>
            <div><strong>البداية:</strong> {formatDateHijriOnly(enrollment.start_date)}</div>
          </div>

          {/* Daily Progress Table */}
          <div>
            <h3 className="font-bold text-sm mb-1">جدول المتابعة اليومية</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-1">اليوم</th>
                  <th className="border p-1">التاريخ</th>
                  <th className="border p-1">الحفظ</th>
                  <th className="border p-1">الاستماع</th>
                  <th className="border p-1">الربط</th>
                  <th className="border p-1">الأخطاء</th>
                  <th className="border p-1">تكرار قبل</th>
                  <th className="border p-1">تكرار بعد</th>
                  <th className="border p-1">المراجعة</th>
                  <th className="border p-1">الدرجة</th>
                  <th className="border p-1">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {dailyProgress.length > 0 ? dailyProgress.map((dp, idx) => (
                  <tr key={dp.id}>
                    <td className="border p-1">{idx + 1}</td>
                    <td className="border p-1">{formatDateHijriOnly(dp.progress_date)}</td>
                    <td className="border p-1">{dp.memorization || ""}</td>
                    <td className="border p-1">{dp.listening ?? 0}</td>
                    <td className="border p-1">{dp.linking || ""}</td>
                    <td className="border p-1">{dp.mistakes_count ?? 0}</td>
                    <td className="border p-1">{dp.repetition_before ?? 0}</td>
                    <td className="border p-1">{dp.repetition_after ?? 0}</td>
                    <td className="border p-1">{dp.review || ""}</td>
                    <td className="border p-1">{dp.grade ?? 0}</td>
                    <td className="border p-1">{dp.execution === "completed" || dp.execution === "تم" ? "✓" : dp.execution === "absent" || dp.execution === "غياب" ? "غ" : "—"}</td>
                  </tr>
                )) : (
                  Array.from({ length: daysRequired || 15 }).map((_, i) => (
                    <tr key={i}>
                      <td className="border p-1">{i + 1}</td>
                      {Array.from({ length: 10 }).map((_, j) => <td key={j} className="border p-1">&nbsp;</td>)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mistakes Table */}
          <div>
            <h3 className="font-bold text-sm mb-1">تدوين الأخطاء والألحان</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-1">#</th>
                  <th className="border p-1">الخطأ أو اللحن</th>
                  <th className="border p-1">السورة</th>
                  <th className="border p-1">الآية</th>
                </tr>
              </thead>
              <tbody>
                {mistakes.length > 0 ? mistakes.map((m, i) => (
                  <tr key={m.id}>
                    <td className="border p-1">{i + 1}</td>
                    <td className="border p-1">{m.mistake_text}</td>
                    <td className="border p-1">{m.surah}</td>
                    <td className="border p-1">{m.ayah}</td>
                  </tr>
                )) : (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i}>
                      <td className="border p-1">{i + 1}</td>
                      <td className="border p-1">&nbsp;</td>
                      <td className="border p-1">&nbsp;</td>
                      <td className="border p-1">&nbsp;</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Exam Section */}
          <div>
            <h3 className="font-bold text-sm mb-1">اختبار نهاية الحزب</h3>
            <div className="text-xs mb-2 space-y-1">
              <p>• يقرأ الطالب (5) مقاطع عشوائية من الحزب.</p>
              <p>• كل خطأ يخصم (10) درجات، وكل تنبيه يخصم (3) درجات.</p>
              <p>• يضاف نصف درجة لكل يوم سبق فيه الخطة.</p>
              <p>• النجاح يتطلب: المجموع ≥ 80 واختبار الحفظ ≥ 40.</p>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-1">المقطع</th>
                  <th className="border p-1">الأخطاء</th>
                  <th className="border p-1">التنبيهات</th>
                  <th className="border p-1">الدرجة</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td className="border p-1">{i}</td>
                    <td className="border p-1">{exam ? exam[`segment${i}_errors`] : ""}</td>
                    <td className="border p-1">{exam ? exam[`segment${i}_warnings`] : ""}</td>
                    <td className="border p-1">{exam ? exam[`segment${i}_grade`] : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {exam && (
              <div className="grid grid-cols-4 gap-2 text-xs mt-2 border p-2 rounded">
                <div><strong>مجموع المراجعة:</strong> {exam.review_total}</div>
                <div><strong>اختبار الحفظ:</strong> {exam.memorization_grade}</div>
                <div><strong>درجات إضافية:</strong> {exam.extra_points}</div>
                <div><strong>المجموع النهائي:</strong> {exam.final_grade}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="grid grid-cols-3 gap-4 text-xs border-t pt-3 mt-4">
            <div className="text-center">
              <p className="font-bold">اسم المختبر</p>
              <p className="border-b mt-4 pb-1">{exam?.examiner_name || ""}</p>
            </div>
            <div className="text-center">
              <p className="font-bold">اعتماد الإشراف التعليمي</p>
              <p className="border-b mt-4 pb-1">{exam?.supervisor_approval || ""}</p>
            </div>
            <div className="text-center">
              <p className="font-bold">تاريخ الاجتياز</p>
              <p className="border-b mt-4 pb-1">{exam?.pass_date || ""}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowUpPrintTemplate;
