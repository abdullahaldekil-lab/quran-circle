import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StudentNameLink from "@/components/StudentNameLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, BookOpen, Users, User, Pencil, Trash2, ScrollText, ClipboardList, CalendarDays, Settings2, CheckCircle2, BookMarked, GraduationCap, ListChecks } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useRole } from "@/hooks/useRole";

interface Teacher {
  id: string;
  full_name: string;
  assigned_halaqa_id: string | null;
  assigned_assistant_halaqa_id: string | null;
}

const TalqeenHalaqat = () => {
  const { isManager } = useRole();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [levelTracks, setLevelTracks] = useState<any[]>([]);
  const [studentsByHalaqa, setStudentsByHalaqa] = useState<Record<string, any[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentsDialogId, setStudentsDialogId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", teacher_id: "", assistant_teacher_id: "", location: "", schedule: "", level_track_id: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", teacher_id: "", assistant_teacher_id: "", location: "", schedule: "", capacity_max: 25, level_track_id: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // خطة الحفظ
  const [planHalaqaId, setPlanHalaqaId] = useState<string | null>(null);
  const [planSessions, setPlanSessions] = useState<any[]>([]);
  const [planForm, setPlanForm] = useState({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" });
  const [planSaving, setPlanSaving] = useState(false);

  const fetchPlanSessions = async (halaqaId: string) => {
    const { data, error } = await supabase
      .from("talqeen_sessions")
      .select("*")
      .eq("halaqa_id", halaqaId)
      .order("session_date", { ascending: false });
    if (error) { toast.error("تعذر جلب الخطة"); return; }
    setPlanSessions(data || []);
  };

  const openPlan = async (halaqaId: string) => {
    setPlanHalaqaId(halaqaId);
    setPlanForm({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" });
    await fetchPlanSessions(halaqaId);
  };

  const submitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planHalaqaId || !planForm.surah || !planForm.session_date) {
      toast.error("يرجى إدخال السورة والتاريخ");
      return;
    }
    setPlanSaving(true);
    const payload: any = {
      halaqa_id: planHalaqaId,
      session_date: planForm.session_date,
      surah: planForm.surah,
      from_ayah: planForm.from_ayah ? Number(planForm.from_ayah) : null,
      to_ayah: planForm.to_ayah ? Number(planForm.to_ayah) : null,
      status: planForm.status,
      notes: planForm.notes || null,
    };
    let error;
    if (planForm.id) {
      ({ error } = await supabase.from("talqeen_sessions").update(payload).eq("id", planForm.id));
    } else {
      ({ error } = await supabase.from("talqeen_sessions").insert(payload));
    }
    setPlanSaving(false);
    if (error) { toast.error("تعذر حفظ الجلسة"); return; }
    toast.success(planForm.id ? "تم تحديث الجلسة" : "تمت إضافة الجلسة للخطة");
    setPlanForm({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" });
    fetchPlanSessions(planHalaqaId);
  };

  const editPlanSession = (s: any) => {
    setPlanForm({
      id: s.id,
      session_date: s.session_date,
      surah: s.surah,
      from_ayah: s.from_ayah?.toString() || "",
      to_ayah: s.to_ayah?.toString() || "",
      status: s.status || "planned",
      notes: s.notes || "",
    });
  };

  const deletePlanSession = async (id: string) => {
    const { error } = await supabase.from("talqeen_sessions").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تم حذف الجلسة");
    if (planHalaqaId) fetchPlanSessions(planHalaqaId);
  };

  const planStatusBadge = (s: string | null) => {
    const map: Record<string, { label: string; cls: string }> = {
      planned: { label: "مخططة", cls: "bg-blue-100 text-blue-700" },
      in_progress: { label: "جارية", cls: "bg-amber-100 text-amber-700" },
      completed: { label: "مكتملة", cls: "bg-green-100 text-green-700" },
    };
    const m = map[s || "planned"] || map.planned;
    return <Badge className={m.cls}>{m.label}</Badge>;
  };


  const fetchData = async () => {
    const [halaqatRes, teachersRes, studentsRes, tracksRes] = await Promise.all([
      supabase.from("halaqat").select("*, profiles:teacher_id(full_name), assistant:assistant_teacher_id(full_name)").eq("active", true),
      supabase.from("profiles").select("id, full_name, assigned_halaqa_id, assigned_assistant_halaqa_id").in("role", ["teacher", "assistant_teacher"]),
      supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active"),
      supabase.from("level_tracks").select("*").eq("active", true).order("sort_order"),
    ]);
    // Filter to only talqeen halaqat (those with "تلقين" in the name)
    const allHalaqat = halaqatRes.data || [];
    setHalaqat(allHalaqat.filter((h: any) => h.name.includes("تلقين")));
    setTeachers((teachersRes.data as Teacher[]) || []);
    setLevelTracks(tracksRes.data || []);

    const grouped: Record<string, any[]> = {};
    (studentsRes.data || []).forEach((s: any) => {
      if (s.halaqa_id) {
        if (!grouped[s.halaqa_id]) grouped[s.halaqa_id] = [];
        grouped[s.halaqa_id].push(s);
      }
    });
    setStudentsByHalaqa(grouped);
  };

  useEffect(() => { fetchData(); }, []);

  const getAvailableTeachers = (currentTeacherId?: string) => {
    return teachers.filter((t) => {
      if (currentTeacherId && t.id === currentTeacherId) return true;
      return !t.assigned_halaqa_id;
    });
  };

  const getAvailableAssistants = (currentAssistantId?: string) => {
    return teachers.filter((t) => {
      if (currentAssistantId && t.id === currentAssistantId) return true;
      return !t.assigned_assistant_halaqa_id;
    });
  };

  const linkTeacherToHalaqa = async (teacherId: string | null, halaqaId: string, oldTeacherId?: string | null) => {
    if (oldTeacherId && oldTeacherId !== teacherId) {
      await supabase.from("profiles").update({ assigned_halaqa_id: null } as any).eq("id", oldTeacherId);
    }
    const { error } = await supabase.from("halaqat").update({ teacher_id: teacherId }).eq("id", halaqaId);
    if (error) return false;
    if (teacherId) {
      await supabase.from("profiles").update({ assigned_halaqa_id: halaqaId } as any).eq("id", teacherId);
    }
    return true;
  };

  const linkAssistantToHalaqa = async (assistantId: string | null, halaqaId: string, oldAssistantId?: string | null) => {
    if (oldAssistantId && oldAssistantId !== assistantId) {
      await supabase.from("profiles").update({ assigned_assistant_halaqa_id: null } as any).eq("id", oldAssistantId);
    }
    const { error } = await supabase.from("halaqat").update({ assistant_teacher_id: assistantId }).eq("id", halaqaId);
    if (error) return false;
    if (assistantId) {
      await supabase.from("profiles").update({ assigned_assistant_halaqa_id: halaqaId } as any).eq("id", assistantId);
    }
    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: newHalaqa, error } = await supabase.from("halaqat").insert({
      name: form.name,
      teacher_id: null,
      assistant_teacher_id: null,
      location: form.location || null,
      schedule: form.schedule || null,
      level_track_id: form.level_track_id || null,
    }).select("id").single();

    if (error || !newHalaqa) { toast.error("حدث خطأ"); return; }

    if (form.teacher_id) {
      const linked = await linkTeacherToHalaqa(form.teacher_id, newHalaqa.id);
      if (!linked) {
        await supabase.from("halaqat").delete().eq("id", newHalaqa.id);
        return;
      }
    }
    if (form.assistant_teacher_id) {
      const linked = await linkAssistantToHalaqa(form.assistant_teacher_id, newHalaqa.id);
      if (!linked) {
        if (form.teacher_id) {
          await supabase.from("profiles").update({ assigned_halaqa_id: null } as any).eq("id", form.teacher_id);
        }
        await supabase.from("halaqat").delete().eq("id", newHalaqa.id);
        return;
      }
    }

    toast.success("تم إضافة حلقة التلقين بنجاح.");
    setDialogOpen(false);
    setForm({ name: "", teacher_id: "", assistant_teacher_id: "", location: "", schedule: "", level_track_id: "" });
    fetchData();
  };

  const getCapacityStatus = (count: number, max: number) => {
    if (count >= max) return { label: "مكتمل", color: "bg-green-500 text-white" };
    if (count >= max * 0.8) return { label: "قارب الاكتمال", color: "bg-yellow-500 text-white" };
    return { label: "ناقص", color: "bg-orange-500 text-white" };
  };

  const openEditHalaqa = (h: any) => {
    setEditId(h.id);
    setEditForm({
      name: h.name,
      teacher_id: h.teacher_id || "",
      assistant_teacher_id: h.assistant_teacher_id || "",
      location: h.location || "",
      schedule: h.schedule || "",
      capacity_max: h.capacity_max || 25,
      level_track_id: h.level_track_id || "",
    });
    setEditOpen(true);
  };

  const handleEditHalaqa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    const currentHalaqa = halaqat.find((h) => h.id === editId);
    const oldTeacherId = currentHalaqa?.teacher_id || null;
    const newTeacherId = editForm.teacher_id || null;
    const oldAssistantId = currentHalaqa?.assistant_teacher_id || null;
    const newAssistantId = editForm.assistant_teacher_id || null;

    if (oldTeacherId !== newTeacherId) {
      const linked = await linkTeacherToHalaqa(newTeacherId, editId, oldTeacherId);
      if (!linked) return;
    }
    if (oldAssistantId !== newAssistantId) {
      const linked = await linkAssistantToHalaqa(newAssistantId, editId, oldAssistantId);
      if (!linked) return;
    }

    const { error } = await supabase.from("halaqat").update({
      name: editForm.name,
      location: editForm.location || null,
      schedule: editForm.schedule || null,
      capacity_max: editForm.capacity_max,
      level_track_id: editForm.level_track_id || null,
    }).eq("id", editId);

    if (error) { toast.error("حدث خطأ أثناء التعديل"); return; }
    toast.success("تم تعديل الحلقة بنجاح.");
    setEditOpen(false);
    fetchData();
  };

  const handleDeleteHalaqa = async () => {
    if (!deleteId) return;
    const halaqa = halaqat.find((h) => h.id === deleteId);
    if (halaqa?.teacher_id) {
      await supabase.from("profiles").update({ assigned_halaqa_id: null } as any).eq("id", halaqa.teacher_id);
    }
    if (halaqa?.assistant_teacher_id) {
      await supabase.from("profiles").update({ assigned_assistant_halaqa_id: null } as any).eq("id", halaqa.assistant_teacher_id);
    }
    const { error } = await supabase.from("halaqat").update({ active: false }).eq("id", deleteId);
    if (error) { toast.error("حدث خطأ أثناء الحذف"); return; }
    toast.success("تم حذف الحلقة");
    setDeleteOpen(false);
    setDeleteId(null);
    fetchData();
  };

  const availableTeachersForAdd = getAvailableTeachers();
  const availableAssistantsForAdd = getAvailableAssistants();
  const availableTeachersForEdit = getAvailableTeachers(editForm.teacher_id);
  const availableAssistantsForEdit = getAvailableAssistants(editForm.assistant_teacher_id);

  const totalStudents = halaqat.reduce((sum, h) => sum + (studentsByHalaqa[h.id]?.length || 0), 0);
  const totalCapacity = halaqat.reduce((sum, h) => sum + (h.capacity_max || 25), 0);
  const totalPct = totalCapacity > 0 ? Math.min((totalStudents / totalCapacity) * 100, 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">حلقات التلقين</h1>
            <p className="text-muted-foreground text-sm">{halaqat.length} حلقات تلقين</p>
          </div>
          <div className="mr-4 flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 transition-all hover:bg-primary/15 hover:shadow-md cursor-default group">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-primary">{totalStudents}</span>
                <span className="text-xs text-muted-foreground">/ {totalCapacity}</span>
              </div>
            </div>
            <div className="w-16 mr-2">
              <Progress value={totalPct} className="h-1.5" />
            </div>
          </div>
        </div>
        {isManager && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />إضافة حلقة تلقين</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة حلقة تلقين جديدة</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>اسم الحلقة</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>المعلم</Label>
                  <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المعلم" /></SelectTrigger>
                    <SelectContent>
                      {availableTeachersForAdd.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المعلم المساعد</Label>
                  <Select value={form.assistant_teacher_id} onValueChange={(v) => setForm({ ...form, assistant_teacher_id: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المعلم المساعد (اختياري)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">بدون مساعد</SelectItem>
                      {availableAssistantsForAdd.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المكان</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>الجدول</Label>
                  <Input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="مثال: السبت - الخميس 4:00 - 6:00" />
                </div>
                <div className="space-y-2">
                  <Label>مسار الحفظ</Label>
                  <Select value={form.level_track_id} onValueChange={(v) => setForm({ ...form, level_track_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المسار (اختياري)" /></SelectTrigger>
                    <SelectContent>
                      {levelTracks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">إضافة</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {halaqat.map((h) => {
          const students = studentsByHalaqa[h.id] || [];
          const count = students.length;
          const max = h.capacity_max || 25;
          const pct = Math.min((count / max) * 100, 100);
          const status = getCapacityStatus(count, max);

          return (
            <Card key={h.id} className="animate-slide-in hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                      <ScrollText className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-base">{h.name}</CardTitle>
                  </div>
                  <Badge className={status.color}>{status.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">المعلم: {h.profiles?.full_name || "غير محدد"}</p>
                {h.assistant_teacher_id && <p className="text-muted-foreground">المعلم المساعد: {h.assistant?.full_name || "غير محدد"}</p>}
                {h.level_track_id && (
                  <p className="text-muted-foreground">المسار: {levelTracks.find(t => t.id === h.level_track_id)?.name || "—"}</p>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> الطلاب
                    </span>
                    <span className="font-medium">{count} / {max}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
                {h.location && <p className="text-muted-foreground">المكان: {h.location}</p>}
                {h.schedule && <p className="text-muted-foreground">الجدول: {h.schedule}</p>}
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button variant="outline" size="sm" className="flex-1 min-w-[120px]" onClick={() => setStudentsDialogId(h.id)}>
                    <User className="w-3 h-3 ml-1" />
                    عرض الطلاب ({count})
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-[120px]" onClick={() => openPlan(h.id)}>
                    <ClipboardList className="w-3 h-3 ml-1" />
                    خطة الحفظ
                  </Button>
                  {isManager && (
                    <>
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => openEditHalaqa(h)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { setDeleteId(h.id); setDeleteOpen(true); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Students list dialog */}
      <Dialog open={!!studentsDialogId} onOpenChange={() => setStudentsDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>طلاب الحلقة: {halaqat.find((h) => h.id === studentsDialogId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {(studentsByHalaqa[studentsDialogId || ""] || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-6">لا يوجد طلاب</p>
            ) : (
              (studentsByHalaqa[studentsDialogId || ""] || []).map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <StudentNameLink studentId={s.id} studentName={s.full_name} className="text-sm" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Halaqa Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل الحلقة</DialogTitle></DialogHeader>
          <form onSubmit={handleEditHalaqa} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الحلقة</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>المعلم</Label>
              <Select value={editForm.teacher_id} onValueChange={(v) => setEditForm({ ...editForm, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المعلم" /></SelectTrigger>
                <SelectContent>
                  {availableTeachersForEdit.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                      {t.assigned_halaqa_id && t.id === editForm.teacher_id ? " (المعلم الحالي)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المعلم المساعد</Label>
              <Select value={editForm.assistant_teacher_id || "__none__"} onValueChange={(v) => setEditForm({ ...editForm, assistant_teacher_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="اختر المعلم المساعد (اختياري)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون مساعد</SelectItem>
                  {availableAssistantsForEdit.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                      {t.assigned_assistant_halaqa_id && t.id === editForm.assistant_teacher_id ? " (المساعد الحالي)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المكان</Label>
              <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الجدول</Label>
              <Input value={editForm.schedule} onChange={(e) => setEditForm({ ...editForm, schedule: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الحد الأقصى للطلاب</Label>
              <Input type="number" value={editForm.capacity_max} onChange={(e) => setEditForm({ ...editForm, capacity_max: Number(e.target.value) })} min={1} />
            </div>
            <div className="space-y-2">
              <Label>مسار الحفظ</Label>
              <Select value={editForm.level_track_id} onValueChange={(v) => setEditForm({ ...editForm, level_track_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المسار (اختياري)" /></SelectTrigger>
                <SelectContent>
                  {levelTracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">حفظ التعديلات</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Halaqa Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف هذه الحلقة؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم تعطيل الحلقة "{halaqat.find(h => h.id === deleteId)?.name}". يمكن استعادتها لاحقاً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHalaqa} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* خطة الحفظ Dialog */}
      <Dialog open={!!planHalaqaId} onOpenChange={(o) => { if (!o) { setPlanHalaqaId(null); setPlanSessions([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              خطة الحفظ — {halaqat.find((h) => h.id === planHalaqaId)?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submitPlan} className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="text-sm font-semibold">{planForm.id ? "تعديل جلسة" : "إضافة جلسة جديدة للخطة"}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>التاريخ</Label>
                <Input type="date" value={planForm.session_date} onChange={(e) => setPlanForm({ ...planForm, session_date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>السورة</Label>
                <Input value={planForm.surah} onChange={(e) => setPlanForm({ ...planForm, surah: e.target.value })} placeholder="مثال: البقرة" required />
              </div>
              <div className="space-y-1">
                <Label>من آية</Label>
                <Input type="number" min={1} value={planForm.from_ayah} onChange={(e) => setPlanForm({ ...planForm, from_ayah: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>إلى آية</Label>
                <Input type="number" min={1} value={planForm.to_ayah} onChange={(e) => setPlanForm({ ...planForm, to_ayah: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>الحالة</Label>
                <Select value={planForm.status} onValueChange={(v) => setPlanForm({ ...planForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">مخططة</SelectItem>
                    <SelectItem value="in_progress">جارية</SelectItem>
                    <SelectItem value="completed">مكتملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>ملاحظات</Label>
                <Textarea rows={2} value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={planSaving} className="flex-1">
                {planForm.id ? "حفظ التعديلات" : "إضافة للخطة"}
              </Button>
              {planForm.id && (
                <Button type="button" variant="outline" onClick={() => setPlanForm({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" })}>
                  إلغاء التعديل
                </Button>
              )}
            </div>
          </form>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4" /> جلسات الخطة ({planSessions.length})</h3>
            {planSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد جلسات في الخطة بعد</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {planSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.surah}</span>
                        {s.from_ayah && (
                          <span className="text-xs text-muted-foreground">
                            (آية {s.from_ayah}{s.to_ayah ? ` - ${s.to_ayah}` : ""})
                          </span>
                        )}
                        {planStatusBadge(s.status)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.session_date}
                        {s.notes && <span className="mr-2">• {s.notes}</span>}
                      </div>
                    </div>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => editPlanSession(s)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletePlanSession(s.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TalqeenHalaqat;
