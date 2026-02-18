import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";

interface StudentResult {
  student_id: string;
  student_name: string;
  hizb_from: number;
  hizb_to: number;
  mistakes_count: number;
  lahn_count: number;
  warnings_count: number;
  grade: number;
  status: "pass" | "fail" | "absent" | "pending";
  notes: string;
  manual_entry: boolean;
}

interface NarrationSettings {
  min_grade: number;
  max_grade: number;
  deduction_per_mistake: number;
  deduction_per_lahn: number;
  deduction_per_warning: number;
}

interface Props {
  session: {
    id: string;
    session_date: string;
    title: string | null;
    notes: string | null;
    halaqat?: { name: string; teacher_id: string | null } | null;
  };
  rows: StudentResult[];
  settings?: NarrationSettings;
}

export default function NarrationPrintTemplate({ session, rows, settings }: Props) {
  const presented = rows.filter((r) => r.status !== "absent" && r.status !== "pending");
  const passed = rows.filter((r) => r.status === "pass");
  const failed = rows.filter((r) => r.status === "fail");
  const absent = rows.filter((r) => r.status === "absent");

  const totalHizbRequired = presented.reduce(
    (sum, r) => sum + (r.hizb_to - r.hizb_from + 1),
    0
  );
  const totalHizbPresented = presented.reduce(
    (sum, r) => sum + (r.hizb_to - r.hizb_from + 1),
    0
  );
  const totalHizbPassed = passed.reduce(
    (sum, r) => sum + (r.hizb_to - r.hizb_from + 1),
    0
  );
  const totalHizbFailed = failed.reduce(
    (sum, r) => sum + (r.hizb_to - r.hizb_from + 1),
    0
  );
  const avgGrade =
    presented.length > 0
      ? (presented.reduce((s, r) => s + r.grade, 0) / presented.length).toFixed(1)
      : "—";

  const passRate =
    totalHizbRequired > 0
      ? Math.round((totalHizbPassed / totalHizbRequired) * 100)
      : 0;

  return (
    <div
      className="font-sans text-sm"
      style={{ fontFamily: "Arial, sans-serif", color: "#1a1a1a", direction: "rtl" }}
    >
      {/* رأس الصفحة */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #1a1a1a", paddingBottom: "12px", marginBottom: "16px" }}>
        <img src={huwaylanLogo} alt="مجمع حويلان" style={{ width: "60px", height: "60px", objectFit: "contain", margin: "0 auto 8px" }} />
        <h1 style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 4px" }}>مجمع حويلان لتحفيظ القرآن الكريم</h1>
        <h2 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 8px", color: "#2563eb" }}>يوم السرد القرآني</h2>
        <div style={{ display: "flex", justifyContent: "center", gap: "32px", fontSize: "12px", color: "#555" }}>
          <span>التاريخ: {new Date(session.session_date).toLocaleDateString("ar-SA")}</span>
          {session.halaqat?.name && <span>الحلقة: {session.halaqat.name}</span>}
          {session.title && <span>العنوان: {session.title}</span>}
        </div>
      </div>

      {/* جدول الملخص الإحصائي */}
      <h3 style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>ملخص الجلسة</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "12px" }}>
        <thead>
          <tr style={{ backgroundColor: "#1e3a5f", color: "#fff" }}>
            <th style={thStyle}>الحلقة</th>
            <th style={thStyle}>الحضور</th>
            <th style={thStyle}>المطلوبة</th>
            <th style={thStyle}>المعروضة</th>
            <th style={thStyle}>المجتازة</th>
            <th style={thStyle}>الرسوب</th>
            <th style={thStyle}>الغياب</th>
            <th style={thStyle}>% الاجتياز</th>
            <th style={thStyle}>متوسط الدرجة</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ backgroundColor: "#f0f9ff" }}>
            <td style={tdStyle}>{session.halaqat?.name || "—"}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{presented.length}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{totalHizbRequired}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{totalHizbPresented}</td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#16a34a", fontWeight: "bold" }}>{totalHizbPassed}</td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#dc2626", fontWeight: "bold" }}>{totalHizbFailed}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{absent.length}</td>
            <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold" }}>{passRate}%</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{avgGrade}</td>
          </tr>
        </tbody>
      </table>

      {/* جدول تفاصيل الطلاب */}
      <h3 style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>تفاصيل نتائج الطلاب</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ backgroundColor: "#374151", color: "#fff" }}>
            <th style={thStyle}>#</th>
            <th style={thStyle}>اسم الطالب</th>
            <th style={thStyle}>من حزب</th>
            <th style={thStyle}>إلى حزب</th>
            <th style={thStyle}>الأخطاء</th>
            <th style={thStyle}>اللحون</th>
            <th style={thStyle}>التنبيهات</th>
            <th style={thStyle}>الدرجة</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.student_id}
              style={{
                backgroundColor:
                  r.status === "absent"
                    ? "#f3f4f6"
                    : r.status === "pass"
                    ? "#f0fdf4"
                    : r.status === "fail"
                    ? "#fef2f2"
                    : "#fff",
              }}
            >
              <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
              <td style={{ ...tdStyle, fontWeight: "500" }}>{r.student_name}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.hizb_from}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.hizb_to}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.mistakes_count}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.lahn_count}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.warnings_count}</td>
              <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold", color: r.status === "pass" ? "#16a34a" : r.status === "fail" ? "#dc2626" : "#374151" }}>
                {r.status === "absent" ? "—" : r.grade}
              </td>
              <td style={{ ...tdStyle, textAlign: "center" }}>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor:
                      r.status === "pass"
                        ? "#dcfce7"
                        : r.status === "fail"
                        ? "#fee2e2"
                        : r.status === "absent"
                        ? "#e5e7eb"
                        : "#fef9c3",
                    color:
                      r.status === "pass"
                        ? "#15803d"
                        : r.status === "fail"
                        ? "#b91c1c"
                        : r.status === "absent"
                        ? "#6b7280"
                        : "#854d0e",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  {r.status === "pass"
                    ? "ناجح"
                    : r.status === "fail"
                    ? "راسب"
                    : r.status === "absent"
                    ? "غائب"
                    : "معلّق"}
                </span>
              </td>
              <td style={{ ...tdStyle, color: "#6b7280", fontSize: "10px" }}>{r.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* تذييل */}
      <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6b7280" }}>
        <div>
          <p style={{ marginBottom: "4px" }}>توقيع المعلم: ___________________</p>
          {settings && (
            <p style={{ marginTop: "8px", color: "#9ca3af" }}>
              معيار الاجتياز: {settings.min_grade} / {settings.max_grade}
              {" | "}خصم خطأ: {settings.deduction_per_mistake}
              {" | "}خصم لحن: {settings.deduction_per_lahn}
              {" | "}خصم تنبيه: {settings.deduction_per_warning}
            </p>
          )}
        </div>
        <div style={{ textAlign: "left" }}>
          <p>توقيع المشرف: ___________________</p>
        </div>
      </div>
    </div>
  );
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
