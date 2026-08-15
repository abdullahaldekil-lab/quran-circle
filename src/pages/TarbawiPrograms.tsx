import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PageDateHeader from "@/components/PageDateHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartHandshake, Plus, Send, Users, BookOpen, Pencil } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import { PROGRAM_STATUS_LABELS, WEEKDAY_LABELS, weekStart } from "@/lib/tarbawi";

interface Program {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  session_weekday: number | null;
  status: string;
}

interface Halaqa { id: string; name: string; teacher_id: string | null; assistant_teacher_id: string | null }

const emptyForm = {
  name: "", description: "", goal: "",
  start_date: "", end_date: "", session_weekday: "0", status: "draft",
};

export default function TarbawiPrograms() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [halaqat, setHalaqat] = useState<Halaqa[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [weekEntries, setWeekEntries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [assignOpen, setAssignOpen] = useState<Program | null>(null);
  const [selectedHalaqat, setSelectedHalaqat] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const thisWeek = weekStart(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [progRes, halaqatRes, linkRes, weeklyRes] = await Promise.all([
      (supabase as any).from("tarbawi_programs").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("halaqat").select("id, name, teacher_id, assistant_teacher_id").eq("active", true).order("name"),
      (supabase as any).from("tarbawi_program_halaqat").select("id, program_id, halaqa_id, notified_at"),
      (supabase as any).from("tarbawi_weekly_records").select("program_id, student_id").eq("week_start", thisWeek),
    ]);
    setPrograms(progRes.data || []);
    setHalaqat(halaqatRes.data || []);
    setLinks(linkRes.data || []);

    const entries: Record<string, number> = {};
    (weeklyRes.data || []).forEach((r: any) => { entries[r.program_id] = (entries[r.program_id] || 0) + 1; });
    setWeekEntries(entries);

    // students per halaqa (for the program cards)
    const { data: studs } = await supabase.from("students").select("halaqa_id").eq("status", "active");
    const counts: Record<string, number> = {};
    (studs || []).forEach((s: any) => { if (s.halaqa_id) counts[s.halaqa_id] = (counts[s.halaqa_id] || 0) + 1; });
    setStudentCounts(counts);
    setLoading(false);
  }, [thisWeek]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const programHalaqat = (programId: string) => links.filter((l) => l.program_id === programId);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Program) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "", goal: p.goal || "",
      start_date: p.start_date || "", end_date: p.end_date || "",
      session_weekday: String(p.session_weekday ?? 0), status: p.status,
    });
    setDialogOpen(true);
  };

  const saveProgram = async () => {
    const name = form.name.trim();
    if (!name) { toast.error("اسم البرنامج مطلوب"); return; }
    if (name.length > 150) { toast.error("اسم البرنامج طويل جداً"); return; }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      toast.error("تاريخ النهاية قبل البداية"); return;
    }
    setSaving(true);
    const payload = {
      name,
      description: form.description.trim() || null,
      goal: form.goal.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      session_weekday: Number(form.session_weekday),
      status: form.status,
      created_by: user?.id ?? null,
    };
    const { error } = editing
      ? await (supabase as any).from("tarbawi_programs").update(payload).eq("id", editing.id)
      : await (supabase as any).from("tarbawi_programs").insert(payload);
    setSaving(false);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    toast.success(editing ? "تم تحديث البرنامج" : "تم إنشاء البرنامج");
    setDialogOpen(false);
    fetchAll();
  };

  const openAssign = (p: Program) => {
    setAssignOpen(p);
    setSelectedHalaqat(programHalaqat(p.id).map((l) => l.halaqa_id));
  };

  const notifyTeachers = async (program: Program, halaqaIds: string[]) => {
    const targets = halaqat.filter((h) => halaqaIds.includes(h.id));
    const recipients = [
      ...new Set(targets.flatMap((h) => [h.teacher_id, h.assistant_teacher_id]).filter(Boolean)),
    ] as string[];
    if (!recipients.length) return 0;
    const rows = recipients.map((uid) => ({
      user_id: uid,
      title: `برنامج تربوي جديد: ${program.name}`,
      body: `تم إسناد البرنامج التربوي "${program.name}" لحلقتك. سجّل متابعة الطلاب أسبوعياً من صفحة متابعة البرامج التربوية.`,
      channel: "inApp",
      status: "sent",
      sent_at: new Date().toISOString(),
      meta_data: { link: "/tarbawi-follow-up", program_id: program.id, type: "tarbawi_program" },
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) { console.error("notify error", error); return 0; }
    return recipients.length;
  };

  const saveAssignment = async () => {
    if (!assignOpen) return;
    setSaving(true);
    const existing = programHalaqat(assignOpen.id);
    const existingIds = existing.map((l) => l.halaqa_id);
    const toAdd = selectedHalaqat.filter((id) => !existingIds.includes(id));
    const toRemove = existing.filter((l) => !selectedHalaqat.includes(l.halaqa_id));

    if (toRemove.length) {
      const { error } = await (supabase as any)
        .from("tarbawi_program_halaqat").delete().in("id", toRemove.map((l) => l.id));
      if (error) { setSaving(false); toast.error("تعذر إزالة حلقة: " + error.message); return; }
    }
    let notified = 0;
    if (toAdd.length) {
      const { error } = await (supabase as any).from("tarbawi_program_halaqat").insert(
        toAdd.map((halaqa_id) => ({
          program_id: assignOpen.id, halaqa_id, notified_at: new Date().toISOString(),
        })),
      );
      if (error) { setSaving(false); toast.error("تعذر إضافة حلقة: " + error.message); return; }
      notified = await notifyTeachers(assignOpen, toAdd);
    }
    setSaving(false);
    toast.success(notified ? `تم الحفظ وإشعار ${notified} معلماً` : "تم حفظ الحلقات");
    setAssignOpen(null);
    fetchAll();
  };

  const resendNotification = async (p: Program) => {
    const ids = programHalaqat(p.id).map((l) => l.halaqa_id);
    if (!ids.length) { toast.error("لا توجد حلقات مسندة"); return; }
    const n = await notifyTeachers(p, ids);
    toast.success(n ? `تم إرسال الإشعار إلى ${n} معلماً` : "لا يوجد معلمون مرتبطون بالحلقات");
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-primary" /> البرامج التربوية
          </h1>
          <PageDateHeader className="mt-1" />
        </div>
        <Button onClick={openCreate} aria-label="إضافة برنامج تربوي">
          <Plus className="w-4 h-4 ml-1" /> برنامج جديد
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
      ) : programs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HeartHandshake className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد برامج تربوية بعد</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const pl = programHalaqat(p.id);
            const students = pl.reduce((s, l) => s + (studentCounts[l.halaqa_id] || 0), 0);
            const entered = weekEntries[p.id] || 0;
            const pct = students ? Math.round((entered / students) * 100) : 0;
            return (
              <Card key={p.id} className="border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant={p.status === "active" ? "default" : "outline"}>
                      {PROGRAM_STATUS_LABELS[p.status] || p.status}
                    </Badge>
                  </div>
                  {p.goal && <p className="text-xs text-muted-foreground">{p.goal}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted p-2">
                      <p className="text-lg font-bold">{pl.length}</p>
                      <p className="text-[10px] text-muted-foreground">حلقة</p>
                    </div>
                    <div className="rounded-xl bg-muted p-2">
                      <p className="text-lg font-bold">{students}</p>
                      <p className="text-[10px] text-muted-foreground">طالب</p>
                    </div>
                    <div className="rounded-xl bg-muted p-2">
                      <p className="text-lg font-bold">{pct}%</p>
                      <p className="text-[10px] text-muted-foreground">إدخال الأسبوع</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {p.session_weekday !== null && (
                      <p>يوم الجلسة: {WEEKDAY_LABELS[p.session_weekday] || "—"}</p>
                    )}
                    {p.start_date && <p>من {formatDateSmart(p.start_date)}{p.end_date ? ` إلى ${formatDateSmart(p.end_date)}` : ""}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      <Pencil className="w-3 h-3 ml-1" /> تعديل
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAssign(p)}>
                      <BookOpen className="w-3 h-3 ml-1" /> الحلقات
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => resendNotification(p)}>
                      <Send className="w-3 h-3 ml-1" /> إشعار المعلمين
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل البرنامج" : "برنامج تربوي جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم البرنامج *</Label>
              <Input value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>الهدف</Label>
              <Input value={form.goal} maxLength={200} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description} maxLength={1000} rows={3}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البداية</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>تاريخ النهاية</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>يوم الجلسة الأسبوعية</Label>
                <Select value={form.session_weekday} onValueChange={(v) => setForm({ ...form, session_weekday: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROGRAM_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveProgram} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* assign halaqat */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>الحلقات المشمولة — {assignOpen?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            <Users className="w-3 h-3 inline ml-1" />
            يصل إشعار تلقائي لمعلم كل حلقة تُضاف، مع رابط صفحة المتابعة.
          </p>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {halaqat.map((h) => (
              <label key={h.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer">
                <Checkbox
                  checked={selectedHalaqat.includes(h.id)}
                  onCheckedChange={(c) =>
                    setSelectedHalaqat((prev) => (c ? [...prev, h.id] : prev.filter((x) => x !== h.id)))
                  }
                  aria-label={`اختيار ${h.name}`}
                />
                <span className="text-sm">{h.name}</span>
                <span className="text-xs text-muted-foreground mr-auto">{studentCounts[h.id] || 0} طالب</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveAssignment} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ وإشعار"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
