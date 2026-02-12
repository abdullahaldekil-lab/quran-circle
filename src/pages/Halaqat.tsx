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

const Halaqat = () => {
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [studentsByHalaqa, setStudentsByHalaqa] = useState<Record<string, any[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentsDialogId, setStudentsDialogId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", teacher_id: "", location: "", schedule: "" });

  const fetchData = async () => {
    const [halaqatRes, teachersRes, studentsRes] = await Promise.all([
      supabase.from("halaqat").select("*, profiles:teacher_id(full_name)").eq("active", true),
      supabase.from("profiles").select("id, full_name").in("role", ["teacher", "assistant_teacher"]),
      supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active"),
    ]);
    setHalaqat(halaqatRes.data || []);
    setTeachers(teachersRes.data || []);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("halaqat").insert({
      name: form.name,
      teacher_id: form.teacher_id || null,
      location: form.location || null,
      schedule: form.schedule || null,
    });
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success("تمت إضافة الحلقة");
    setDialogOpen(false);
    setForm({ name: "", teacher_id: "", location: "", schedule: "" });
    fetchData();
  };

  const getCapacityStatus = (count: number, max: number) => {
    if (count >= max) return { label: "مكتمل", color: "bg-green-500 text-white" };
    if (count >= max * 0.8) return { label: "قارب الاكتمال", color: "bg-yellow-500 text-white" };
    return { label: "ناقص", color: "bg-orange-500 text-white" };
  };

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
                    {teachers.map((t) => (
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

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1"
                  onClick={() => setStudentsDialogId(h.id)}
                >
                  <User className="w-3 h-3 ml-1" />
                  عرض الطلاب ({count})
                </Button>
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
    </div>
  );
};

export default Halaqat;
