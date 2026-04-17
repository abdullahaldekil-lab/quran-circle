import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { formatDateHijriOnly } from "@/lib/hijri";

interface MadarijPrintTemplateProps {
  enrollment: any;
  dailyProgress: any[];
  mistakes: any[];
  exam: any;
  onClose: () => void;
}

const MadarijPrintTemplate = ({ enrollment, dailyProgress, mistakes, exam, onClose }: MadarijPrintTemplateProps) => {
  const handlePrint = () => window.print();

  const studentName = (enrollment.students as any)?.full_name || "";
  const halaqaName = (enrollment.students as any)?.halaqat?.name || "";
  const trackName = (enrollment.madarij_tracks as any)?.name || "";
  const daysRequired = (enrollment.madarij_tracks as any)?.days_required || 0;

  return (
    <div>
      {/* Screen controls */}
      <div className="print:hidden flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowRight className="w-4 h-4 ml-1" />
          رجوع
        </Button>
        <Button onClick={handlePrint}>طباعة</Button>
      </div>

      {/* Print content */}
      <div className="print:block bg-white text-black p-6 print:p-4 max-w-[210mm] mx-auto text-sm" dir="rtl" style={{ fontFamily: "Arial, sans-serif" }}>
        {/* Page 1: Header + Daily Progress */}
        <div className="print:break-after-page">
          <div className="text-center mb-4 border-b-2 border-black pb-3">
            <h1 className="text-xl font-bold">برنامج مدارج</h1>
            <p className="text-sm">طريقك نحو إتقان القرآن الكريم</p>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 gap-2 mb-4 text-xs border border-black p-2">
            <div>اسم الطالب: <strong>{studentName}</strong></div>
            <div>الحلقة: <strong>{halaqaName}</strong></div>
          </div>

          {/* Track Info */}
          <table className="w-full border-collapse border border-black mb-4 text-xs">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-1">المسار</th>
                <th className="border border-black p-1">الجزء</th>
                <th className="border border-black p-1">الحزب</th>
                <th className="border border-black p-1">الأيام</th>
                <th className="border border-black p-1">تاريخ البداية</th>
                <th className="border border-black p-1">تاريخ النهاية</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1 text-center">{trackName}</td>
                <td className="border border-black p-1 text-center">{enrollment.part_number}</td>
                <td className="border border-black p-1 text-center">{enrollment.hizb_number}</td>
                <td className="border border-black p-1 text-center">{daysRequired}</td>
                <td className="border border-black p-1 text-center">{formatDateHijriOnly(enrollment.start_date)}</td>
                <td className="border border-black p-1 text-center">{enrollment.end_date ? formatDateHijriOnly(enrollment.end_date) : "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* Daily Progress Table */}
          <h3 className="font-bold text-sm mb-2">جدول المتابعة اليومية</h3>
          <table className="w-full border-collapse border border-black text-[10px]">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-1">م</th>
                <th className="border border-black p-1">التاريخ</th>
                <th className="border border-black p-1">الحفظ</th>
                <th className="border border-black p-1">الاستماع</th>
                <th className="border border-black p-1">تكرار قبل</th>
                <th className="border border-black p-1">تكرار بعد</th>
                <th className="border border-black p-1">الدرجة</th>
                <th className="border border-black p-1">الربط</th>
                <th className="border border-black p-1">الأخطاء</th>
                <th className="border border-black p-1">المراجعة</th>
                <th className="border border-black p-1">التنفيذ</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(daysRequired, dailyProgress.length) }).map((_, i) => {
                const dp = dailyProgress[i];
                return (
                  <tr key={i}>
                    <td className="border border-black p-1 text-center">{i + 1}</td>
                    <td className="border border-black p-1 text-center">{dp?.progress_date ? formatDateHijriOnly(dp.progress_date) : ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.memorization || ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.listening ?? ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.repetition_before ?? ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.repetition_after ?? ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.grade ?? ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.linking || ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.mistakes_count ?? ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.review || ""}</td>
                    <td className="border border-black p-1 text-center">{dp?.execution || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Page 2: Mistakes + Exam */}
        <div>
          {/* Mistakes Table */}
          <h3 className="font-bold text-sm mb-2">تدوين الأخطاء والألحان</h3>
          <table className="w-full border-collapse border border-black text-xs mb-4">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-1">م</th>
                <th className="border border-black p-1">الخطأ أو اللحن</th>
                <th className="border border-black p-1">السورة</th>
                <th className="border border-black p-1">الآية</th>
              </tr>
            </thead>
            <tbody>
              {(mistakes.length === 0 ? Array.from({ length: 10 }) : mistakes).map((m, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{i + 1}</td>
                  <td className="border border-black p-1">{m?.mistake_text || ""}</td>
                  <td className="border border-black p-1 text-center">{m?.surah || ""}</td>
                  <td className="border border-black p-1 text-center">{m?.ayah || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Exam Rules */}
          <div className="border border-black p-2 mb-4 text-xs">
            <h4 className="font-bold mb-1">آلية اختبار الحزب:</h4>
            <ol className="list-decimal pr-4 space-y-0.5">
              <li>يُقسم الحزب إلى 5 مقاطع متساوية</li>
              <li>يُختبر الطالب في كل مقطع على حدة</li>
              <li>تُحسب الأخطاء والتنبيهات لكل مقطع</li>
              <li>يجب الحصول على 40 درجة كحد أدنى للاجتياز</li>
            </ol>
          </div>

          {/* Exam Table */}
          <h3 className="font-bold text-sm mb-2">اختبار نهاية الحزب</h3>
          <table className="w-full border-collapse border border-black text-xs mb-3">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-1">المقطع</th>
                <th className="border border-black p-1">عدد الأخطاء</th>
                <th className="border border-black p-1">عدد التنبيهات</th>
                <th className="border border-black p-1">الدرجة</th>
              </tr>
            </thead>
            <tbody>
              {[1,2,3,4,5].map((i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">المقطع {i}</td>
                  <td className="border border-black p-1 text-center">{exam?.[`segment${i}_errors`] ?? ""}</td>
                  <td className="border border-black p-1 text-center">{exam?.[`segment${i}_warnings`] ?? ""}</td>
                  <td className="border border-black p-1 text-center">{exam?.[`segment${i}_grade`] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Exam Summary */}
          <table className="w-full border-collapse border border-black text-xs mb-3">
            <tbody>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-200">مجموع اختبار المراجعة</td>
                <td className="border border-black p-1 text-center">{exam?.review_total ?? ""}</td>
                <td className="border border-black p-1 font-bold bg-gray-200">اختبار الحفظ</td>
                <td className="border border-black p-1 text-center">{exam?.memorization_grade ?? ""}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-200">الدرجات الإضافية</td>
                <td className="border border-black p-1 text-center">{exam?.extra_points ?? ""}</td>
                <td className="border border-black p-1 font-bold bg-gray-200">المجموع النهائي</td>
                <td className="border border-black p-1 text-center font-bold">{exam?.final_grade ?? ""}</td>
              </tr>
            </tbody>
          </table>

          {/* Approval */}
          <table className="w-full border-collapse border border-black text-xs">
            <tbody>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-200">تاريخ الاجتياز</td>
                <td className="border border-black p-1 text-center">{exam?.pass_date ?? ""}</td>
                <td className="border border-black p-1 font-bold bg-gray-200">اسم المختبر</td>
                <td className="border border-black p-1 text-center">{exam?.examiner_name ?? ""}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-200">اعتماد الإشراف التعليمي</td>
                <td className="border border-black p-1 text-center" colSpan={3}>{exam?.supervisor_approval ?? ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MadarijPrintTemplate;
