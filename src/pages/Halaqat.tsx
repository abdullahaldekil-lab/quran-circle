import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, BookOpen } from "lucide-react";

const Halaqat = () => {
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", teacher_id: "", location: "", schedule: "" });

  const fetchData = async () => {
    const [halaqatRes, teachersRes, studentsRes] = await Promise.all([
      supabase.from("halaqat").select("*, profiles:teacher_id(full_name)").eq("active", true),
      supabase.from("profiles").select("id, full_name").in("role", ["teacher", "assistant_teacher"]),
      supabase.from("students").select("halaqa_id").eq("status", "active"),
    ]);
    setHalaqat(halaqatRes.data || []);
    setTeachers(teachersRes.data || []);
    
    const counts: Record<string, number> = {};
    (studentsRes.data || []).forEach((s: any) => {
      if (s.halaqa_id) counts[s.halaqa_id] = (counts[s.halaqa_id] || 0) + 1;
    });
    setStudentCounts(counts);
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
        {halaqat.map((h) => (
          <Card key={h.id} className="animate-slide-in hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary-foreground" />
                </div>
                <CardTitle className="text-base">{h.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">المعلم: {h.profiles?.full_name || "غير محدد"}</p>
              <p className="text-muted-foreground">عدد الطلاب: {studentCounts[h.id] || 0}</p>
              {h.location && <p className="text-muted-foreground">المكان: {h.location}</p>}
              {h.schedule && <p className="text-muted-foreground">الجدول: {h.schedule}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Halaqat;
