import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, BookOpen, Users, User, Pencil, Trash2, UserCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRole } from "@/hooks/useRole";

interface Teacher {
  id: string;
  full_name: string;
  assigned_halaqa_id: string | null;
  assigned_assistant_halaqa_id: string | null;
}

const Halaqat = () => {
  const { isManager } = useRole();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [reserveTeachers, setReserveTeachers] = useState<any[]>([]);
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
  const [assignReserveOpen, setAssignReserveOpen] = useState(false);
  const [assignReserveTarget, setAssignReserveTarget] = useState<{ halaqaId: string; halaqaName: string; type: "teacher" | "assistant" } | null>(null);

  const fetchData = async () => {
    const halaqatRes = await supabase.from("halaqat").select("*, profiles:teacher_id(full_name), assistant:assistant_teacher_id(full_name)").eq("active", true);
    const teachersRes: any = await supabase.from("profiles").select("id, full_name, assigned_halaqa_id, assigned_assistant_halaqa_id").in("role", ["teacher", "assistant_teacher"]);
    const studentsRes = await supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active");
    const tracksRes = await supabase.from("level_tracks").select("*").eq("active", true).order("sort_order");
    const reserveRes: any = await (supabase as any).from("profiles").select("id, full_name, role").eq("is_reserve", true).eq("active", true);
    
    // Filter out talqeen halaqat (those with "تلقين" in the name)
    const allHalaqat = halaqatRes.data || [];
    setHalaqat(allHalaqat.filter((h: any) => !h.name.includes("تلقين")));
    setTeachers((teachersRes.data as Teacher[]) || []);
    setReserveTeachers(reserveRes.data || []);
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

  /** Get available teachers for main teacher selection */
  const getAvailableTeachers = (currentTeacherId?: string) => {
    return teachers.filter((t) => {
      if (currentTeacherId && t.id === currentTeacherId) return true;
      return !t.assigned_halaqa_id;
    });
  };

  /** Get available teachers for assistant teacher selection */
  const getAvailableAssistants = (currentAssistantId?: string) => {
    return teachers.filter((t) => {
      if (currentAssistantId && t.id === currentAssistantId) return true;
      return !t.assigned_assistant_halaqa_id;
    });
  };

  /** Link main teacher to halaqa with conflict validation */
  const linkTeacherToHalaqa = async (
    teacherId: string | null,
    halaqaId: string,
    oldTeacherId?: string | null
  ): Promise<boolean> => {
    if (teacherId) {
      const teacher = teachers.find((t) => t.id === teacherId);
      if (teacher?.assigned_halaqa_id && teacher.assigned_halaqa_id !== halaqaId) {
        toast.error("هذا المعلم مرتبط بالفعل بحلقة أخرى ولا يمكن ربطه بحلقة إضافية.");
        return false;
      }
      const halaqa = halaqat.find((h) => h.id === halaqaId);
      if (halaqa?.teacher_id && halaqa.teacher_id !== teacherId) {
        toast.error("هذه الحلقة لديها معلم بالفعل ولا يمكن ربط معلم آخر بها.");
        return false;
      }
    }

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

  /** Link assistant teacher to halaqa with conflict validation */
  const linkAssistantToHalaqa = async (
    assistantId: string | null,
    halaqaId: string,
    oldAssistantId?: string | null
  ): Promise<boolean> => {
    if (assistantId) {
      const assistant = teachers.find((t) => t.id === assistantId);
      if (assistant?.assigned_assistant_halaqa_id && assistant.assigned_assistant_halaqa_id !== halaqaId) {
        toast.error("هذا المعلم المساعد مرتبط بالفعل بحلقة أخرى ولا يمكن ربطه بحلقة إضافية.");
        return false;
      }
      const halaqa = halaqat.find((h) => h.id === halaqaId);
      if (halaqa?.assistant_teacher_id && halaqa.assistant_teacher_id !== assistantId) {
        toast.error("هذه الحلقة لديها معلم مساعد بالفعل ولا يمكن ربط معلم مساعد آخر بها.");
        return false;
      }
    }

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

    // Link main teacher
    if (form.teacher_id) {
      const linked = await linkTeacherToHalaqa(form.teacher_id, newHalaqa.id);
      if (!linked) {
        await supabase.from("halaqat").delete().eq("id", newHalaqa.id);
        return;
      }
    }

    // Link assistant teacher
    if (form.assistant_teacher_id) {
      const linked = await linkAssistantToHalaqa(form.assistant_teacher_id, newHalaqa.id);
      if (!linked) {
        // Rollback teacher link too
        if (form.teacher_id) {
          await supabase.from("profiles").update({ assigned_halaqa_id: null } as any).eq("id", form.teacher_id);
        }
        await supabase.from("halaqat").delete().eq("id", newHalaqa.id);
        return;
      }
    }

    toast.success("تم إضافة الحلقة بنجاح.");
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

    // Validate main teacher change
    if (oldTeacherId !== newTeacherId) {
      const linked = await linkTeacherToHalaqa(newTeacherId, editId, oldTeacherId);
      if (!linked) return;
    }

    // Validate assistant teacher change
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

    // Remove both teacher assignments
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

  const assignReserveTeacher = async (reserveId: string) => {
    if (!assignReserveTarget) return;
    const { halaqaId, type } = assignReserveTarget;
    
    if (type === "teacher") {
      const ok = await linkTeacherToHalaqa(reserveId, halaqaId);
      if (!ok) return;
    } else {
      const ok = await linkAssistantToHalaqa(reserveId, halaqaId);
      if (!ok) return;
    }
    
    // Remove reserve status
    await (supabase as any).from("profiles").update({ is_reserve: false }).eq("id", reserveId);
    
    toast.success("تم تعيين المعلم الاحتياطي بنجاح");
    setAssignReserveOpen(false);
    setAssignReserveTarget(null);
    fetchData();
  };

  // Find halaqat without teachers
  const halaqatWithoutTeacher = halaqat.filter((h: any) => !h.teacher_id);
  const halaqatWithoutAssistant = halaqat.filter((h: any) => !h.assistant_teacher_id);
  const hasVacantHalaqat = halaqatWithoutTeacher.length > 0 || halaqatWithoutAssistant.length > 0;
  const hasReserveTeachers = reserveTeachers.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الحلقات</h1>
          <p className="text-muted-foreground text-sm">{halaqat.length} حلقات</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />إضافة حلقة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة حلقة جديدة</DialogTitle></DialogHeader>
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
      </div>

      {/* Reserve Teacher Alert */}
      {isManager && hasReserveTeachers && hasVacantHalaqat && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <UserCheck className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">يوجد معلم احتياطي متاح</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <span>لديك {reserveTeachers.length} معلم احتياطي و {halaqatWithoutTeacher.length} حلقة بدون معلم — </span>
            {halaqatWithoutTeacher.map((h: any) => (
              <Button
                key={h.id}
                variant="link"
                size="sm"
                className="text-amber-800 dark:text-amber-200 p-0 h-auto font-bold underline mx-1"
                onClick={() => {
                  setAssignReserveTarget({ halaqaId: h.id, halaqaName: h.name, type: "teacher" });
                  setAssignReserveOpen(true);
                }}
              >
                تعيين لـ {h.name}
              </Button>
            ))}
          </AlertDescription>
        </Alert>
      )}

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
                      <BookOpen className="w-5 h-5 text-primary-foreground" />
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

                <div className="flex gap-2 mt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setStudentsDialogId(h.id)}>
                    <User className="w-3 h-3 ml-1" />
                    عرض الطلاب ({count})
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
                  <span className="text-sm">{s.full_name}</span>
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
    </div>
  );
};

export default Halaqat;
