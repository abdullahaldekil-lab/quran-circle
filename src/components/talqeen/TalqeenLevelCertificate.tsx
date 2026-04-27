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
  certificateNumber?: string | null;
  issuedAt?: string | null;
  verifyUrl?: string;
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
  certificateNumber,
  issuedAt,
  verifyUrl,
}: Props) {
  // Brand colors
  const GOLD = "#b8860b";
  const GOLD_LIGHT = "#d4a017";
  const GREEN_DARK = "#0f4c2e";
  const GREEN = "#15803d";
  const INK = "#1a2e1f";
  const MUTED = "#5b6b60";

  const ScoreBox = ({
    label,
    score,
    max,
    accent,
  }: {
    label: string;
    score: number | null | undefined;
    max: number | null | undefined;
    accent: string;
  }) => {
    const has = score !== null && score !== undefined;
    const pct = has ? Math.round((Number(score) / (Number(max) || 100)) * 100) : 0;
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "#fff",
          border: `1px solid ${accent}33`,
          borderTop: `3px solid ${accent}`,
          borderRadius: "6px",
          padding: "14px 12px",
          textAlign: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <p style={{ color: MUTED, fontSize: "12px", margin: 0, letterSpacing: "0.3px" }}>{label}</p>
        <p style={{ fontSize: "22px", fontWeight: 800, color: accent, margin: "6px 0 2px", lineHeight: 1 }}>
          {has ? score : "—"}
          {has && <span style={{ fontSize: "13px", color: MUTED, fontWeight: 500 }}> / {max ?? 100}</span>}
        </p>
        {has && <p style={{ fontSize: "11px", color: MUTED, margin: 0 }}>{pct}%</p>}
      </div>
    );
  };

  return (
    <>
      {/* Print-only styles to ensure proper A4 layout */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .talqeen-cert-page { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <div
        className="talqeen-cert-page"
        style={{
          fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif",
          direction: "rtl",
          width: "210mm",
          minHeight: "297mm",
          margin: "0 auto",
          background: "#ffffff",
          color: INK,
          position: "relative",
          boxSizing: "border-box",
          padding: "18mm 16mm",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          backgroundImage: `
            radial-gradient(circle at 0% 0%, ${GOLD}08 0%, transparent 30%),
            radial-gradient(circle at 100% 100%, ${GREEN}08 0%, transparent 30%)
          `,
        }}
      >
        {/* Outer ornamental frame */}
        <div
          style={{
            position: "absolute",
            inset: "10mm",
            border: `2px solid ${GREEN_DARK}`,
            borderRadius: "4px",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "12mm",
            border: `1px solid ${GOLD}`,
            borderRadius: "2px",
            pointerEvents: "none",
          }}
        />

        {/* Corner ornaments */}
        {[
          { top: "10mm", right: "10mm", borderTop: `4px solid ${GOLD}`, borderRight: `4px solid ${GOLD}` },
          { top: "10mm", left: "10mm", borderTop: `4px solid ${GOLD}`, borderLeft: `4px solid ${GOLD}` },
          { bottom: "10mm", right: "10mm", borderBottom: `4px solid ${GOLD}`, borderRight: `4px solid ${GOLD}` },
          { bottom: "10mm", left: "10mm", borderBottom: `4px solid ${GOLD}`, borderLeft: `4px solid ${GOLD}` },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", width: "20mm", height: "20mm", ...s, pointerEvents: "none" }} />
        ))}

        {/* Content wrapper using flex to distribute vertical space */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "calc(297mm - 36mm)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* ===== HEADER ===== */}
          <header style={{ textAlign: "center" }}>
            <img
              src={huwaylanLogo}
              alt="شعار مجمع حويلان"
              style={{
                width: "26mm",
                height: "26mm",
                objectFit: "contain",
                margin: "0 auto",
                display: "block",
                borderRadius: "50%",
                border: `2px solid ${GOLD}`,
                padding: "2mm",
                background: "#fff",
              }}
            />
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: GREEN_DARK,
                margin: "8px 0 2px",
                letterSpacing: "0.3px",
              }}
            >
              مجمع حويلان لتحفيظ القرآن الكريم
            </h1>
            <p style={{ fontSize: "12px", color: MUTED, margin: 0, letterSpacing: "1px" }}>
              HUWAYLAN QURAN MEMORIZATION COMPLEX
            </p>

            {/* Divider with ornament */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "10px auto", gap: "8px" }}>
              <div style={{ height: "1px", width: "50px", background: GOLD }} />
              <span style={{ color: GOLD, fontSize: "16px" }}>❖</span>
              <div style={{ height: "1px", width: "50px", background: GOLD }} />
            </div>

            <h2
              style={{
                fontSize: "26px",
                fontWeight: 800,
                color: GREEN,
                margin: "4px 0",
                letterSpacing: "0.5px",
              }}
            >
              شهادة اجتياز نهاية المستوى
            </h2>
            <p style={{ fontSize: "13px", color: MUTED, margin: 0 }}>برنامج التلقين</p>
          </header>

          {/* ===== BODY ===== */}
          <section style={{ textAlign: "center", padding: "0 8mm" }}>
            <p style={{ fontSize: "14px", color: INK, margin: "0 0 12px", lineHeight: 1.8 }}>
              يشهد مجمع حويلان لتحفيظ القرآن الكريم بأن الطالب
            </p>

            {/* Student name - hero element */}
            <div
              style={{
                display: "inline-block",
                padding: "10px 32px",
                background: `linear-gradient(180deg, ${GREEN_DARK} 0%, ${GREEN} 100%)`,
                color: "#fff",
                borderRadius: "6px",
                margin: "4px 0 12px",
                boxShadow: `0 2px 8px ${GREEN_DARK}33`,
                minWidth: "60%",
              }}
            >
              <p style={{ fontSize: "26px", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>
                {studentName}
              </p>
            </div>

            <p style={{ fontSize: "14px", color: INK, margin: "8px 0 4px", lineHeight: 1.9 }}>
              قد اجتاز بنجاح <strong>اختبار الانتقال للمستوى الأعلى</strong>
            </p>
            <p style={{ fontSize: "14px", color: INK, margin: "0 0 4px", lineHeight: 1.9 }}>
              في منهج <strong style={{ color: GREEN, fontSize: "16px" }}>{curriculumName}</strong>
            </p>
            {halaqaName && (
              <p style={{ fontSize: "13px", color: MUTED, margin: "0 0 4px" }}>
                من حلقة <strong style={{ color: INK }}>{halaqaName}</strong>
              </p>
            )}
            <p style={{ fontSize: "12px", color: MUTED, margin: "8px 0 0" }}>
              بتاريخ {formatDateSmart(testDate)}
            </p>
          </section>

          {/* ===== SCORES ===== */}
          <section style={{ padding: "0 4mm" }}>
            <div
              style={{
                display: "flex",
                gap: "10px",
                margin: "0 0 12px",
                alignItems: "stretch",
              }}
            >
              <ScoreBox label="الحضور" score={attendanceScore} max={attendanceMax} accent="#0891b2" />
              <ScoreBox label="الواجب" score={homeworkScore} max={homeworkMax} accent="#7c3aed" />
              <ScoreBox label="اختبار الانتقال" score={promotionScore} max={promotionMax} accent={GREEN} />
            </div>

            {/* Pass badge */}
            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "8px 28px",
                  background: GREEN,
                  color: "#fff",
                  borderRadius: "999px",
                  fontSize: "14px",
                  fontWeight: 700,
                  boxShadow: `0 2px 6px ${GREEN}44`,
                  letterSpacing: "0.3px",
                }}
              >
                ✓ ناجح ومستحق للانتقال
              </span>
            </div>
          </section>

          {/* ===== SIGNATURES ===== */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20mm",
              padding: "0 8mm",
              marginTop: "8mm",
            }}
          >
            {[
              { label: "مشرف التلقين" },
              { label: "مدير المجمع" },
            ].map((sig, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ height: "12mm" }} />
                <div style={{ borderTop: `1px solid ${INK}`, paddingTop: "4px" }}>
                  <p style={{ fontSize: "12px", color: INK, margin: 0, fontWeight: 600 }}>توقيع {sig.label}</p>
                </div>
              </div>
            ))}
          </section>

          {/* ===== VERIFICATION FOOTER ===== */}
          {certificateNumber && (
            <footer
              style={{
                marginTop: "6mm",
                padding: "8px 12px",
                background: `${GREEN}08`,
                border: `1px dashed ${GREEN}66`,
                borderRadius: "4px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                fontSize: "11px",
                color: INK,
              }}
            >
              <div>
                <p style={{ margin: 0 }}>
                  <strong>رقم الشهادة:</strong>{" "}
                  <span style={{ fontFamily: "monospace", color: GREEN_DARK, fontSize: "12px", fontWeight: 700 }}>
                    {certificateNumber}
                  </span>
                </p>
                {issuedAt && (
                  <p style={{ margin: "4px 0 0" }}>
                    <strong>تاريخ الإصدار:</strong> {formatDateSmart(issuedAt)}
                  </p>
                )}
              </div>
              {verifyUrl && (
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, color: GREEN, fontWeight: 700 }}>للتحقق من صحة الشهادة:</p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontFamily: "monospace",
                      fontSize: "10px",
                      direction: "ltr",
                      color: MUTED,
                      wordBreak: "break-all",
                    }}
                  >
                    {verifyUrl}
                  </p>
                </div>
              )}
            </footer>
          )}
        </div>
      </div>
    </>
  );
}
