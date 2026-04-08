import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, User, Users, ChevronLeft, ChevronRight, Upload, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/useRole";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import CsvBulkImport from "@/components/CsvBulkImport";
import { gregorianToHijri, hijriToGregorian } from "@/lib/hijri";
import StudentNameLink from "@/components/StudentNameLink";

const PAGE_SIZE = 20;

const Students = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isManager, isAdminStaff, isTeacher } = useRole();
  const { allowedHalaqatIds, filterHalaqat: filterHalaqatAccess, loading: accessLoading } = useTeacherHalaqat();
  const canBulkImport = isManager || isAdminStaff;
  const canToggleElite = isManager || isTeacher;

  // URL-based filters
  const urlStatus = searchParams.get("status"); // "active" | "inactive" | null (all)
  const urlLevel = searchParams.get("level");
  const urlNewThisMonth = searchParams.get("new_this_month") === "true";

  // Distinguished students state (new system)
  const [distinguishedMap, setDistinguishedMap] = useState<Record<string, { id: string; track_id: string; track_name: string }>>({});
  const [eliteToggling, setEliteToggling] = useState<string | null>(null);
  const [tracks, setTracks] = useState<{ id: string; track_name: string }[]>([]);
  const [starDialogOpen, setStarDialogOpen] = useState(false);
  const [starStudentId, setStarStudentId] = useState<string | null>(null);
  const [starTrackId, setStarTrackId] = useState("");

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
      .order("full_name")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    // Apply status filter from URL or default to "active"
    if (urlStatus === "inactive") {
      query = query.eq("status", "inactive");
    } else if (urlStatus === "active" || !urlStatus) {
      query = query.eq("status", "active");
    }

    // Apply level filter from URL
    if (urlLevel) {
      query = query.eq("current_level", urlLevel);
    }

    // Apply new-this-month filter from URL
    if (urlNewThisMonth) {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte("created_at", firstOfMonth);
    }

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
  }, [page, filterHalaqa, search, allowedHalaqatIds, accessLoading, urlStatus, urlLevel, urlNewThisMonth]);

  const fetchHalaqat = async () => {
    const { data } = await supabase.from("halaqat").select("*").eq("active", true);
    setHalaqat(filterHalaqatAccess(data || []));
  };

  const fetchLevels = async () => {
    const { data } = await supabase.from("memorization_levels").select("*").eq("active", true).order("sort_order");
    setLevels(data || []);
  };

  const fetchDistinguished = useCallback(async () => {
    const { data } = await supabase
      .from("distinguished_students")
      .select("id, student_id, track_id, excellence_tracks:track_id(track_name)");
    const map: Record<string, { id: string; track_id: string; track_name: string }> = {};
    (data || []).forEach((d: any) => {
      map[d.student_id] = { id: d.id, track_id: d.track_id, track_name: d.excellence_tracks?.track_name || "تميّز" };
    });
    setDistinguishedMap(map);
  }, []);

  const fetchTracks = async () => {
    const { data } = await supabase
      .from("excellence_tracks")
      .select("id, track_name")
      .eq("is_active", true)
      .order("track_name");
    setTracks(data || []);
  };

  const handleStarClick = (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    if (!canToggleElite) return;

    const existing = distinguishedMap[studentId];
    if (existing) {
      // Remove from track
      removeStar(studentId);
    } else {
      // Open dialog to select track
      setStarStudentId(studentId);
      setStarTrackId(tracks[0]?.id || "");
      setStarDialogOpen(true);
    }
  };

  const removeStar = async (studentId: string) => {
    const rec = distinguishedMap[studentId];
    if (!rec) return;
    setEliteToggling(studentId);
    const { error } = await supabase.from("distinguished_students").delete().eq("id", rec.id);
    if (error) toast.error("خطأ: " + error.message);
    else {
      setDistinguishedMap(prev => { const n = { ...prev }; delete n[studentId]; return n; });
      toast.success("تم إزالة الطالب من مسار التميّز");
    }
    setEliteToggling(null);
  };

  const addStar = async () => {
    if (!starStudentId || !starTrackId) return;
    setEliteToggling(starStudentId);

    // Check duplicate
    const existing = distinguishedMap[starStudentId];
    if (existing) {
      toast.error("هذا الطالب مسجل مسبقًا في مسار التميّز.");
      setEliteToggling(null);
      setStarDialogOpen(false);
      return;
    }

    const { data, error } = await supabase
      .from("distinguished_students")
      .insert({ student_id: starStudentId, track_id: starTrackId, added_by: user?.id, is_star: true })
      .select("id, track_id, excellence_tracks:track_id(track_name)")
      .single();

    if (error) toast.error("خطأ: " + error.message);
    else {
      const trackName = (data as any).excellence_tracks?.track_name || "تميّز";
      setDistinguishedMap(prev => ({
        ...prev,
        [starStudentId]: { id: data.id, track_id: data.track_id, track_name: trackName },
      }));
      toast.success("تم إضافة الطالب لمسار التميّز");
    }
    setEliteToggling(null);
    setStarDialogOpen(false);
  };

  useEffect(() => {
    fetchHalaqat();
    fetchLevels();
    fetchDistinguished();
    fetchTracks();
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
        <div className="flex gap-2 flex-wrap">
          {isManager && (
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const { error } = await supabase.functions.invoke('check-absence-warnings');
                if (error) throw error;
                toast.success('تم فحص الغياب وإرسال الإنذارات');
                fetchStudents();
              } catch {
                toast.error('حدث خطأ أثناء فحص الغياب');
              }
            }}>
              فحص الغياب التراكمي
            </Button>
          )}
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
        {students.map((student) => {
          const distinguished = distinguishedMap[student.id];
          const isElite = !!distinguished;
          return (
          <Card key={student.id} className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/students/${student.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate"><StudentNameLink studentId={student.id} studentName={student.full_name} /></h3>
                  <p className="text-xs text-muted-foreground">{student.halaqat?.name || "بدون حلقة"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">{student.current_level}</Badge>
                    {isElite && <Badge variant="outline" className="text-xs border-amber-300">{distinguished.track_name}</Badge>}
                  </div>
                </div>
                {canToggleElite && (
                  <button
                    onClick={(e) => handleStarClick(e, student.id)}
                    disabled={eliteToggling === student.id}
                    className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
                    title={isElite ? "إزالة من مسار التميّز" : "إضافة لمسار التميّز"}
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${isElite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"}`}
                    />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
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

      {/* Star Track Selection Dialog */}
      <Dialog open={starDialogOpen} onOpenChange={setStarDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>اختر مسار التميّز</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Select value={starTrackId} onValueChange={setStarTrackId}>
              <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
              <SelectContent>
                {tracks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tracks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">لا توجد مسارات. أنشئ مسارًا أولاً من إدارة المسارات.</p>
            )}
            <Button className="w-full" onClick={addStar} disabled={!starTrackId}>
              إضافة لمسار التميّز
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;
