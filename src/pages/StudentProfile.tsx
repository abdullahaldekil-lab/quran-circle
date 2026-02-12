import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, User, Calendar, TrendingUp, Play, BookOpen, Mic, ChevronLeft, ChevronRight, ShieldAlert, Pencil, Trash2 } from "lucide-react";
import { formatHijriArabic, gregorianToHijri, hijriToGregorian } from "@/lib/hijri";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import StudentLevelProgress from "@/components/StudentLevelProgress";
import MadarijStudentSection from "@/components/MadarijStudentSection";

const PAGE_SIZE = 20;

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canAccessStudent, loading: accessLoading } = useTeacherHalaqat();
  const { isManager } = useRole();
  const [student, setStudent] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [recordsPage, setRecordsPage] = useState(0);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("records");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    full_name: "", halaqa_id: "", guardian_name: "", guardian_phone: "",
    current_level: "", birth_date_gregorian: "", birth_date_hijri: "", notes: "",
  });

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const [studentRes, attendanceRes] = await Promise.all([
        supabase.from("students").select("*, halaqat(name)").eq("id", id).maybeSingle(),
        supabase.from("attendance").select("status").eq("student_id", id),
      ]);

      setStudent(studentRes.data);

      const att = attendanceRes.data || [];
      setAttendanceStats({
        present: att.filter((a: any) => a.status === "present").length,
        absent: att.filter((a: any) => a.status === "absent").length,
        total: att.length,
      });
    };
    fetchData();
  }, [id]);

  // Fetch halaqat and levels for edit form
  useEffect(() => {
    const fetchMeta = async () => {
      const [hRes, lRes] = await Promise.all([
        supabase.from("halaqat").select("id, name").eq("active", true),
        supabase.from("memorization_levels").select("*").eq("active", true).order("sort_order"),
      ]);
      setHalaqat(hRes.data || []);
      setLevels(lRes.data || []);
    };
    fetchMeta();
  }, []);

  const openEdit = () => {
    if (!student) return;
    setEditForm({
      full_name: student.full_name || "",
      halaqa_id: student.halaqa_id || "",
      guardian_name: student.guardian_name || "",
      guardian_phone: student.guardian_phone || "",
      current_level: student.current_level || "",
      birth_date_gregorian: student.birth_date_gregorian || "",
      birth_date_hijri: student.birth_date_hijri || "",
      notes: student.notes || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("students").update({
      full_name: editForm.full_name,
      halaqa_id: editForm.halaqa_id || null,
      guardian_name: editForm.guardian_name || null,
      guardian_phone: editForm.guardian_phone || null,
      current_level: editForm.current_level || null,
      birth_date_gregorian: editForm.birth_date_gregorian || null,
      birth_date_hijri: editForm.birth_date_hijri || null,
      notes: editForm.notes || null,
    }).eq("id", id!);
    if (error) { toast.error("حدث خطأ أثناء التعديل"); return; }
    toast.success("تم تعديل بيانات الطالب");
    setEditOpen(false);
    // Refresh student data
    const { data } = await supabase.from("students").select("*, halaqat(name)").eq("id", id!).maybeSingle();
    setStudent(data);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("students").update({ status: "inactive" as any }).eq("id", id!);
    if (error) { toast.error("حدث خطأ أثناء الحذف"); return; }
    toast.success("تم حذف الطالب");
    navigate("/students");
  };

  // Fetch recitation records with pagination
  useEffect(() => {
    if (!id) return;
    const fetchRecords = async () => {
      const { data, count } = await supabase
        .from("recitation_records")
        .select("*", { count: "exact" })
        .eq("student_id", id)
        .order("record_date", { ascending: false })
        .range(recordsPage * PAGE_SIZE, (recordsPage + 1) * PAGE_SIZE - 1);
      setRecords(data || []);
      setRecordsTotal(count || 0);
    };
    fetchRecords();
  }, [id, recordsPage]);

  if (!student || accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Block direct URL access to students outside teacher's halaqat
  if (!canAccessStudent(student.halaqa_id)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-bold">غير مصرح</h2>
        <p className="text-muted-foreground text-sm">ليس لديك صلاحية الوصول لهذا الطالب</p>
        <Button variant="outline" onClick={() => navigate(-1)}>رجوع</Button>
      </div>
    );
  }

  const avgScore = records.length
    ? Math.round(records.reduce((sum, r) => sum + Number(r.total_score || 0), 0) / records.length)
    : 0;
  const avgMistakes = records.length
    ? Math.round(records.reduce((sum, r) => sum + (r.mistakes_count || 0), 0) / records.length)
    : 0;
  const progressPercent = Math.min(100, Math.round(((student.total_memorized_pages || 0) / 604) * 100));
  const recordsTotalPages = Math.ceil(recordsTotal / PAGE_SIZE);

  return (
    <>
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowRight className="w-4 h-4 ml-1" />
        رجوع
      </Button>

      {/* Student Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{student.full_name}</h1>
              <p className="text-sm text-muted-foreground">{student.halaqat?.name || "بدون حلقة"}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="secondary">{student.current_level}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  منذ {student.join_date}
                </span>
              </div>
              {(student.birth_date_gregorian || student.birth_date_hijri) && (
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  {student.birth_date_gregorian && (
                    <p>تاريخ الميلاد (ميلادي): {student.birth_date_gregorian}</p>
                  )}
                  {student.birth_date_hijri && (
                    <p>تاريخ الميلاد (هجري): {formatHijriArabic(student.birth_date_hijri)}</p>
                  )}
                </div>
              )}
            </div>
            {isManager && (
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="outline" size="icon" onClick={openEdit}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Student Level Progress (Memorization Track) */}
      <StudentLevelProgress studentId={id!} isManager={isManager} />

      {/* Madarij Section */}
      <MadarijStudentSection studentId={id!} isManager={isManager} />

      {/* Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            تقدم الحفظ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{student.total_memorized_pages || 0} صفحة</span>
              <span className="text-muted-foreground">من 604 صفحة</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">{progressPercent}% مكتمل</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{avgScore}</p>
            <p className="text-xs text-muted-foreground">متوسط الدرجة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{avgMistakes}</p>
            <p className="text-xs text-muted-foreground">متوسط الأخطاء</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">
              {attendanceStats.total ? Math.round((attendanceStats.present / attendanceStats.total) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">نسبة الحضور</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Records vs Audio (lazy-loaded) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="records">
            <TrendingUp className="w-4 h-4 ml-1" />
            سجل التسميعات
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Mic className="w-4 h-4 ml-1" />
            التسجيلات الصوتية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <Card>
            <CardContent className="pt-6">
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات</p>
              ) : (
                <div className="space-y-3">
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {r.memorized_from && r.memorized_to
                            ? `${r.memorized_from} → ${r.memorized_to}`
                            : "حفظ"}
                        </p>
                        <p className="text-xs text-muted-foreground">{r.record_date}</p>
                        {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                      </div>
                      <div className={`text-sm font-bold min-w-[2rem] text-left ${
                        Number(r.total_score) >= 80 ? "text-success" : Number(r.total_score) >= 60 ? "text-warning" : "text-destructive"
                      }`}>
                        {r.total_score}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Pagination */}
              {recordsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button variant="outline" size="sm" disabled={recordsPage <= 0} onClick={() => setRecordsPage(recordsPage - 1)}>
                    <ChevronRight className="w-4 h-4 ml-1" />
                    السابق
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {recordsPage + 1} / {recordsTotalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={recordsPage >= recordsTotalPages - 1} onClick={() => setRecordsPage(recordsPage + 1)}>
                    التالي
                    <ChevronLeft className="w-4 h-4 mr-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio">
          <AudioTab studentId={id!} />
        </TabsContent>
      </Tabs>
    </div>

      {/* Edit Student Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تعديل بيانات الطالب</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الطالب</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>الحلقة</Label>
              <Select value={editForm.halaqa_id} onValueChange={(v) => setEditForm({ ...editForm, halaqa_id: v })}>
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
              <Input value={editForm.guardian_name} onChange={(e) => setEditForm({ ...editForm, guardian_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>هاتف ولي الأمر</Label>
              <Input value={editForm.guardian_phone} onChange={(e) => setEditForm({ ...editForm, guardian_phone: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الميلاد (ميلادي)</Label>
              <Input type="date" value={editForm.birth_date_gregorian} onChange={(e) => {
                const greg = e.target.value;
                let hijri = "";
                if (greg) { try { hijri = gregorianToHijri(new Date(greg)); } catch {} }
                setEditForm({ ...editForm, birth_date_gregorian: greg, birth_date_hijri: hijri });
              }} dir="ltr" className="text-right" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الميلاد (هجري)</Label>
              <Input value={editForm.birth_date_hijri} onChange={(e) => {
                const hijri = e.target.value;
                let greg = "";
                if (hijri && /^\d{4}\/\d{2}\/\d{2}$/.test(hijri)) {
                  const d = hijriToGregorian(hijri);
                  if (d) greg = d.toISOString().split("T")[0];
                }
                setEditForm({ ...editForm, birth_date_hijri: hijri, birth_date_gregorian: greg || editForm.birth_date_gregorian });
              }} placeholder="1440/06/15" dir="ltr" className="text-right" />
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={editForm.current_level} onValueChange={(v) => setEditForm({ ...editForm, current_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <Button type="submit" className="w-full">حفظ التعديلات</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف هذا الطالب؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم تعطيل حساب الطالب "{student?.full_name}". يمكن استعادته لاحقاً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Lazy-loaded audio tab - only fetches when tab is opened
const AudioTab = ({ studentId }: { studentId: string }) => {
  const [audioRecords, setAudioRecords] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchAudio = async () => {
      const { data } = await supabase
        .from("recitation_records")
        .select("id, record_date, memorized_from, memorized_to, audio_url")
        .eq("student_id", studentId)
        .not("audio_url", "is", null)
        .order("record_date", { ascending: false })
        .limit(50);
      setAudioRecords(data || []);
      setLoaded(true);
    };
    fetchAudio();
  }, [studentId]);

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {audioRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد تسجيلات صوتية</p>
        ) : (
          <div className="space-y-3">
            {audioRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">
                    {r.memorized_from && r.memorized_to ? `${r.memorized_from} → ${r.memorized_to}` : "تسجيل"}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.record_date}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const audio = new Audio(r.audio_url);
                    audio.play();
                  }}
                >
                  <Play className="w-4 h-4 text-primary" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentProfile;
