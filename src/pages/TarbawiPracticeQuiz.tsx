import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Trash2, Eye } from "lucide-react";

const DIFFICULTY_LABELS: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export default function TarbawiPracticeQuiz() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [preview, setPreview] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    title: "", program_id: "", halaqa_id: "", material_id: "", topic: "",
    difficulty: "medium", question_type: "mcq", count: "5",
  });

  const load = useCallback(async () => {
    const [q, p, h, m, a] = await Promise.all([
      (supabase as any).from("tarbawi_practice_quizzes").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("tarbawi_programs").select("id, name"),
      supabase.from("halaqat").select("id, name").eq("active", true).order("name"),
      (supabase as any).from("program_materials").select("id, title, description").limit(100),
      (supabase as any).from("tarbawi_practice_attempts").select("*"),
    ]);
    setQuizzes(q.data || []);
    setPrograms(p.data || []);
    setHalaqat(h.data || []);
    setMaterials(m.data || []);
    setAttempts(a.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!form.title.trim()) { toast.error("عنوان الاختبار مطلوب"); return; }
    const material = materials.find((m) => m.id === form.material_id);
    const content = [form.topic.trim(), material?.title, material?.description]
      .filter(Boolean).join(" — ").slice(0, 4000);
    if (!content) { toast.error("اكتب موضوعاً أو اختر مادة إثرائية"); return; }

    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-program-quiz", {
      body: { content, quizType: form.question_type === "essay" ? "essay" : "mcq", count: Number(form.count) },
    });
    if (error || data?.error) {
      setGenerating(false);
      toast.error("تعذر توليد الأسئلة: " + (data?.error || error?.message));
      return;
    }
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    if (!questions.length) { setGenerating(false); toast.error("لم يتم توليد أي سؤال، أعد المحاولة"); return; }

    const { error: insErr } = await (supabase as any).from("tarbawi_practice_quizzes").insert({
      program_id: form.program_id || null,
      halaqa_id: form.halaqa_id || null,
      material_id: form.material_id || null,
      title: form.title.trim().slice(0, 150),
      topic: form.topic.trim().slice(0, 300) || null,
      difficulty: form.difficulty,
      question_type: form.question_type,
      questions,
      active: true,
      created_by: user?.id ?? null,
    });
    setGenerating(false);
    if (insErr) { toast.error("تعذر الحفظ: " + insErr.message); return; }
    toast.success(`تم توليد ${questions.length} سؤالاً تجريبياً`);
    setOpen(false);
    load();
  };

  const toggleActive = async (q: any) => {
    const { error } = await (supabase as any)
      .from("tarbawi_practice_quizzes").update({ active: !q.active }).eq("id", q.id);
    if (error) { toast.error("تعذر التحديث: " + error.message); return; }
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("tarbawi_practice_quizzes").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف: " + error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> الاختبارات التجريبية الذكية
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            اختبارات تدريبية مولّدة بالذكاء الاصطناعي لرفع كفاءة الطالب قبل الاختبار الرسمي.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Sparkles className="w-4 h-4 ml-1" /> توليد اختبار</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {quizzes.map((q) => {
          const qAttempts = attempts.filter((a) => a.quiz_id === q.id);
          const avg = qAttempts.length
            ? Math.round(qAttempts.reduce((s, a) => s + (Number(a.score) || 0), 0) / qAttempts.length)
            : 0;
          return (
            <Card key={q.id} className="border-2">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{q.title}</CardTitle>
                  <Badge variant={q.active ? "default" : "outline"} className="text-xs">
                    {q.active ? "متاح" : "معطّل"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>
                  {(q.questions || []).length} سؤال · {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                  {" · "}{q.question_type === "essay" ? "مقالي" : "اختيار من متعدد"}
                </p>
                <p>{qAttempts.length} محاولة · متوسط الدرجة {avg}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreview(q)}>
                    <Eye className="w-3 h-3 ml-1" /> معاينة
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => toggleActive(q)}>
                    {q.active ? "تعطيل" : "تفعيل"}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="حذف الاختبار"
                    onClick={() => remove(q.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {quizzes.length === 0 && <p className="text-sm text-muted-foreground">لا توجد اختبارات تجريبية بعد</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>توليد اختبار تجريبي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>العنوان *</Label>
              <Input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>الموضوع / المحتوى</Label>
              <Textarea value={form.topic} rows={3} maxLength={2000} placeholder="مثال: القيم القرآنية في سورة لقمان"
                onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
            <div>
              <Label>مادة إثرائية (اختياري)</Label>
              <Select value={form.material_id} onValueChange={(v) => setForm({ ...form, material_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر مادة" /></SelectTrigger>
                <SelectContent>
                  {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>البرنامج</Label>
                <Select value={form.program_id} onValueChange={(v) => setForm({ ...form, program_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحلقة</Label>
                <Select value={form.halaqa_id} onValueChange={(v) => setForm({ ...form, halaqa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="كل الحلقات" /></SelectTrigger>
                  <SelectContent>
                    {halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>الصعوبة</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع الأسئلة</Label>
                <Select value={form.question_type} onValueChange={(v) => setForm({ ...form, question_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">اختيار من متعدد</SelectItem>
                    <SelectItem value="essay">مقالي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>عدد الأسئلة</Label>
                <Input type="number" min={3} max={10} value={form.count}
                  onChange={(e) => setForm({ ...form, count: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={generate} disabled={generating}>
              {generating ? "جارٍ التوليد..." : "توليد وحفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          <ol className="space-y-3 list-decimal pr-4">
            {(preview?.questions || []).map((q: any, i: number) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{q.question}</p>
                {Array.isArray(q.options) && (
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {q.options.map((o: string, j: number) => (
                      <li key={j} className={j === q.correct_index ? "text-green-600 font-medium" : ""}>
                        {j + 1}. {o}
                      </li>
                    ))}
                  </ul>
                )}
                {q.model_answer && (
                  <p className="text-xs text-muted-foreground mt-1">الإجابة النموذجية: {q.model_answer}</p>
                )}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
