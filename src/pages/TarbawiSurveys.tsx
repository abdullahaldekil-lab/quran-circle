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
import { ClipboardSignature, Plus, Trash2, BarChart3 } from "lucide-react";
import { scaleAverage } from "@/lib/tarbawi";

const AUDIENCE_LABELS: Record<string, string> = {
  students: "الطلاب", guardians: "أولياء الأمور", both: "الطلاب وأولياء الأمور",
};
const PHASE_LABELS: Record<string, string> = { before: "قبل البرنامج", after: "بعد البرنامج" };
const QTYPE_LABELS: Record<string, string> = { scale: "مقياس 1-5", text: "نص حر", choice: "اختيار من متعدد" };

interface QDraft { question_text: string; question_type: string; options: string; required: boolean }

export default function TarbawiSurveys() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", program_id: "", audience: "both", phase: "after",
  });
  const [qDrafts, setQDrafts] = useState<QDraft[]>([
    { question_text: "", question_type: "scale", options: "", required: true },
  ]);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      (supabase as any).from("tarbawi_surveys").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("tarbawi_programs").select("id, name"),
    ]);
    setSurveys(s.data || []);
    setPrograms(p.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openSurvey = async (s: any) => {
    setSelected(s);
    const [q, r] = await Promise.all([
      (supabase as any).from("tarbawi_survey_questions").select("*").eq("survey_id", s.id).order("order_index"),
      (supabase as any).from("tarbawi_survey_responses").select("*").eq("survey_id", s.id),
    ]);
    setQuestions(q.data || []);
    setResponses(r.data || []);
  };

  const create = async () => {
    if (!form.title.trim()) { toast.error("عنوان الاستبيان مطلوب"); return; }
    const valid = qDrafts.filter((q) => q.question_text.trim());
    if (!valid.length) { toast.error("أضف سؤالاً واحداً على الأقل"); return; }
    setSaving(true);
    const { data: survey, error } = await (supabase as any).from("tarbawi_surveys").insert({
      title: form.title.trim().slice(0, 150),
      description: form.description.trim().slice(0, 500) || null,
      program_id: form.program_id || null,
      audience: form.audience,
      phase: form.phase,
      status: "active",
      created_by: user?.id ?? null,
    }).select("id").single();
    if (error || !survey) { setSaving(false); toast.error("تعذر الإنشاء: " + error?.message); return; }

    const { error: qErr } = await (supabase as any).from("tarbawi_survey_questions").insert(
      valid.map((q, i) => ({
        survey_id: survey.id,
        question_text: q.question_text.trim().slice(0, 300),
        question_type: q.question_type,
        options: q.question_type === "choice"
          ? q.options.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 10)
          : null,
        order_index: i,
        required: q.required,
      })),
    );
    setSaving(false);
    if (qErr) { toast.error("تعذر حفظ الأسئلة: " + qErr.message); return; }
    toast.success("تم إنشاء الاستبيان");
    setOpen(false);
    setQDrafts([{ question_text: "", question_type: "scale", options: "", required: true }]);
    load();
  };

  const toggleStatus = async (s: any) => {
    const next = s.status === "active" ? "closed" : "active";
    const { error } = await (supabase as any).from("tarbawi_surveys").update({ status: next }).eq("id", s.id);
    if (error) { toast.error("تعذر التحديث: " + error.message); return; }
    toast.success(next === "active" ? "تم تفعيل الاستبيان" : "تم إغلاق الاستبيان");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("tarbawi_surveys").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف: " + error.message); return; }
    if (selected?.id === id) setSelected(null);
    toast.success("تم الحذف");
    load();
  };

  const scaleAverageFor = (qId: string) =>
    scaleAverage(
      responses
        .map((r) => Number((r.answers || {})[qId]))
        .filter((v) => Number.isFinite(v) && v > 0),
    );

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardSignature className="w-5 h-5 text-primary" /> استبيانات قياس أثر البرامج
        </h1>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 ml-1" /> استبيان جديد</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        {surveys.map((s) => (
          <Card key={s.id} className={`border-2 cursor-pointer ${selected?.id === s.id ? "border-primary" : ""}`}
            onClick={() => openSurvey(s)}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{s.title}</CardTitle>
                <Badge variant={s.status === "active" ? "default" : "outline"} className="text-xs">
                  {s.status === "active" ? "مفتوح" : "مغلق"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>{AUDIENCE_LABELS[s.audience]} · {PHASE_LABELS[s.phase]}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); toggleStatus(s); }}>
                  {s.status === "active" ? "إغلاق" : "تفعيل"}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="حذف الاستبيان"
                  onClick={(e) => { e.stopPropagation(); remove(s.id); }}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {surveys.length === 0 && <p className="text-sm text-muted-foreground">لا توجد استبيانات بعد</p>}
      </div>

      {selected && (
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> نتائج: {selected.title}
              <Badge variant="secondary" className="text-xs">{responses.length} مشاركة</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border p-3">
                <p className="text-sm font-medium">{q.question_text}</p>
                <p className="text-xs text-muted-foreground mb-1">{QTYPE_LABELS[q.question_type]}</p>
                {q.question_type === "scale" && (
                  <Badge>المتوسط: {scaleAverageFor(q.id)} / 5</Badge>
                )}
                {q.question_type !== "scale" && (
                  <ul className="list-disc pr-4 text-xs text-muted-foreground space-y-0.5">
                    {responses
                      .map((r) => (r.answers || {})[q.id])
                      .filter(Boolean)
                      .slice(0, 20)
                      .map((a: any, i: number) => <li key={i}>{String(a)}</li>)}
                  </ul>
                )}
              </div>
            ))}
            {questions.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أسئلة</p>}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>استبيان جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>العنوان *</Label>
              <Input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description} rows={2} maxLength={500}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                <Label>الجمهور</Label>
                <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المرحلة</Label>
                <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PHASE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الأسئلة</Label>
              {qDrafts.map((q, i) => (
                <div key={i} className="rounded-xl border p-2 space-y-2">
                  <Input value={q.question_text} placeholder={`السؤال ${i + 1}`} maxLength={300}
                    onChange={(e) => setQDrafts(qDrafts.map((x, j) => j === i ? { ...x, question_text: e.target.value } : x))} />
                  <div className="flex gap-2">
                    <Select value={q.question_type}
                      onValueChange={(v) => setQDrafts(qDrafts.map((x, j) => j === i ? { ...x, question_type: v } : x))}>
                      <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(QTYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {q.question_type === "choice" && (
                      <Input value={q.options} placeholder="الخيارات مفصولة بفاصلة" className="h-8 text-xs"
                        onChange={(e) => setQDrafts(qDrafts.map((x, j) => j === i ? { ...x, options: e.target.value } : x))} />
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="حذف السؤال"
                      onClick={() => setQDrafts(qDrafts.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline"
                onClick={() => setQDrafts([...qDrafts, { question_text: "", question_type: "scale", options: "", required: true }])}>
                <Plus className="w-3 h-3 ml-1" /> إضافة سؤال
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={saving}>{saving ? "جارٍ الحفظ..." : "إنشاء"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
