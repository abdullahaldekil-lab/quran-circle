import { useState, useMemo, useRef } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Brain, RefreshCw, Save, GraduationCap, User, Loader2, Printer, CalendarDays } from "lucide-react";
import QuizQuestionCard from "@/components/quiz/QuizQuestionCard";
import { sendNotification } from "@/utils/sendNotification";
import QuizCertificate from "@/components/quiz/QuizCertificate";
import { formatDualDate, formatDateHijriOnly } from "@/lib/hijri";

interface QuizQuestion {
  question_number: number;
  question_type: string;
  question_text: string;
  expected_answer: string;
  is_correct?: boolean | null;
  teacher_note?: string;
}

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "سهل", color: "bg-green-100 text-green-800" },
  { value: "medium", label: "متوسط", color: "bg-yellow-100 text-yellow-800" },
  { value: "hard", label: "صعب", color: "bg-red-100 text-red-800" },
];

const GRADE_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: "ممتاز", color: "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300" },
  very_good: { label: "جيد جداً", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300" },
  good: { label: "جيد", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300" },
  needs_review: { label: "يحتاج مراجعة", color: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300" },
};

const getGradeLabel = (score: number): string => {
  if (score >= 90) return "excellent";
  if (score >= 75) return "very_good";
  if (score >= 60) return "good";
  return "needs_review";
};

const StudentQuiz = () => {
  const { user } = useAuth();
  const { isManager, isAdminStaff, isTeacher } = useRole();
  const { filterHalaqat, loading: accessLoading } = useTeacherHalaqat();
  const queryClient = useQueryClient();
  const certificateRef = useRef<HTMLDivElement>(null);

  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quizNotes, setQuizNotes] = useState("");
  const [savedQuizId, setSavedQuizId] = useState<string | null>(null);

  // Fetch teacher profile name
  const { data: teacherProfile } = useQuery({
    queryKey: ["teacher-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const isAdmin = isManager || isAdminStaff;

  // Fetch halaqat
  const { data: halaqat = [] } = useQuery({
    queryKey: ["quiz-halaqat", user?.id, isTeacher],
    queryFn: async () => {
      if (isTeacher && user) {
        const { data } = await supabase
          .from("halaqat").select("*").eq("active", true)
          .or(`teacher_id.eq.${user.id},assistant_teacher_id.eq.${user.id}`);
        return data || [];
      }
      const { data } = await supabase.from("halaqat").select("*").eq("active", true);
      return filterHalaqat(data || []);
    },
    enabled: !accessLoading,
  });

  // Auto-select halaqa for teachers
  useMemo(() => {
    if (halaqat.length > 0 && !selectedHalaqa) {
      setSelectedHalaqa(halaqat[0].id);
    }
  }, [halaqat]);

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["quiz-students", selectedHalaqa],
    queryFn: async () => {
      const { data } = await supabase
        .from("students").select("id, full_name")
        .eq("halaqa_id", selectedHalaqa).eq("status", "active")
        .order("full_name");
      return data || [];
    },
    enabled: !!selectedHalaqa,
  });

  // Fetch student level info
  const { data: studentLevel } = useQuery({
    queryKey: ["quiz-student-level", selectedStudent],
    queryFn: async () => {
      const { data: levels } = await supabase
        .from("student_levels")
        .select("*, level_tracks(name, level_number)")
        .eq("student_id", selectedStudent)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: enrollment } = await supabase
        .from("madarij_enrollments")
        .select("*, madarij_tracks!madarij_enrollments_track_id_fkey(name)")
        .eq("student_id", selectedStudent)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      return { level: levels, enrollment };
    },
    enabled: !!selectedStudent,
  });

  // Fetch past quizzes for this student
  const { data: pastQuizzes = [] } = useQuery({
    queryKey: ["student-past-quizzes", selectedStudent],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_quizzes")
        .select("id, quiz_date, score, grade_label, difficulty, status")
        .eq("student_id", selectedStudent)
        .eq("status", "completed")
        .order("quiz_date", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!selectedStudent,
  });

  const selectedStudentData = students.find((s: any) => s.id === selectedStudent);

  // Build memorized content description
  const memorizedContent = useMemo(() => {
    if (!studentLevel) return "";
    const parts: string[] = [];
    if (studentLevel.level) {
      const lt = studentLevel.level as any;
      const trackName = lt.level_tracks?.name || "";
      parts.push(`المستوى: ${trackName}, الجزء ${lt.part_number || 1}`);
    }
    if (studentLevel.enrollment) {
      const en = studentLevel.enrollment as any;
      const trackName = en.madarij_tracks?.name || "";
      parts.push(`برنامج مدارج: ${trackName}, الحزب ${en.hizb_number || 1}, الجزء ${en.part_number || 1}`);
    }
    if (parts.length === 0) {
      parts.push("الأجزاء الأولى من القرآن الكريم (جزء عمّ وتبارك)");
    }
    return parts.join(" | ");
  }, [studentLevel]);

  // Generate questions via AI
  const handleGenerate = async () => {
    if (!selectedStudent || !selectedStudentData) {
      toast.error("يرجى اختيار طالب أولاً");
      return;
    }
    setGenerating(true);
    setSavedQuizId(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          memorizedContent,
          difficulty,
          studentName: selectedStudentData.full_name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const qs = (data.questions || []).map((q: any) => ({
        ...q,
        is_correct: null,
        teacher_note: "",
      }));
      setQuestions(qs);
      toast.success("تم توليد 5 أسئلة بنجاح");
    } catch (err: any) {
      console.error(err);
      toast.error("فشل توليد الأسئلة: " + (err.message || "خطأ غير معروف"));
    } finally {
      setGenerating(false);
    }
  };

  const handleGrade = (index: number, isCorrect: boolean) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, is_correct: isCorrect } : q))
    );
  };

  const handleNoteChange = (index: number, note: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, teacher_note: note } : q))
    );
  };

  const allGraded = questions.length === 5 && questions.every((q) => q.is_correct !== null);
  const correctCount = questions.filter((q) => q.is_correct === true).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const gradeLabel = getGradeLabel(score);

  // Save quiz results
  const handleSave = async () => {
    if (!allGraded || !user || !selectedStudent) return;
    setSaving(true);
    try {
      // Insert quiz
      const { data: quiz, error: quizErr } = await supabase
        .from("student_quizzes")
        .insert({
          student_id: selectedStudent,
          halaqa_id: selectedHalaqa || null,
          teacher_id: user.id,
          difficulty,
          total_questions: 5,
          correct_answers: correctCount,
          score,
          grade_label: gradeLabel,
          memorized_content: memorizedContent,
          status: "completed",
          notes: quizNotes || null,
        })
        .select("id")
        .single();

      if (quizErr) throw quizErr;

      // Insert questions
      const questionRows = questions.map((q) => ({
        quiz_id: quiz.id,
        question_number: q.question_number,
        question_type: q.question_type,
        question_text: q.question_text,
        expected_answer: q.expected_answer,
        is_correct: q.is_correct,
        teacher_note: q.teacher_note || null,
      }));

      const { error: qErr } = await supabase.from("quiz_questions").insert(questionRows);
      if (qErr) throw qErr;

      setSavedQuizId(quiz.id);
      queryClient.invalidateQueries({ queryKey: ["student-past-quizzes", selectedStudent] });
      toast.success("تم حفظ نتيجة الاختبار بنجاح");

      // Notify guardian (optional)
      try {
        const { data: links } = await supabase
          .from("guardian_students").select("guardian_id")
          .eq("student_id", selectedStudent).eq("active", true);
        if (links && links.length > 0) {
          const gradeLabelAr = GRADE_LABELS[gradeLabel]?.label || gradeLabel;
          sendNotification({
            templateCode: "STUDENT_QUIZ_RESULT",
            recipientIds: links.map((l: any) => l.guardian_id),
            variables: {
              studentName: selectedStudentData?.full_name || "",
              score: `${score}%`,
              gradeLabel: gradeLabelAr,
              date: formatDateHijriOnly(new Date()),
            },
          }).catch(console.error);
        }
      } catch {
        // Notification failure is non-critical
      }
    } catch (err: any) {
      toast.error("خطأ في الحفظ: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetQuiz = () => {
    setQuestions([]);
    setSavedQuizId(null);
    setQuizNotes("");
  };

  const handlePrint = () => {
    const printContent = certificateRef.current;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl"><head><title>شهادة اختبار</title>
      <style>body{margin:0;padding:20px;background:#fff;}@media print{body{padding:0;}}</style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { hijri: hijriToday, gregorian: gregorianToday } = formatDualDate(new Date());

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            الاختبار الذكي
          </h1>
          <p className="text-muted-foreground text-sm">توليد أسئلة مخصصة من المقرر المحفوظ لكل طالب</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{hijriToday}</span>
          <span className="text-muted-foreground text-xs">، {gregorianToday}</span>
        </div>
      </div>

      {/* Step 1: Select Halaqa & Student */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">اختيار الطالب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isTeacher || halaqat.length > 1 ? (
            <Select value={selectedHalaqa} onValueChange={(v) => { setSelectedHalaqa(v); setSelectedStudent(""); resetQuiz(); }}>
              <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
              <SelectContent>
                {halaqat.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : halaqat.length === 1 ? (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{halaqat[0].name}</span>
            </div>
          ) : null}

          {selectedHalaqa && (
            <Select value={selectedStudent} onValueChange={(v) => { setSelectedStudent(v); resetQuiz(); }}>
              <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Student Info */}
      {selectedStudent && selectedStudentData && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold"><StudentNameLink studentId={selectedStudentData.id} studentName={selectedStudentData.full_name} /></p>
                <p className="text-xs text-muted-foreground">
                  {halaqat.find((h: any) => h.id === selectedHalaqa)?.name}
                </p>
              </div>
            </div>

            {memorizedContent && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">المقرر المحدد</span>
                </div>
                <p className="text-sm font-medium">{memorizedContent}</p>
              </div>
            )}

            {/* Past quizzes */}
            {pastQuizzes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">آخر الاختبارات:</p>
                <div className="flex flex-wrap gap-2">
                  {pastQuizzes.map((q: any) => {
                    const gl = GRADE_LABELS[q.grade_label];
                    return (
                      <Badge key={q.id} variant="outline" className={`text-xs ${gl?.color || ""}`}>
                        {formatDateHijriOnly(q.quiz_date)} — {q.score}% {gl?.label || ""}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Difficulty + Generate */}
      {selectedStudent && !savedQuizId && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">مستوى الصعوبة:</span>
              <div className="flex gap-2">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      difficulty === d.value
                        ? `${d.color} border-current ring-2 ring-offset-1 ring-current/20`
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating} className="flex-1">
                {generating ? (
                  <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ التوليد...</>
                ) : questions.length > 0 ? (
                  <><RefreshCw className="w-4 h-4 ml-2" /> تحديث الأسئلة</>
                ) : (
                  <><Brain className="w-4 h-4 ml-2" /> توليد الأسئلة</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Questions & Grading */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">الأسئلة ({questions.length})</h2>
          {questions.map((q, i) => (
            <QuizQuestionCard
              key={i}
              question={q}
              index={i}
              readOnly={!!savedQuizId}
              onGrade={handleGrade}
              onNoteChange={handleNoteChange}
            />
          ))}
        </div>
      )}

      {/* Step 5: Results & Save */}
      {questions.length > 0 && (
        <Card className={savedQuizId ? "border-primary/30" : ""}>
          <CardContent className="p-4 space-y-4">
            {allGraded && (
              <div className="text-center space-y-2">
                <p className="text-4xl font-bold text-primary">{score}%</p>
                <Badge className={`text-sm px-4 py-1 ${GRADE_LABELS[gradeLabel]?.color || ""}`}>
                  {GRADE_LABELS[gradeLabel]?.label}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {correctCount} من {questions.length} إجابة صحيحة
                </p>
              </div>
            )}

            {!savedQuizId && (
              <>
                <Textarea
                  placeholder="ملاحظات عامة على الاختبار (اختياري)..."
                  value={quizNotes}
                  onChange={(e) => setQuizNotes(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button
                  onClick={handleSave}
                  disabled={!allGraded || saving}
                  className="w-full"
                  size="lg"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ الحفظ...</>
                  ) : (
                    <><Save className="w-4 h-4 ml-2" /> حفظ النتيجة</>
                  )}
                </Button>
              </>
            )}

            {savedQuizId && (
              <div className="text-center space-y-3">
                <p className="text-sm text-green-600 font-medium">✅ تم حفظ النتيجة وإشعار ولي الأمر</p>
                <div className="flex justify-center gap-3">
                  <Button onClick={handlePrint}>
                    <Printer className="w-4 h-4 ml-2" /> طباعة الشهادة
                  </Button>
                  <Button variant="outline" onClick={() => { resetQuiz(); setSelectedStudent(""); }}>
                    اختبار طالب آخر
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden certificate for printing */}
      <div ref={certificateRef} style={{ display: "none" }}>
        {savedQuizId && selectedStudentData && (
          <QuizCertificate
            studentName={selectedStudentData.full_name}
            halaqaName={halaqat.find((h: any) => h.id === selectedHalaqa)?.name || ""}
            memorizedContent={memorizedContent}
            difficulty={difficulty}
            score={score}
            gradeLabel={gradeLabel}
            questions={questions}
            teacherName={teacherProfile?.full_name || ""}
            quizDate={new Date().toISOString()}
            notes={quizNotes}
          />
        )}
      </div>
    </div>
  );
};

export default StudentQuiz;
