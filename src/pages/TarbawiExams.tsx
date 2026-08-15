import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Download } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import { EXAM_TYPE_LABELS, gradeLabel, scorePercentage } from "@/lib/tarbawi";

export default function TarbawiExams() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<any[]>([]);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, { score: string; notes: string }>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    program_id: "", halaqa_id: "", title: "", exam_type: "monthly",
    exam_date: new Date().toISOString().split("T")[0], max_score: "100",
  });

  const load = useCallback(async () => {
    const [p, h, e] = await Promise.all([
      (supabase as any).from("tarbawi_programs").select("id, name").order("created_at", { ascending: false }),
      supabase.from("halaqat").select("id, name").eq("active", true).order("name"),
      (supabase as any).from("tarbawi_exams").select("*").order("exam_date", { ascending: false }).limit(20),
    ]);
    setPrograms(p.data || []);
    setHalaqat(h.data || []);
    setExams(e.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openExam = async (exam: any) => {
    setSelected(exam);
    const { data: studs } = await supabase
      .from("students").select("id, full_name")
      .eq("halaqa_id", exam.halaqa_id).eq("status", "active").order("full_name");
    setStudents(studs || []);
    const { data: sc } = await (supabase as any)
      .from("tarbawi_exam_scores").select("*").eq("exam_id", exam.id);
    const map: Record<string, { score: string; notes: string }> = {};
    (studs || []).forEach((s: any) => {
      const row = (sc || []).find((x: any) => x.student_id === s.id);
      map[s.id] = { score: row?.score != null ? String(row.score) : "", notes: row?.notes || "" };
    });
    setScores(map);
  };

  const createExam = async () => {
    if (!form.title.trim()) { toast.error("عنوان الاختبار مطلوب"); return; }
    if (!form.halaqa_id) { toast.error("اختر الحلقة"); return; }
    const max = Number(form.max_score);
    if (!max || max <= 0 || max > 1000) { toast.error("الدرجة العظمى غير صحيحة"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("tarbawi_exams").insert({
      program_id: form.program_id || null,
      halaqa_id: form.halaqa_id,
      title: form.title.trim().slice(0, 150),
      exam_type: form.exam_type,
      exam_date: form.exam_date,
      max_score: max,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error("تعذر الإنشاء: " + error.message); return; }
    toast.success("تم إنشاء الاختبار");
    setDialogOpen(false);
    load();
  };

  const saveScores = async () => {
    if (!selected) return;
    const rows = students
      .filter((s) => scores[s.id]?.score !== "")
      .map((s) => ({
        exam_id: selected.id,
        student_id: s.id,
        score: Math.min(Math.max(Number(scores[s.id].score), 0), Number(selected.max_score)),
        notes: scores[s.id].notes.trim().slice(0, 300) || null,
        recorded_by: user?.id ?? null,
      }));
    if (!rows.length) { toast.error("لم تُدخل أي درجة"); return; }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("tarbawi_exam_scores").upsert(rows, { onConflict: "exam_id,student_id" });
    setSaving(false);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    toast.success(`تم حفظ ${rows.length} درجة`);
  };

  const deleteExam = async (id: string) => {
    const { error } = await (supabase as any).from("tarbawi_exams").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف: " + error.message); return; }
    toast.success("تم حذف الاختبار");
    if (selected?.id === id) setSelected(null);
    load();
  };

  const exportCsv = () => {
    if (!selected) return;
    const lines = ["الطالب,الدرجة,النسبة,التقدير,ملاحظة"];
    students.forEach((s) => {
      const raw = scores[s.id]?.score;
      const pct = scorePercentage(raw ? Number(raw) : null, selected.max_score);
      lines.push(`"${s.full_name}",${raw || ""},${pct}%,"${raw ? gradeLabel(pct) : ""}","${scores[s.id]?.notes || ""}"`);
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selected.title}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" /> اختبارات البرامج التربوية
        </h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-1" /> اختبار جديد</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        {exams.map((e) => (
          <Card key={e.id} className={`cursor-pointer border-2 ${selected?.id === e.id ? "border-primary" : ""}`}
            onClick={() => openExam(e)}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{e.title}</CardTitle>
                <Badge variant="outline" className="text-xs">{EXAM_TYPE_LABELS[e.exam_type] || e.exam_type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
              <span>{formatDateSmart(e.exam_date)} — من {e.max_score}</span>
              <Button size="icon" variant="ghost" aria-label="حذف الاختبار"
                onClick={(ev) => { ev.stopPropagation(); deleteExam(e.id); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {exams.length === 0 && <p className="text-sm text-muted-foreground">لا توجد اختبارات بعد</p>}
      </div>

      {selected && (
        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">إدخال الدرجات — {selected.title}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="w-3 h-3 ml-1" /> تصدير
                </Button>
                <Button size="sm" onClick={saveScores} disabled={saving}>
                  {saving ? "جارٍ الحفظ..." : "حفظ الدرجات"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {students.map((s) => {
              const raw = scores[s.id]?.score || "";
              const pct = scorePercentage(raw ? Number(raw) : null, selected.max_score);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
                  <span className="text-sm flex-1 min-w-32">{s.full_name}</span>
                  <Input type="number" min={0} max={selected.max_score} value={raw} placeholder="الدرجة"
                    className="h-8 w-24 text-xs" aria-label={`درجة ${s.full_name}`}
                    onChange={(e) => setScores({ ...scores, [s.id]: { ...scores[s.id], score: e.target.value } })} />
                  <Badge variant="outline" className="text-xs">{raw ? `${pct}% — ${gradeLabel(pct)}` : "—"}</Badge>
                  <Input value={scores[s.id]?.notes || ""} placeholder="ملاحظة" maxLength={300}
                    className="h-8 text-xs flex-1 min-w-32"
                    onChange={(e) => setScores({ ...scores, [s.id]: { ...scores[s.id], notes: e.target.value } })} />
                </div>
              );
            })}
            {students.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد طلاب في حلقة الاختبار</p>}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>اختبار جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>العنوان *</Label>
              <Input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
                <Label>الحلقة *</Label>
                <Select value={form.halaqa_id} onValueChange={(v) => setForm({ ...form, halaqa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={form.exam_type} onValueChange={(v) => setForm({ ...form, exam_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXAM_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
              </div>
              <div>
                <Label>الدرجة العظمى</Label>
                <Input type="number" min={1} max={1000} value={form.max_score}
                  onChange={(e) => setForm({ ...form, max_score: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createExam} disabled={saving}>{saving ? "جارٍ الحفظ..." : "إنشاء"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
