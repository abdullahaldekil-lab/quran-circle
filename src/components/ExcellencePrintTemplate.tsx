import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import { formatDateSmart } from "@/lib/hijri";

interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  student_id: string;
  is_present: boolean;
  notes: string;
}

interface PerformanceRecord {
  student_id: string;
  pages_displayed: number;
  hizb_count: number;
  mistakes_count: number;
  warnings_count: number;
  lahon_count: number;
  total_score: number;
  rank_in_group: number | null;
}

interface Props {
  session: {
    session_date: string;
    halaqat?: { name: string } | null;
    total_hizb_in_session?: number;
    total_pages_displayed?: number;
    notes?: string | null;
  };
  students: Student[];
  attendance: Record<string, AttendanceRecord>;
  rankedPerformance: PerformanceRecord[];
}

const thStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid #d1d5db",
  textAlign: "right",
  fontWeight: "bold",
  fontSize: "11px",
};
const tdStyle: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #e5e7eb",
};

export default function ExcellencePrintTemplate({ session, students, attendance, rankedPerformance }: Props) {
  const presentCount = Object.values(attendance).filter((a) => a.is_present).length;
  const absentCount = students.length - presentCount;
  const totalHizb = rankedPerformance.reduce((s, p) => s + p.hizb_count, 0);
  const totalPages = rankedPerformance.reduce((s, p) => s + p.pages_displayed, 0);
  const avgScore = rankedPerformance.length > 0
    ? (rankedPerformance.reduce((s, p) => s + p.total_score, 0) / rankedPerformance.length).toFixed(1)
    : "—";

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#1a1a1a", direction: "rtl", fontSize: "12px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #1a1a1a", paddingBottom: "12px", marginBottom: "16px" }}>
        <img src={huwaylanLogo} alt="مجمع حويلان" style={{ width: "60px", height: "60px", objectFit: "contain", margin: "0 auto 8px" }} />
        <h1 style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 4px" }}>مجمع حويلان لتحفيظ القرآن الكريم</h1>
        <h2 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 8px", color: "#b45309" }}>تقرير مسار التميّز</h2>
        <div style={{ display: "flex", justifyContent: "center", gap: "32px", fontSize: "12px", color: "#555" }}>
          <span>التاريخ: {formatDateSmart(session.session_date)}</span>
          {session.halaqat?.name && <span>الحلقة: {session.halaqat.name}</span>}
        </div>
      </div>

      {/* Summary */}
      <h3 style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>ملخص الجلسة</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
        <thead>
          <tr style={{ backgroundColor: "#92400e", color: "#fff" }}>
            <th style={thStyle}>الحاضرون</th>
            <th style={thStyle}>الغائبون</th>
            <th style={thStyle}>إجمالي الأحزاب</th>
            <th style={thStyle}>إجمالي الأوجه</th>
            <th style={thStyle}>متوسط الدرجة</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ backgroundColor: "#fffbeb" }}>
            <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold" }}>{presentCount}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{absentCount}</td>
            <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold" }}>{totalHizb}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{totalPages}</td>
            <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold" }}>{avgScore}</td>
          </tr>
        </tbody>
      </table>

      {/* Ranked Performance */}
      <h3 style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>ترتيب الطلاب</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ backgroundColor: "#374151", color: "#fff" }}>
            <th style={thStyle}>الترتيب</th>
            <th style={thStyle}>اسم الطالب</th>
            <th style={thStyle}>الأوجه</th>
            <th style={thStyle}>الأحزاب</th>
            <th style={thStyle}>الأخطاء</th>
            <th style={thStyle}>اللحون</th>
            <th style={thStyle}>التنبيهات</th>
            <th style={thStyle}>الدرجة</th>
          </tr>
        </thead>
        <tbody>
          {rankedPerformance.map((p) => {
            const s = students.find((st) => st.id === p.student_id);
            return (
              <tr key={p.student_id} style={{ backgroundColor: p.rank_in_group === 1 ? "#fef3c7" : "#fff" }}>
                <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold" }}>{p.rank_in_group}</td>
                <td style={{ ...tdStyle, fontWeight: "500" }}>{s?.full_name || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{p.pages_displayed}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{p.hizb_count}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{p.mistakes_count}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{p.lahon_count}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{p.warnings_count}</td>
                <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold", color: p.total_score >= 90 ? "#16a34a" : p.total_score >= 70 ? "#d97706" : "#dc2626" }}>
                  {p.total_score.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6b7280" }}>
        <p>توقيع المعلم: ___________________</p>
        <p>توقيع المشرف: ___________________</p>
      </div>
    </div>
  );
}
