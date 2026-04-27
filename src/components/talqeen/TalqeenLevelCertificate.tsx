import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import { formatDateSmart } from "@/lib/hijri";

interface Props {
  studentName: string;
  curriculumName: string;
  halaqaName?: string;
  promotionScore: number;
  promotionMax: number;
  attendanceScore?: number | null;
  attendanceMax?: number | null;
  homeworkScore?: number | null;
  homeworkMax?: number | null;
  testDate: string;
}

export default function TalqeenLevelCertificate({
  studentName,
  curriculumName,
  halaqaName,
  promotionScore,
  promotionMax,
  attendanceScore,
  attendanceMax,
  homeworkScore,
  homeworkMax,
  testDate,
}: Props) {
  const ScoreBox = ({ label, score, max, color }: { label: string; score: number | null | undefined; max: number | null | undefined; color: string }) => (
    <div style={{ textAlign: "center", padding: "12px 18px", background: "#fff", borderRadius: "8px", border: `1px solid ${color}33`, minWidth: "120px" }}>
      <p style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>{label}</p>
      <p style={{ fontSize: "20px", fontWeight: "bold", color, margin: "4px 0 0" }}>
        {score !== null && score !== undefined ? `${score} / ${max ?? 100}` : "—"}
      </p>
    </div>
  );

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        direction: "rtl",
        width: "750px",
        margin: "0 auto",
        padding: "40px",
        border: "4px double #15803d",
        borderRadius: "14px",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfccb 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative corners */}
      <div style={{ position: "absolute", top: 0, right: 0, width: "90px", height: "90px", borderRight: "5px solid #15803d", borderTop: "5px solid #15803d", borderRadius: "0 12px 0 0" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: "90px", height: "90px", borderLeft: "5px solid #15803d", borderTop: "5px solid #15803d", borderRadius: "12px 0 0 0" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "90px", height: "90px", borderRight: "5px solid #15803d", borderBottom: "5px solid #15803d", borderRadius: "0 0 12px 0" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "90px", height: "90px", borderLeft: "5px solid #15803d", borderBottom: "5px solid #15803d", borderRadius: "0 0 0 12px" }} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <img src={huwaylanLogo} alt="شعار" style={{ width: "85px", height: "85px", objectFit: "contain", margin: "0 auto 10px" }} />
        <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#14532d", margin: "0 0 6px" }}>مجمع حويلان لتحفيظ القرآن الكريم</h1>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#15803d", margin: "0 0 4px" }}>شهادة اجتياز نهاية المستوى</h2>
        <p style={{ fontSize: "13px", color: "#4b5563", margin: 0 }}>برنامج التلقين</p>
        <div style={{ width: "120px", height: "3px", background: "#15803d", margin: "10px auto" }} />
      </div>

      {/* Body */}
      <div style={{ textAlign: "center", fontSize: "15px", lineHeight: "2.2", color: "#1a1a1a" }}>
        <p>يشهد مجمع حويلان لتحفيظ القرآن الكريم بأن الطالب</p>
        <p style={{ fontSize: "24px", fontWeight: "bold", color: "#14532d", margin: "10px 0", padding: "8px 16px", background: "#fff", borderRadius: "8px", display: "inline-block", border: "2px solid #15803d" }}>
          {studentName}
        </p>
        <p>قد اجتاز بنجاح اختبار الانتقال للمستوى الأعلى</p>
        <p>في منهج <strong style={{ color: "#15803d" }}>{curriculumName}</strong></p>
        {halaqaName && <p>من حلقة <strong>{halaqaName}</strong></p>}
        <p style={{ fontSize: "13px", color: "#6b7280" }}>بتاريخ {formatDateSmart(testDate)}</p>
      </div>

      {/* Scores */}
      <div style={{ display: "flex", justifyContent: "center", gap: "16px", margin: "24px 0 16px", flexWrap: "wrap" }}>
        <ScoreBox label="الحضور" score={attendanceScore} max={attendanceMax} color="#0891b2" />
        <ScoreBox label="الواجب" score={homeworkScore} max={homeworkMax} color="#7c3aed" />
        <ScoreBox label="اختبار الانتقال" score={promotionScore} max={promotionMax} color="#15803d" />
      </div>

      {/* Pass Badge */}
      <div style={{ textAlign: "center", margin: "16px 0" }}>
        <span style={{ display: "inline-block", padding: "8px 24px", background: "#15803d", color: "#fff", borderRadius: "20px", fontSize: "16px", fontWeight: "bold" }}>
          ✓ ناجح ومستحق للانتقال
        </span>
      </div>

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px", fontSize: "12px", color: "#4b5563" }}>
        <div>
          <p>توقيع مشرف التلقين: ___________________</p>
        </div>
        <div style={{ textAlign: "left" }}>
          <p>توقيع مدير المجمع: ___________________</p>
        </div>
      </div>
    </div>
  );
}
