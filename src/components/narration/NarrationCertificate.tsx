import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import { formatDateSmart } from "@/lib/hijri";

interface Props {
  studentName: string;
  halaqaName: string;
  totalHizb: number;
  grade: number;
  maxGrade: number;
  status: "pass" | "fail";
  halaqaRank: number;
  overallRank: number;
  sessionDate: string;
}

export default function NarrationCertificate({
  studentName,
  halaqaName,
  totalHizb,
  grade,
  maxGrade,
  status,
  halaqaRank,
  overallRank,
  sessionDate,
}: Props) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        direction: "rtl",
        width: "700px",
        margin: "0 auto",
        padding: "40px",
        border: "3px solid #1e3a5f",
        borderRadius: "12px",
        background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative corners */}
      <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", borderRight: "4px solid #1e3a5f", borderTop: "4px solid #1e3a5f", borderRadius: "0 10px 0 0" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: "80px", height: "80px", borderLeft: "4px solid #1e3a5f", borderTop: "4px solid #1e3a5f", borderRadius: "10px 0 0 0" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "80px", height: "80px", borderRight: "4px solid #1e3a5f", borderBottom: "4px solid #1e3a5f", borderRadius: "0 0 10px 0" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "80px", height: "80px", borderLeft: "4px solid #1e3a5f", borderBottom: "4px solid #1e3a5f", borderRadius: "0 0 0 10px" }} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <img src={huwaylanLogo} alt="شعار" style={{ width: "70px", height: "70px", objectFit: "contain", margin: "0 auto 10px" }} />
        <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#1e3a5f", margin: "0 0 4px" }}>مجمع حويلان لتحفيظ القرآن الكريم</h1>
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#2563eb", margin: "0 0 4px" }}>شهادة يوم السرد القرآني</h2>
        <div style={{ width: "100px", height: "3px", background: "#2563eb", margin: "8px auto" }} />
      </div>

      {/* Body */}
      <div style={{ textAlign: "center", fontSize: "15px", lineHeight: "2.2", color: "#1a1a1a" }}>
        <p>يشهد مجمع حويلان لتحفيظ القرآن الكريم بأن الطالب</p>
        <p style={{ fontSize: "20px", fontWeight: "bold", color: "#1e3a5f", margin: "8px 0" }}>{studentName}</p>
        <p>من حلقة <strong>{halaqaName}</strong></p>
        <p>قد شارك في يوم السرد القرآني بتاريخ <strong>{formatDateSmart(sessionDate)}</strong></p>
        <p>وقام بسرد <strong>{totalHizb}</strong> حزب/أحزاب</p>
      </div>

      {/* Results */}
      <div style={{ display: "flex", justifyContent: "center", gap: "30px", margin: "20px 0", fontSize: "13px" }}>
        <div style={{ textAlign: "center", padding: "10px 20px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <p style={{ color: "#6b7280" }}>الدرجة</p>
          <p style={{ fontSize: "22px", fontWeight: "bold", color: "#1e3a5f" }}>{grade} / {maxGrade}</p>
        </div>
        <div style={{ textAlign: "center", padding: "10px 20px", background: status === "pass" ? "#f0fdf4" : "#fef2f2", borderRadius: "8px", border: `1px solid ${status === "pass" ? "#bbf7d0" : "#fecaca"}` }}>
          <p style={{ color: "#6b7280" }}>الحالة</p>
          <p style={{ fontSize: "22px", fontWeight: "bold", color: status === "pass" ? "#16a34a" : "#dc2626" }}>
            {status === "pass" ? "ناجح" : "راسب"}
          </p>
        </div>
        <div style={{ textAlign: "center", padding: "10px 20px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <p style={{ color: "#6b7280" }}>الترتيب</p>
          <p style={{ fontSize: "16px", fontWeight: "bold", color: "#1e3a5f" }}>
            {halaqaRank > 0 ? `الحلقة: ${halaqaRank}` : "—"}
            {overallRank > 0 && <><br />{`المجمع: ${overallRank}`}</>}
          </p>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", fontSize: "12px", color: "#6b7280" }}>
        <div>
          <p>توقيع المعلم: ___________________</p>
        </div>
        <div style={{ textAlign: "left" }}>
          <p>توقيع المشرف: ___________________</p>
        </div>
      </div>
    </div>
  );
}
