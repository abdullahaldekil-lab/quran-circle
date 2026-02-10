import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterHalaqa, setFilterHalaqa] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    halaqa_id: "",
    guardian_name: "",
    guardian_phone: "",
    current_level: "مبتدئ",
  });

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("*, halaqat(name)")
      .eq("status", "active")
      .order("full_name");
    setStudents(data || []);
  };

  const fetchHalaqat = async () => {
    const { data } = await supabase.from("halaqat").select("*").eq("active", true);
    setHalaqat(data || []);
  };

  useEffect(() => {
    fetchStudents();
    fetchHalaqat();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("students").insert({
      full_name: form.full_name,
      halaqa_id: form.halaqa_id || null,
      guardian_name: form.guardian_name || null,
      guardian_phone: form.guardian_phone || null,
      current_level: form.current_level,
    });
    if (error) {
      toast.error("حدث خطأ أثناء الإضافة");
      return;
    }
    toast.success("تمت إضافة الطالب بنجاح");
    setDialogOpen(false);
    setForm({ full_name: "", halaqa_id: "", guardian_name: "", guardian_phone: "", current_level: "مبتدئ" });
    fetchStudents();
  };

  const filtered = students.filter((s) => {
    const matchSearch = s.full_name.includes(search);
    const matchHalaqa = filterHalaqa === "all" || s.halaqa_id === filterHalaqa;
    return matchSearch && matchHalaqa;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الطلاب</h1>
          <p className="text-muted-foreground text-sm">{students.length} طالب مسجّل</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              إضافة طالب
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة طالب جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم الطالب</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>الحلقة</Label>
                <Select value={form.halaqa_id} onValueChange={(v) => setForm({ ...form, halaqa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                  <SelectContent>
                    {halaqat.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>اسم ولي الأمر</Label>
                <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>هاتف ولي الأمر</Label>
                <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} dir="ltr" />
              </div>
               <div className="space-y-2">
                <Label>المستوى</Label>
                <Select value={form.current_level} onValueChange={(v) => setForm({ ...form, current_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">إضافة</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن طالب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={filterHalaqa} onValueChange={setFilterHalaqa}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="كل الحلقات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحلقات</SelectItem>
            {halaqat.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((student) => (
          <Card key={student.id} className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/students/${student.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{student.full_name}</h3>
                  <p className="text-xs text-muted-foreground">{student.halaqat?.name || "بدون حلقة"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">{student.current_level}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا يوجد طلاب</p>
        </div>
      )}
    </div>
  );
};

export default Students;
