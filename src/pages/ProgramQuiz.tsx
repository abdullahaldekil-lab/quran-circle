import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Archive, BarChart3 } from "lucide-react";

interface Question {
  question: string;
  options?: string[];
  correct_index?: number;
  model_answer?: string;
}

export default function ProgramQuiz() {
  const { user } = useAuth();
  const { role } = useRole();

  const [curricula, setCurricula] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  const [selectedHalaqa, setSelectedHalaqa] = useState<string>("");
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>("");
  const [selectedLesson, setSelectedLesson] = useState<string>("");
  const [quizType, setQuizType] = useState<"multiple_choice" | "essay">("multiple_choice");
  const [questionCount, setQuestionCount] = useState(5);

  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [resultsOpen, setResultsOpen] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [c, h] = await Promise.all([
        supabase.from("talqeen_curricula").select("id, name, description").eq("is_active", true),
        supabase.from("halaqat").select("id, name").eq("active", true).order("name"),
      ]);
      setCurricula(c.data || []);
      setHalaqat(h.data || []);
      loadQuizzes();
    })();
  }, []);

  useEffect(() => {
    if (!selectedCurriculum) { setLessons([]); setSelectedLesson(""); return; }
    (async () => {
      const { data: chapters } = await supabase
        .from("talqeen_chapters")
        .select("id")
        .eq("curriculum_id", selectedCurriculum);
      const chapterIds = (chapters || []).map((c: any) => c.id);
      if (chapterIds.length === 0) { setLessons([]); return; }
      const { data: ls } = await supabase
        .from("talqeen_lessons")
        .select("id, title, content, lesson_number")
        .in("chapter_id", chapterIds)
        .eq("is_active", true)
        .order("lesson_number");
      setLessons(ls || []);
    })();
  }, [selectedCurriculum]);

  const loadQuizzes = async () => {
    const { data } = await (supabase as any)
      .from("program_quizzes")
      .select("*, halaqat(name), talqeen_curricula(name), talqeen_lessons(title)")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    setQuizzes(data || []);
  };

  const handleGenerate = async () => {
    if (!selectedLesson && !selectedCurriculum) {
      toast.error("اختر برنامجاً أو درساً أولاً");
      return;
    }
    setGenerating(true);
    try {
      const lessonContent =
        lessons.find(l => l.id === selectedLesson)?.content ||
        curricula.find(c => c.id === selectedCurriculum)?.description ||
        "القيم الإسلامية والأخلاق القرآنية";

      const { data, error } = await supabase.functions.invoke("generate-program-quiz", {
        body: { content: lessonContent, quizType, count: questionCount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const qs = Array.isArray(data?.questions) ? data.questions : [];
      if (qs.length === 0) {
        toast.error("لم يتم توليد أسئلة. حاول مرة أخرى.");
      } else {
        setQuestions(qs);
        toast.success(`تم توليد ${qs.length} سؤال`);
      }
    } catch (e: any) {
      toast.error(e?.message || "فشل توليد الأسئلة");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedHalaqa) {
      toast.error("اختر الحلقة لنشر الاختبار");
      return;
    }
    if (questions.length === 0) return;
    const { error } = await supabase.from("program_quizzes").insert({
      halaqa_id: selectedHalaqa,
      lesson_id: selectedLesson || null,
      curriculum_id: selectedCurriculum || null,
      generated_by: user?.id,
      quiz_type: quizType,
      questions: questions as any,
      status: "published",
      scores_separate: true,
    });
    if (error) {
      toast.error("فشل النشر: " + error.message);
      return;
    }
    toast.success("✅ تم نشر الاختبار للحلقة");
    setQuestions([]);
    loadQuizzes();
  };

  const handleArchive = async (id: string) => {
    const { error } = await supabase.from("program_quizzes").update({ status: "archived" }).eq("id", id);
    if (error) { toast.error("فشل الأرشفة"); return; }
    toast.success("تمت الأرشفة");
    loadQuizzes();
  };

  const openResults = async (quizId: string) => {
    setResultsOpen(quizId);
    const { data } = await supabase
      .from("program_quiz_results")
      .select("*, students(full_name)")
      .eq("quiz_id", quizId)
      .order("submitted_at", { ascending: false });
    setResults(data || []);
  };

  const canGenerate =
    role === "manager" || role === "supervisor" || role === "assistant_supervisor" || role === "teacher";

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">اختبارات البرامج التربوية</h1>
          <p className="text-sm text-muted-foreground">توليد الأسئلة بالذكاء الاصطناعي — الدرجات مستقلة عن التسميع</p>
        </div>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          {canGenerate && <TabsTrigger value="generate">توليد اختبار</TabsTrigger>}
          <TabsTrigger value="published">الاختبارات المنشورة</TabsTrigger>
        </TabsList>

        {canGenerate && (
          <TabsContent value="generate" className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">إعدادات الاختبار</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>الحلقة</Label>
                  <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
                    <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                    <SelectContent>
                      {halaqat.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>البرنامج</Label>
                  <Select value={selectedCurriculum} onValueChange={setSelectedCurriculum}>
                    <SelectTrigger><SelectValue placeholder="اختر البرنامج" /></SelectTrigger>
                    <SelectContent>
                      {curricula.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الدرس / الباب</Label>
                  <Select value={selectedLesson} onValueChange={setSelectedLesson} disabled={!lessons.length}>
                    <SelectTrigger><SelectValue placeholder={lessons.length ? "اختر الدرس (اختياري)" : "لا توجد دروس"} /></SelectTrigger>
                    <SelectContent>
                      {lessons.map(l => <SelectItem key={l.id} value={l.id}>{l.lesson_number}. {l.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع الأسئلة</Label>
                  <Select value={quizType} onValueChange={(v: any) => setQuizType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">اختيار من متعدد</SelectItem>
                      <SelectItem value="essay">مقالي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>عدد الأسئلة (3-10)</Label>
                  <Input
                    type="number" min={3} max={10}
                    value={questionCount}
                    onChange={e => setQuestionCount(Math.min(10, Math.max(3, +e.target.value || 5)))}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleGenerate} disabled={generating}>
                {generating
                  ? <><Loader2 className="animate-spin ml-2 w-4 h-4" />جارٍ التوليد...</>
                  : <><Sparkles className="ml-2 w-4 h-4" />توليد الأسئلة بالذكاء الاصطناعي</>
                }
              </Button>
            </Card>

            {questions.length > 0 && (
              <Card className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">الأسئلة المولّدة ({questions.length})</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>🔄 إعادة توليد</Button>
                    <Button size="sm" onClick={handlePublish}>📤 نشر للحلقة</Button>
                  </div>
                </div>
                {questions.map((q, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground text-sm">{i + 1}.</span>
                      <p className="text-sm font-medium flex-1">{q.question}</p>
                    </div>
                    {quizType === "multiple_choice" && q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mr-4">
                        {q.options.map((opt, j) => (
                          <div
                            key={j}
                            className={`text-xs p-1.5 rounded ${j === q.correct_index ? "bg-green-100 text-green-800 font-medium" : "bg-muted text-muted-foreground"}`}
                          >
                            {["أ", "ب", "ج", "د"][j]}) {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {quizType === "essay" && q.model_answer && (
                      <div className="text-xs p-2 rounded bg-blue-50 text-blue-900 mr-4">
                        <strong>الإجابة النموذجية:</strong> {q.model_answer}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="published" className="space-y-3">
          {quizzes.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد اختبارات منشورة</Card>
          )}
          {quizzes.map(q => {
            const qs = Array.isArray(q.questions) ? q.questions : [];
            return (
              <Card key={q.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="space-y-1">
                    <p className="font-bold">{q.talqeen_curricula?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      الدرس: {q.talqeen_lessons?.title || "—"} • الحلقة: {q.halaqat?.name || "—"}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{q.quiz_type === "essay" ? "مقالي" : "اختيار من متعدد"}</Badge>
                      <Badge variant="secondary">{qs.length} سؤال</Badge>
                      <Badge>{new Date(q.created_at).toLocaleDateString("ar")}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openResults(q.id)}>
                      <BarChart3 className="w-4 h-4 ml-1" />النتائج
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleArchive(q.id)}>
                      <Archive className="w-4 h-4 ml-1" />أرشفة
                    </Button>
                  </div>
                </div>

                {resultsOpen === q.id && (
                  <div className="border-t pt-3 mt-2">
                    {results.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">لا توجد نتائج بعد</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-right text-xs text-muted-foreground">
                            <th className="py-1">الطالب</th>
                            <th className="py-1">الدرجة</th>
                            <th className="py-1">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map(r => (
                            <tr key={r.id} className="border-b last:border-b-0">
                              <td className="py-2">{r.students?.full_name || "—"}</td>
                              <td className="py-2 font-bold text-primary">{r.program_score ?? "—"}</td>
                              <td className="py-2 text-xs text-muted-foreground">
                                {new Date(r.submitted_at).toLocaleDateString("ar")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
