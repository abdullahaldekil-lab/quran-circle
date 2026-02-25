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
import { Plus, BookOpen, Users, User, Pencil, Trash2 } from "lucide-react";
import { useRole } from "@/hooks/useRole";

interface Teacher {
  id: string;
  full_name: string;
  assigned_halaqa_id: string | null;
}

const Halaqat = () => {
  const { isManager } = useRole();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [levelTracks, setLevelTracks] = useState<any[]>([]);
  const [studentsByHalaqa, setStudentsByHalaqa] = useState<Record<string, any[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentsDialogId, setStudentsDialogId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", teacher_id: "", location: "", schedule: "", level_track_id: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", teacher_id: "", location: "", schedule: "", capacity_max: 25, level_track_id: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    const [halaqatRes, teachersRes, studentsRes, tracksRes] = await Promise.all([
      supabase.from("halaqat").select("*, profiles:teacher_id(full_name)").eq("active", true),
      supabase.from("profiles").select("id, full_name, assigned_halaqa_id").in("role", ["teacher", "assistant_teacher"]),
      supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active"),
      supabase.from("level_tracks").select("*").eq("active", true).order("sort_order"),
    ]);
    setHalaqat(halaqatRes.data || []);
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

  /** Get available teachers for selection. For edit mode, include the current teacher. */
  const getAvailableTeachers = (currentTeacherId?: string) => {
    return teachers.filter((t) => {
      // Always show the current teacher of this halaqa
      if (currentTeacherId && t.id === currentTeacherId) return true;
      // Show only unassigned teachers
      return !t.assigned_halaqa_id;
    });
  };

  /** Link teacher to halaqa with conflict validation and synchronized updates */
  const linkTeacherToHalaqa = async (
    teacherId: string | null,
    halaqaId: string,
    oldTeacherId?: string | null
  ): Promise<boolean> => {
    if (teacherId) {
      // Check if teacher is already assigned to another halaqa
      const teacher = teachers.find((t) => t.id === teacherId);
      if (teacher?.assigned_halaqa_id && teacher.assigned_halaqa_id !== halaqaId) {
        toast.error("هذا المعلم مرتبط بالفعل بحلقة أخرى ولا يمكن ربطه بحلقة إضافية.");
        return false;
      }

      // Check if halaqa already has a different teacher
      const halaqa = halaqat.find((h) => h.id === halaqaId);
      if (halaqa?.teacher_id && halaqa.teacher_id !== teacherId) {
        toast.error("هذه الحلقة لديها معلم بالفعل ولا يمكن ربط معلم آخر بها.");
        return false;
      }
    }

    // Remove old teacher's assignment if changing
    if (oldTeacherId && oldTeacherId !== teacherId) {
      await supabase
        .from("profiles")
        .update({ assigned_halaqa_id: null } as any)
        .eq("id", oldTeacherId);
    }

    // Update halaqa's teacher_id
    const { error: halaqaError } = await supabase
      .from("halaqat")
      .update({ teacher_id: teacherId })
      .eq("id", halaqaId);
    if (halaqaError) return false;

    // Update new teacher's assigned_halaqa_id
    if (teacherId) {
      await supabase
        .from("profiles")
        .update({ assigned_halaqa_id: halaqaId } as any)
        .eq("id", teacherId);
    }

    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    // Insert halaqa first without teacher
    const { data: newHalaqa, error } = await supabase.from("halaqat").insert({
      name: form.name,
      teacher_id: null,
      location: form.location || null,
      schedule: form.schedule || null,
      level_track_id: form.level_track_id || null,
    }).select("id").single();

    if (error || !newHalaqa) { toast.error("حدث خطأ"); return; }

    // Link teacher if selected
    if (form.teacher_id) {
      const linked = await linkTeacherToHalaqa(form.teacher_id, newHalaqa.id);
      if (!linked) {
        // Rollback: delete the halaqa
        await supabase.from("halaqat").delete().eq("id", newHalaqa.id);
        return;
      }
    }

    toast.success("تم ربط المعلم بالحلقة بنجاح.");
    setDialogOpen(false);
    setForm({ name: "", teacher_id: "", location: "", schedule: "", level_track_id: "" });
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

    // If teacher changed, validate and link
    if (oldTeacherId !== newTeacherId) {
      const linked = await linkTeacherToHalaqa(newTeacherId, editId, oldTeacherId);
      if (!linked) return;
    }

    // Update other fields (teacher_id already updated by linkTeacherToHalaqa)
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
    
    // Remove teacher assignment before deactivating
    if (halaqa?.teacher_id) {
      await supabase
        .from("profiles")
        .update({ assigned_halaqa_id: null } as any)
        .eq("id", halaqa.teacher_id);
    }

    const { error } = await supabase.from("halaqat").update({ active: false }).eq("id", deleteId);
    if (error) { toast.error("حدث خطأ أثناء الحذف"); return; }
    toast.success("تم حذف الحلقة");
    setDeleteOpen(false);
    setDeleteId(null);
    fetchData();
  };

  const availableTeachersForAdd = getAvailableTeachers();
  const availableTeachersForEdit = getAvailableTeachers(editForm.teacher_id);

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
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setStudentsDialogId(h.id)}
                  >
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
            <DialogTitle>
              طلاب الحلقة: {halaqat.find((h) => h.id === studentsDialogId)?.name}
            </DialogTitle>
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
