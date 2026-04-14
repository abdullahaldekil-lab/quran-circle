import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import { formatDateSmart } from "@/lib/hijri";

interface QuizQuestion {
  question_number: number;
  question_type: string;
  question_text: string;
  expected_answer: string;
  is_correct?: boolean | null;
  teacher_note?: string;
}

interface Props {
  studentName: string;
  halaqaName: string;
  memorizedContent: string;
  difficulty: string;
  score: number;
  gradeLabel: string;
  questions: QuizQuestion[];
  teacherName: string;
  quizDate: string;
  notes?: string;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: "#f0fdf4", text: "#16a34a", label: "ممتاز" },
  very_good: { bg: "#eff6ff", text: "#2563eb", label: "جيد جداً" },
  good: { bg: "#fefce8", text: "#ca8a04", label: "جيد" },
  needs_review: { bg: "#fef2f2", text: "#dc2626", label: "يحتاج مراجعة" },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  verse_completion: "إكمال آية",
  verse_before: "ما قبل الآية",
  verse_after: "ما بعد الآية",
  surah_identification: "تحديد السورة",
  count_question: "سؤال عددي",
};

export default function QuizCertificate({
  studentName,
  halaqaName,
  memorizedContent,
  difficulty,
  score,
  gradeLabel,
  questions,
  teacherName,
  quizDate,
  notes,
}: Props) {
  const grade = GRADE_COLORS[gradeLabel] || GRADE_COLORS.good;

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
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <img src={huwaylanLogo} alt="شعار" style={{ width: "70px", height: "70px", objectFit: "contain", margin: "0 auto 10px" }} />
        <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#1e3a5f", margin: "0 0 4px" }}>مجمع حويلان لتحفيظ القرآن الكريم</h1>
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#2563eb", margin: "0 0 4px" }}>شهادة اختبار حفظ القرآن الكريم</h2>
        <div style={{ width: "100px", height: "3px", background: "#2563eb", margin: "8px auto" }} />
      </div>

      {/* Student Info */}
      <div style={{ textAlign: "center", fontSize: "15px", lineHeight: "2", color: "#1a1a1a", marginBottom: "16px" }}>
        <p>يشهد مجمع حويلان لتحفيظ القرآن الكريم بأن الطالب</p>
        <p style={{ fontSize: "20px", fontWeight: "bold", color: "#1e3a5f", margin: "4px 0" }}>{studentName}</p>
        <p>من حلقة <strong>{halaqaName}</strong></p>
        <p>قد أدّى الاختبار الذكي بمستوى <strong>{DIFFICULTY_LABELS[difficulty] || difficulty}</strong> في المقرر:</p>
        <p style={{ fontSize: "13px", color: "#4b5563" }}>{memorizedContent}</p>
      </div>

      {/* Score + Grade */}
      <div style={{ display: "flex", justifyContent: "center", gap: "30px", margin: "20px 0" }}>
        <div style={{ textAlign: "center", padding: "12px 24px", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 4px" }}>الدرجة</p>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#1e3a5f", margin: 0 }}>{score}%</p>
        </div>
        <div style={{ textAlign: "center", padding: "12px 24px", background: grade.bg, borderRadius: "10px", border: `2px solid ${grade.text}` }}>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 4px" }}>التصنيف</p>
          <p style={{ fontSize: "22px", fontWeight: "bold", color: grade.text, margin: 0 }}>{grade.label}</p>
        </div>
        <div style={{ textAlign: "center", padding: "12px 24px", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 4px" }}>الإجابات الصحيحة</p>
          <p style={{ fontSize: "22px", fontWeight: "bold", color: "#1e3a5f", margin: 0 }}>
            {questions.filter(q => q.is_correct).length} / {questions.length}
          </p>
        </div>
      </div>

      {/* Questions Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", margin: "16px 0" }}>
        <thead>
          <tr style={{ background: "#1e3a5f", color: "#fff" }}>
            <th style={{ padding: "8px", borderRadius: "0 6px 0 0" }}>#</th>
            <th style={{ padding: "8px" }}>نوع السؤال</th>
            <th style={{ padding: "8px" }}>السؤال</th>
            <th style={{ padding: "8px", borderRadius: "6px 0 0 0" }}>النتيجة</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "6px 8px", textAlign: "center" }}>{q.question_number}</td>
              <td style={{ padding: "6px 8px", textAlign: "center" }}>{QUESTION_TYPE_LABELS[q.question_type] || q.question_type}</td>
              <td style={{ padding: "6px 8px", fontSize: "12px" }}>{q.question_text.length > 60 ? q.question_text.slice(0, 60) + "..." : q.question_text}</td>
              <td style={{ padding: "6px 8px", textAlign: "center", fontSize: "18px" }}>{q.is_correct ? "✅" : "❌"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Notes */}
      {notes && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px", fontSize: "13px", margin: "12px 0" }}>
          <strong>ملاحظات المعلم:</strong> {notes}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "30px", fontSize: "12px", color: "#6b7280" }}>
        <div>
          <p style={{ margin: "0 0 4px" }}>المصحح: <strong style={{ color: "#1a1a1a" }}>{teacherName}</strong></p>
          <p style={{ margin: "0 0 16px" }}>التاريخ: <strong style={{ color: "#1a1a1a" }}>{formatDateSmart(quizDate)}</strong></p>
          <p>التوقيع: ___________________</p>
        </div>
        <div style={{ textAlign: "left" }}>
          <p style={{ margin: "0 0 16px" }}>ختم المجمع</p>
          <div style={{ width: "80px", height: "80px", border: "2px dashed #9ca3af", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#9ca3af" }}>
            الختم
          </div>
        </div>
      </div>
    </div>
  );
}
