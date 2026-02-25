import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Plus, Calendar, Users, BookOpen, Trophy, Star, Settings, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface Session {
  id: string;
  session_date: string;
  halaqa_id: string | null;
  notes: string | null;
  total_hizb_in_session: number;
  total_pages_displayed: number;
  created_at: string;
  halaqat?: { name: string } | null;
}

interface Student {
  id: string;
  full_name: string;
}

interface EliteStudent {
  id: string;
  halaqa_id: string;
  student_id: string;
  notes: string | null;
}

interface ExcellenceSettings {
  id: string;
  max_grade: number;
  deduction_per_mistake: number;
  deduction_per_lahn: number;
  deduction_per_warning: number;
}

function getNextTuesday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + (day === 2 ? 0 : diff));
  return d.toISOString().split("T")[0];
}

export default function Excellence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isManager, isSupervisor } = useRole();
  const { allowedHalaqatIds, filterHalaqat } = useTeacherHalaqat();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newDate, setNewDate] = useState(getNextTuesday());
  const [newHalaqaId, setNewHalaqaId] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Elite management
  const [eliteDialogOpen, setEliteDialogOpen] = useState(false);
  const [eliteHalaqaId, setEliteHalaqaId] = useState("");
  const [halaqaStudents, setHalaqaStudents] = useState<Student[]>([]);
  const [eliteStudentIds, setEliteStudentIds] = useState<Set<string>>(new Set());
  const [eliteRecords, setEliteRecords] = useState<EliteStudent[]>([]);
  const [eliteLoading, setEliteLoading] = useState(false);

  // Settings management
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [excellenceSettings, setExcellenceSettings] = useState<ExcellenceSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({ max_grade: 100, deduction_per_mistake: 2, deduction_per_lahn: 1, deduction_per_warning: 0.5 });
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [allowedHalaqatIds]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch settings
    const { data: settData } = await supabase
      .from("excellence_settings")
      .select("*")
      .limit(1)
      .single();
    if (settData) {
      const s = settData as any;
      setExcellenceSettings({ id: s.id, max_grade: Number(s.max_grade), deduction_per_mistake: Number(s.deduction_per_mistake), deduction_per_lahn: Number(s.deduction_per_lahn), deduction_per_warning: Number(s.deduction_per_warning) });
      setSettingsForm({ max_grade: Number(s.max_grade), deduction_per_mistake: Number(s.deduction_per_mistake), deduction_per_lahn: Number(s.deduction_per_lahn), deduction_per_warning: Number(s.deduction_per_warning) });
    }



    const [sessRes, halRes] = await Promise.all([
      supabase
        .from("excellence_sessions")
        .select("*, halaqat(name)")
        .order("session_date", { ascending: false })
        .limit(50),
      supabase.from("halaqat").select("id, name").eq("active", true),
    ]);

    const allHalaqat = halRes.data || [];
    const filtered = filterHalaqat(allHalaqat);
    setHalaqat(filtered);

    let sessionsList = sessRes.data || [];
    if (allowedHalaqatIds) {
      sessionsList = sessionsList.filter(
        (s) => s.halaqa_id && allowedHalaqatIds.includes(s.halaqa_id)
      );
    }
    setSessions(sessionsList as Session[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newHalaqaId) {
      toast.error("اختر الحلقة");
      return;
    }
    const { data, error } = await supabase
      .from("excellence_sessions")
      .insert({
        session_date: newDate,
        halaqa_id: newHalaqaId,
        created_by: user?.id,
        notes: newNotes || null,
      })
      .select()
      .single();

    if (error) {
      toast.error("خطأ في إنشاء الجلسة: " + error.message);
      return;
    }
    toast.success("تم إنشاء الجلسة بنجاح");
    setDialogOpen(false);
    setNewNotes("");
    navigate(`/excellence/${data.id}`);
  };

  // Elite students management
  const loadEliteStudents = async (halaqaId: string) => {
    setEliteLoading(true);
    setEliteHalaqaId(halaqaId);

    const [studsRes, eliteRes] = await Promise.all([
      (supabase.from("students").select("id, full_name") as any)
        .eq("halaqa_id", halaqaId)
        .eq("active", true)
        .order("full_name") as { data: Student[] | null },
      supabase.from("excellence_elite_students").select("*").eq("halaqa_id", halaqaId),
    ]);

    setHalaqaStudents(studsRes.data || []);
    const records = (eliteRes.data || []) as EliteStudent[];
    setEliteRecords(records);
    setEliteStudentIds(new Set(records.map((e) => e.student_id)));
    setEliteLoading(false);
  };

  const toggleEliteStudent = async (studentId: string) => {
    const isElite = eliteStudentIds.has(studentId);

    if (isElite) {
      // Remove
      const record = eliteRecords.find((e) => e.student_id === studentId);
      if (record) {
        await supabase.from("excellence_elite_students").delete().eq("id", record.id);
        setEliteStudentIds((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
        setEliteRecords((prev) => prev.filter((e) => e.student_id !== studentId));
      }
    } else {
      // Add
      const { data, error } = await supabase
        .from("excellence_elite_students")
        .insert({ halaqa_id: eliteHalaqaId, student_id: studentId, added_by: user?.id })
        .select()
        .single();
      if (error) {
        toast.error("خطأ: " + error.message);
        return;
      }
      setEliteStudentIds((prev) => new Set(prev).add(studentId));
      setEliteRecords((prev) => [...prev, data as EliteStudent]);
    }
  };

  const saveSettings = async () => {
    if (!excellenceSettings) return;
    setSettingsSaving(true);
    const { error } = await supabase
      .from("excellence_settings")
      .update({
        max_grade: settingsForm.max_grade,
        deduction_per_mistake: settingsForm.deduction_per_mistake,
        deduction_per_lahn: settingsForm.deduction_per_lahn,
        deduction_per_warning: settingsForm.deduction_per_warning,
      })
      .eq("id", excellenceSettings.id);
    if (error) {
      toast.error("خطأ في حفظ الإعدادات: " + error.message);
    } else {
      toast.success("تم حفظ إعدادات التقييم");
      setExcellenceSettings({ ...excellenceSettings, ...settingsForm });
      setSettingsDialogOpen(false);
    }
    setSettingsSaving(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    // Delete related records first, then the session
    await supabase.from("excellence_performance").delete().eq("session_id", sessionId);
    await supabase.from("excellence_attendance").delete().eq("session_id", sessionId);
    const { error } = await supabase.from("excellence_sessions").delete().eq("id", sessionId);
    if (error) {
      toast.error("خطأ في حذف الجلسة: " + error.message);
    } else {
      toast.success("تم حذف الجلسة بنجاح");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  };

  const totalHizb = sessions.reduce((s, r) => s + Number(r.total_hizb_in_session || 0), 0);
  const totalPages = sessions.reduce((s, r) => s + Number(r.total_pages_displayed || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مسار التميّز</h1>
          <p className="text-muted-foreground text-sm">إدارة جلسات التميّز الأسبوعية</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="w-4 h-4 ml-2" />
                  إعدادات التقييم
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader>
                  <DialogTitle>إعدادات معادلة التقييم</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الدرجة القصوى</label>
                    <Input
                      type="number" min={1} max={200}
                      value={settingsForm.max_grade}
                      onChange={(e) => setSettingsForm((p) => ({ ...p, max_grade: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الخصم لكل خطأ</label>
                    <div className="flex items-center gap-3">
                      <Slider
                        min={0} max={10} step={0.5}
                        value={[settingsForm.deduction_per_mistake]}
                        onValueChange={([v]) => setSettingsForm((p) => ({ ...p, deduction_per_mistake: v }))}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono w-10 text-center">{settingsForm.deduction_per_mistake}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الخصم لكل لحن</label>
                    <div className="flex items-center gap-3">
                      <Slider
                        min={0} max={10} step={0.5}
                        value={[settingsForm.deduction_per_lahn]}
                        onValueChange={([v]) => setSettingsForm((p) => ({ ...p, deduction_per_lahn: v }))}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono w-10 text-center">{settingsForm.deduction_per_lahn}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الخصم لكل تنبيه</label>
                    <div className="flex items-center gap-3">
                      <Slider
                        min={0} max={10} step={0.5}
                        value={[settingsForm.deduction_per_warning]}
                        onValueChange={([v]) => setSettingsForm((p) => ({ ...p, deduction_per_warning: v }))}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono w-10 text-center">{settingsForm.deduction_per_warning}</span>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">معادلة الدرجة:</p>
                    <p>{settingsForm.max_grade} - (أخطاء × {settingsForm.deduction_per_mistake}) - (لحون × {settingsForm.deduction_per_lahn}) - (تنبيهات × {settingsForm.deduction_per_warning})</p>
                  </div>
                  <Button className="w-full" onClick={saveSettings} disabled={settingsSaving}>
                    {settingsSaving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={() => navigate("/excellence/reports")}>
            <Trophy className="w-4 h-4 ml-2" />
            التقارير
          </Button>
          <Button variant="outline" onClick={() => navigate("/excellence/tracks")}>
            <Settings className="w-4 h-4 ml-2" />
            إدارة المسارات
          </Button>
          <Button variant="outline" onClick={() => navigate("/excellence/distinguished")}>
            <Star className="w-4 h-4 ml-2" />
            الطلاب المميزون
          </Button>
          {!isSupervisor && (
            <>
              {/* Elite Students Dialog */}
              <Dialog open={eliteDialogOpen} onOpenChange={setEliteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Star className="w-4 h-4 ml-2" />
                    طلاب النخبة
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl" className="max-w-lg max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>إدارة طلاب النخبة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">اختر الحلقة</label>
                      <Select
                        value={eliteHalaqaId}
                        onValueChange={(v) => loadEliteStudents(v)}
                      >
                        <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                        <SelectContent>
                          {halaqat.map((h) => (
                            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {eliteLoading ? (
                      <p className="text-center text-muted-foreground py-4">جارٍ التحميل...</p>
                    ) : eliteHalaqaId && halaqaStudents.length > 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          حدّد الطلاب المشاركين في مسار التميّز ({eliteStudentIds.size} من {halaqaStudents.length})
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-center w-12">نخبة</TableHead>
                              <TableHead className="text-right">اسم الطالب</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {halaqaStudents.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={eliteStudentIds.has(s.id)}
                                    onCheckedChange={() => toggleEliteStudent(s.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{s.full_name}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    ) : eliteHalaqaId ? (
                      <p className="text-center text-muted-foreground py-4">لا يوجد طلاب في هذه الحلقة</p>
                    ) : null}
                  </div>
                </DialogContent>
              </Dialog>

              {/* New Session Dialog */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 ml-2" />
                    جلسة جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إنشاء جلسة تميّز جديدة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">تاريخ الجلسة</label>
                      <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">الحلقة</label>
                      <Select value={newHalaqaId} onValueChange={setNewHalaqaId}>
                        <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                        <SelectContent>
                          {halaqat.map((h) => (
                            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">ملاحظات</label>
                      <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="ملاحظات اختيارية..." />
                    </div>
                    <Button className="w-full" onClick={handleCreate}>إنشاء الجلسة</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{sessions.length}</p>
              <p className="text-sm text-muted-foreground">جلسة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalHizb}</p>
              <p className="text-sm text-muted-foreground">إجمالي الأحزاب</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalPages}</p>
              <p className="text-sm text-muted-foreground">إجمالي الأوجه</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">لا توجد جلسات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/excellence/${s.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4" onClick={() => navigate(`/excellence/${s.id}`)}>
                  <div className="bg-primary/10 rounded-lg p-2">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {format(new Date(s.session_date), "yyyy/MM/dd")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(s as any).halaqat?.name || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>{Number(s.total_hizb_in_session || 0)} حزب</span>
                    <span>{Number(s.total_pages_displayed || 0)} وجه</span>
                  </div>
                  {(isManager || !isSupervisor) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف الجلسة</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من حذف جلسة {format(new Date(s.session_date), "yyyy/MM/dd")}؟ سيتم حذف جميع بيانات الحضور والأداء المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row-reverse gap-2">
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteSession(s.id)}
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
