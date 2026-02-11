import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, User, Users, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/useRole";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import CsvBulkImport from "@/components/CsvBulkImport";
import { gregorianToHijri, hijriToGregorian } from "@/lib/hijri";

const PAGE_SIZE = 20;

const Students = () => {
  const navigate = useNavigate();
  const { isManager, isAdminStaff } = useRole();
  const { allowedHalaqatIds, filterHalaqat: filterHalaqatAccess, loading: accessLoading } = useTeacherHalaqat();
  const canBulkImport = isManager || isAdminStaff;
  const [students, setStudents] = useState<any[]>([]);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterHalaqa, setFilterHalaqa] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [form, setForm] = useState({
    full_name: "",
    halaqa_id: "",
    guardian_name: "",
    guardian_phone: "",
    current_level: "مبتدئ",
    birth_date_gregorian: "",
    birth_date_hijri: "",
  });

  const fetchStudents = useCallback(async () => {
    if (accessLoading) return;
    let query = supabase
      .from("students")
      .select("*, halaqat(name)", { count: "exact" })
      .eq("status", "active")
      .order("full_name")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterHalaqa !== "all") {
      query = query.eq("halaqa_id", filterHalaqa);
    } else if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
      query = query.in("halaqa_id", allowedHalaqatIds);
    } else if (allowedHalaqatIds !== null && allowedHalaqatIds.length === 0) {
      setStudents([]);
      setTotalCount(0);
      return;
    }
    if (search) {
      query = query.ilike("full_name", `%${search}%`);
    }

    const { data, count } = await query;
    setStudents(data || []);
    setTotalCount(count || 0);
  }, [page, filterHalaqa, search, allowedHalaqatIds, accessLoading]);

  const fetchHalaqat = async () => {
    const { data } = await supabase.from("halaqat").select("*").eq("active", true);
    setHalaqat(data || []);
  };

  const fetchLevels = async () => {
    const { data } = await supabase.from("memorization_levels").select("*").eq("active", true).order("sort_order");
    setLevels(data || []);
  };

  useEffect(() => {
    fetchHalaqat();
    fetchLevels();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, filterHalaqa]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check halaqa capacity before adding
    if (form.halaqa_id) {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("halaqa_id", form.halaqa_id)
        .eq("status", "active");
      
      const selectedHalaqa = halaqat.find((h) => h.id === form.halaqa_id);
      const max = selectedHalaqa?.capacity_max || 25;
      
      if ((count || 0) >= max) {
        toast.error(`تم اكتمال العدد في هذه الحلقة (${max} طالب).`);
        return;
      }
    }

    const { error } = await supabase.from("students").insert({
      full_name: form.full_name,
      halaqa_id: form.halaqa_id || null,
      guardian_name: form.guardian_name || null,
      guardian_phone: form.guardian_phone || null,
      current_level: form.current_level,
      birth_date_gregorian: form.birth_date_gregorian || null,
      birth_date_hijri: form.birth_date_hijri || null,
    });
    if (error) {
      toast.error("حدث خطأ أثناء الإضافة");
      return;
    }
    toast.success("تمت إضافة الطالب بنجاح");
    setDialogOpen(false);
    setForm({ full_name: "", halaqa_id: "", guardian_name: "", guardian_phone: "", current_level: "مبتدئ", birth_date_gregorian: "", birth_date_hijri: "" });
    fetchStudents();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الطلاب</h1>
          <p className="text-muted-foreground text-sm">{totalCount} طالب مسجّل</p>
        </div>
        <div className="flex gap-2">
          {canBulkImport && (
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="w-4 h-4 ml-2" />
              استيراد جماعي
            </Button>
          )}
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
                <Label>تاريخ الميلاد (ميلادي)</Label>
                <Input
                  type="date"
                  value={form.birth_date_gregorian}
                  onChange={(e) => {
                    const greg = e.target.value;
                    let hijri = "";
                    if (greg) {
                      try { hijri = gregorianToHijri(new Date(greg)); } catch {}
                    }
                    setForm({ ...form, birth_date_gregorian: greg, birth_date_hijri: hijri });
                  }}
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الميلاد (هجري) - مثال: 1440/06/15</Label>
                <Input
                  value={form.birth_date_hijri}
                  onChange={(e) => {
                    const hijri = e.target.value;
                    let greg = "";
                    if (hijri && /^\d{4}\/\d{2}\/\d{2}$/.test(hijri)) {
                      const d = hijriToGregorian(hijri);
                      if (d) greg = d.toISOString().split("T")[0];
                    }
                    setForm({ ...form, birth_date_hijri: hijri, birth_date_gregorian: greg || form.birth_date_gregorian });
                  }}
                  placeholder="1440/06/15"
                  dir="ltr"
                  className="text-right"
                />
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
        <CsvBulkImport open={bulkOpen} onOpenChange={setBulkOpen} onComplete={fetchStudents} />
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
        {students.map((student) => (
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

      {students.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا يوجد طلاب</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>
            <ChevronRight className="w-4 h-4 ml-1" />
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page + 1} من {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            التالي
            <ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Students;
