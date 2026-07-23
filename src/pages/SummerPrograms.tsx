import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sun, Plus, MapPin, Users, CheckSquare, X, Trash2, ClipboardList, BookOpen, Pencil, ArrowRightLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PlanEditor from "@/components/summer/PlanEditor";
import DailyRecordDialog from "@/components/summer/DailyRecordDialog";
import { PLAN_TRACKS, type PlanType } from "@/lib/summer-scoring";

type Program = { id: string; name: string; description: string | null; start_date: string; end_date: string; status: string };
type Maqra = { id: string; program_id: string; name: string; maqra_type: string; location: string | null; teacher_id: string | null };
type SummerStudent = { id: string; maqra_id: string; student_id: string; source_halaqa_id: string | null; joined_at: string; active: boolean | null; plan_type: PlanType | null; plan_track: string | null; plan_goal: string | null; assigned_reciter: string | null };
type StudentLite = { id: string; full_name: string; halaqa_id: string | null };
type Teacher = { id: string; full_name: string };

export default function SummerPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [maqare, setMaqare] = useState<Maqra[]>([]);
  const [summerStudents, setSummerStudents] = useState<SummerStudent[]>([]);
  const [allStudents, setAllStudents] = useState<StudentLite[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedMaqra, setSelectedMaqra] = useState<string | null>(null);
  const [tab, setTab] = useState("maqare");
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<Record<string, string>>({});

  const [progOpen, setProgOpen] = useState(false);
  const [progForm, setProgForm] = useState({ name: "", description: "", start_date: "", end_date: "", status: "planned" });
  const [maqraOpen, setMaqraOpen] = useState(false);
  const [editingMaqraId, setEditingMaqraId] = useState<string | null>(null);
  const [maqraForm, setMaqraForm] = useState({ name: "", maqra_type: "male", location: "", teacher_id: "" });
  const [addStuOpen, setAddStuOpen] = useState(false);
  const [pickStudents, setPickStudents] = useState<string[]>([]);
  const [stuSearch, setStuSearch] = useState("");
  const [linkPlanType, setLinkPlanType] = useState<PlanType | "none">("none");
  const [linkPlanTrack, setLinkPlanTrack] = useState<string>("");
  const [linkReciter, setLinkReciter] = useState<string>("");
  const [transferTarget, setTransferTarget] = useState<SummerStudent | null>(null);
  const [transferMaqraId, setTransferMaqraId] = useState<string>("");
  const [planTarget, setPlanTarget] = useState<SummerStudent | null>(null);
  const [dailyTarget, setDailyTarget] = useState<SummerStudent | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [maqraCounts, setMaqraCounts] = useState<Record<string, number>>({});

  useEffect(() => { loadPrograms(); loadStudents(); loadTeachers(); }, []);
  useEffect(() => { if (selectedProgram) { loadMaqare(selectedProgram); loadMaqraCounts(selectedProgram); } }, [selectedProgram]);
  useEffect(() => { if (selectedMaqra) loadSummerStudents(selectedMaqra); }, [selectedMaqra]);
  useEffect(() => { if (selectedMaqra) loadAttendance(); }, [selectedMaqra, attDate]);
  useEffect(() => { if (selectedMaqra && tab === "records") loadRecords(selectedMaqra); }, [selectedMaqra, tab]);

  async function loadPrograms() {
    const { data } = await supabase.from("summer_programs").select("*").order("start_date", { ascending: false });
    setPrograms((data || []) as any);
    if (!selectedProgram && data?.[0]) setSelectedProgram(data[0].id);
  }
  async function loadMaqare(pid: string) {
    const { data } = await supabase.from("summer_maqare").select("*").eq("program_id", pid).order("created_at");
    setMaqare((data || []) as any);
    if (!data?.find(m => m.id === selectedMaqra)) setSelectedMaqra(data?.[0]?.id || null);
  }
  async function loadSummerStudents(mid: string) {
    const { data } = await supabase.from("summer_students").select("*").eq("maqra_id", mid).eq("active", true);
    setSummerStudents((data || []) as any);
  }
  async function loadStudents() {
    const { data } = await supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active").order("full_name").limit(2000);
    setAllStudents((data || []) as any);
  }
  async function loadTeachers() {
    const { data } = await supabase.from("profiles").select("id, full_name").eq("is_staff", true).order("full_name");
    setTeachers((data || []) as any);
  }
  async function loadAttendance() {
    if (!selectedMaqra) return;
    const ids = summerStudents.map(s => s.id);
    if (!ids.length) { setAttendance({}); return; }
    const { data } = await supabase.from("summer_attendance").select("*").in("summer_student_id", ids).eq("attendance_date", attDate);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.summer_student_id] = r.status; });
    setAttendance(map);
  }
  async function loadRecords(mid: string) {
    const { data: ss } = await supabase.from("summer_students").select("id").eq("maqra_id", mid);
    const ids = (ss || []).map((r: any) => r.id);
    if (!ids.length) { setRecords([]); return; }
    const { data } = await supabase.from("summer_daily_records").select("*").in("summer_student_id", ids).order("record_date", { ascending: false }).limit(200);
    setRecords((data || []) as any);
  }

  async function createProgram() {
    if (!progForm.name || !progForm.start_date || !progForm.end_date) { toast.error("أدخل البيانات المطلوبة"); return; }
    const { error } = await supabase.from("summer_programs").insert(progForm);
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء البرنامج"); setProgOpen(false);
    setProgForm({ name: "", description: "", start_date: "", end_date: "", status: "planned" });
    loadPrograms();
  }
  function openNewMaqra() {
    setEditingMaqraId(null);
    setMaqraForm({ name: "", maqra_type: "male", location: "", teacher_id: "" });
    setMaqraOpen(true);
  }
  function openEditMaqra(m: Maqra) {
    setEditingMaqraId(m.id);
    setMaqraForm({ name: m.name, maqra_type: m.maqra_type, location: m.location || "", teacher_id: m.teacher_id || "" });
    setMaqraOpen(true);
  }
  async function saveMaqra() {
    if (!selectedProgram || !maqraForm.name) { toast.error("أدخل اسم المقرأة"); return; }
    const payload: any = { ...maqraForm, program_id: selectedProgram };
    if (!payload.teacher_id) payload.teacher_id = null;
    if (editingMaqraId) {
      const { error } = await supabase.from("summer_maqare").update(payload).eq("id", editingMaqraId);
      if (error) return toast.error(error.message);
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase.from("summer_maqare").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("تمت الإضافة");
    }
    setMaqraOpen(false);
    setEditingMaqraId(null);
    setMaqraForm({ name: "", maqra_type: "male", location: "", teacher_id: "" });
    loadMaqare(selectedProgram);
  }
  async function deleteMaqra(id: string) {
    if (!confirm("حذف المقرأة؟ سيتم إلغاء ربط الطلاب بها.")) return;
    const { error } = await supabase.from("summer_maqare").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    if (selectedMaqra === id) setSelectedMaqra(null);
    if (selectedProgram) loadMaqare(selectedProgram);
  }
  async function loadMaqraCounts(pid: string) {
    const { data } = await supabase.from("summer_maqare").select("id").eq("program_id", pid);
    const ids = (data || []).map((r: any) => r.id);
    if (!ids.length) { setMaqraCounts({}); return; }
    const { data: ss } = await supabase.from("summer_students").select("maqra_id").in("maqra_id", ids).eq("active", true);
    const counts: Record<string, number> = {};
    (ss || []).forEach((r: any) => { counts[r.maqra_id] = (counts[r.maqra_id] || 0) + 1; });
    setMaqraCounts(counts);
  }
  async function addStudents() {
    if (!selectedMaqra || !pickStudents.length) return;
    const planType = linkPlanType === "none" ? null : linkPlanType;
    const planTrack = planType ? (linkPlanTrack || null) : null;
    const reciter = linkReciter.trim() || null;
    const rows = pickStudents.map(sid => {
      const stu = allStudents.find(s => s.id === sid);
      return {
        maqra_id: selectedMaqra,
        student_id: sid,
        source_halaqa_id: stu?.halaqa_id || null,
        plan_type: planType,
        plan_track: planTrack,
        assigned_reciter: reciter,
      };
    });
    const { error } = await supabase.from("summer_students").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`تمت إضافة ${rows.length} طالب`);
    setPickStudents([]); setStuSearch(""); setLinkPlanType("none"); setLinkPlanTrack(""); setLinkReciter(""); setAddStuOpen(false);
    loadSummerStudents(selectedMaqra);
    if (selectedProgram) loadMaqraCounts(selectedProgram);
  }
  async function removeStudent(id: string) {
    if (!confirm("إلغاء ربط الطالب من المقرأة؟")) return;
    const { error } = await supabase.from("summer_students").update({ active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    if (selectedMaqra) loadSummerStudents(selectedMaqra);
    if (selectedProgram) loadMaqraCounts(selectedProgram);
  }
  async function transferStudent() {
    if (!transferTarget || !transferMaqraId || transferMaqraId === transferTarget.maqra_id) { setTransferTarget(null); return; }
    const { error } = await supabase.from("summer_students").update({ maqra_id: transferMaqraId }).eq("id", transferTarget.id);
    if (error) return toast.error(error.message);
    toast.success("تم النقل");
    setTransferTarget(null); setTransferMaqraId("");
    if (selectedMaqra) loadSummerStudents(selectedMaqra);
    if (selectedProgram) loadMaqraCounts(selectedProgram);
  }
  async function setStatus(summerStudentId: string, status: string) {
    setAttendance(a => ({ ...a, [summerStudentId]: status }));
    const { error } = await supabase.from("summer_attendance").upsert({
      summer_student_id: summerStudentId, attendance_date: attDate, status,
    }, { onConflict: "summer_student_id,attendance_date" });
    if (error) toast.error(error.message);
  }

  const studentNameMap = useMemo(() => Object.fromEntries(allStudents.map(s => [s.id, s.full_name])), [allStudents]);
  const currentProgram = programs.find(p => p.id === selectedProgram);
  const currentMaqra = maqare.find(m => m.id === selectedMaqra);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sun className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold">البرنامج الصيفي</h1>
        </div>
        <Dialog open={progOpen} onOpenChange={setProgOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" />برنامج جديد</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إنشاء برنامج صيفي</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={progForm.name} onChange={e => setProgForm({ ...progForm, name: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea value={progForm.description} onChange={e => setProgForm({ ...progForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>تاريخ البدء</Label><Input type="date" value={progForm.start_date} onChange={e => setProgForm({ ...progForm, start_date: e.target.value })} /></div>
                <div><Label>تاريخ الانتهاء</Label><Input type="date" value={progForm.end_date} onChange={e => setProgForm({ ...progForm, end_date: e.target.value })} /></div>
              </div>
              <div><Label>الحالة</Label>
                <Select value={progForm.status} onValueChange={v => setProgForm({ ...progForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">مخطط</SelectItem>
                    <SelectItem value="active">جاري</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={createProgram}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {programs.map(p => (
          <Button key={p.id} variant={selectedProgram === p.id ? "default" : "outline"} onClick={() => setSelectedProgram(p.id)}>
            {p.name} <Badge variant="secondary" className="mr-2">{p.status}</Badge>
          </Button>
        ))}
        {!programs.length && <p className="text-muted-foreground">لا توجد برامج بعد.</p>}
      </div>

      {currentProgram && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{currentProgram.name}</span>
              <span className="text-sm text-muted-foreground">{currentProgram.start_date} → {currentProgram.end_date}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="maqare">المقارئ</TabsTrigger>
                <TabsTrigger value="students" disabled={!selectedMaqra}>الطلاب</TabsTrigger>
                <TabsTrigger value="attendance" disabled={!selectedMaqra}>الحضور</TabsTrigger>
                <TabsTrigger value="records" disabled={!selectedMaqra}>السجل اليومي</TabsTrigger>
              </TabsList>

              <TabsContent value="maqare" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={openNewMaqra}><Plus className="w-4 h-4 ml-1" />مقرأة جديدة</Button>
                </div>
                <Dialog open={maqraOpen} onOpenChange={(v) => { setMaqraOpen(v); if (!v) setEditingMaqraId(null); }}>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>{editingMaqraId ? "تعديل مقرأة" : "إضافة مقرأة"}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>الاسم</Label><Input value={maqraForm.name} onChange={e => setMaqraForm({ ...maqraForm, name: e.target.value })} /></div>
                      <div><Label>النوع</Label>
                        <Select value={maqraForm.maqra_type} onValueChange={v => setMaqraForm({ ...maqraForm, maqra_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">بنين</SelectItem>
                            <SelectItem value="female">بنات</SelectItem>
                            <SelectItem value="mixed">مختلط</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>الموقع</Label><Input value={maqraForm.location} onChange={e => setMaqraForm({ ...maqraForm, location: e.target.value })} /></div>
                      <div><Label>المعلم</Label>
                        <Select value={maqraForm.teacher_id} onValueChange={v => setMaqraForm({ ...maqraForm, teacher_id: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر معلماً" /></SelectTrigger>
                          <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter><Button onClick={saveMaqra}>حفظ</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {maqare.map(m => {
                    const teacher = teachers.find(t => t.id === m.teacher_id);
                    return (
                      <Card key={m.id} className={`cursor-pointer hover:border-primary ${selectedMaqra === m.id ? "border-primary" : ""}`} onClick={() => { setSelectedMaqra(m.id); setTab("students"); }}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{m.name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{m.location || "—"}</p>
                              {teacher && <p className="text-xs text-muted-foreground mt-1">المعلم: {teacher.full_name}</p>}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline">{m.maqra_type === "male" ? "بنين" : m.maqra_type === "female" ? "بنات" : "مختلط"}</Badge>
                                <Badge variant="secondary" className="gap-1"><Users className="w-3 h-3" />{maqraCounts[m.id] || 0} طالب</Badge>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditMaqra(m); }}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMaqra(m.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {!maqare.length && <p className="text-muted-foreground col-span-full">لا توجد مقارئ.</p>}
                </div>
              </TabsContent>

              <TabsContent value="students" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" />{currentMaqra?.name} — {summerStudents.length} طالب</h3>
                  <Dialog open={addStuOpen} onOpenChange={(v) => { setAddStuOpen(v); if (!v) { setPickStudents([]); setStuSearch(""); setLinkPlanType("none"); setLinkPlanTrack(""); setLinkReciter(""); } }}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 ml-1" />إضافة طلاب</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="max-w-lg">
                      <DialogHeader><DialogTitle>ربط طلاب بالمقرأة</DialogTitle></DialogHeader>
                      <div className="space-y-2">
                        <Input placeholder="بحث بالاسم..." value={stuSearch} onChange={e => setStuSearch(e.target.value)} />
                        <p className="text-xs text-muted-foreground">تم تحديد {pickStudents.length} طالب</p>
                        <div className="border rounded max-h-72 overflow-y-auto divide-y">
                          {allStudents
                            .filter(s => !summerStudents.find(ss => ss.student_id === s.id))
                            .filter(s => !stuSearch || s.full_name.includes(stuSearch))
                            .slice(0, 200)
                            .map(s => {
                              const checked = pickStudents.includes(s.id);
                              return (
                                <label key={s.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50">
                                  <Checkbox checked={checked} onCheckedChange={(v) => {
                                    setPickStudents(prev => v ? [...prev, s.id] : prev.filter(x => x !== s.id));
                                  }} />
                                  <span className="text-sm">{s.full_name}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                      <DialogFooter><Button onClick={addStudents} disabled={!pickStudents.length}>ربط ({pickStudents.length})</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="border rounded-lg divide-y">
                  {summerStudents.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 p-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium">{studentNameMap[s.student_id] || "—"}</span>
                        {s.plan_type ? (
                          <Badge variant="outline" className={s.plan_type === "hifz" ? "border-rose-400 text-rose-700 dark:text-rose-300" : "border-amber-400 text-amber-700 dark:text-amber-300"}>
                            {s.plan_type === "hifz" ? "حفظ" : "تعاهد"}{s.plan_track ? ` — ${s.plan_track}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">بدون خطة</Badge>
                        )}
                        {s.assigned_reciter && <span className="text-xs text-muted-foreground">المقرئ: {s.assigned_reciter}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => setPlanTarget(s)}>
                          <BookOpen className="w-3.5 h-3.5 ml-1" />الخطة
                        </Button>
                        <Button variant="default" size="sm" disabled={!s.plan_type} onClick={() => setDailyTarget(s)}>
                          <ClipboardList className="w-3.5 h-3.5 ml-1" />سجل يومي
                        </Button>
                        <Button variant="outline" size="icon" title="نقل إلى مقرأة أخرى" onClick={() => { setTransferTarget(s); setTransferMaqraId(""); }}>
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeStudent(s.id)}><X className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                  {!summerStudents.length && <p className="p-4 text-center text-muted-foreground">لا يوجد طلاب.</p>}
                </div>
              </TabsContent>

              <TabsContent value="attendance" className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label>التاريخ</Label>
                  <Input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} className="w-48" />
                </div>
                <div className="border rounded-lg divide-y">
                  {summerStudents.map(s => {
                    const st = attendance[s.id];
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3">
                        <span>{studentNameMap[s.student_id] || "—"}</span>
                        <div className="flex gap-1">
                          {[
                            { k: "present", label: "حاضر", color: "bg-green-600" },
                            { k: "late", label: "متأخر", color: "bg-yellow-600" },
                            { k: "excused", label: "مستأذن", color: "bg-blue-600" },
                            { k: "absent", label: "غائب", color: "bg-red-600" },
                          ].map(o => (
                            <Button key={o.k} size="sm" variant={st === o.k ? "default" : "outline"} className={st === o.k ? o.color : ""} onClick={() => setStatus(s.id, o.k)}>
                              {o.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {!summerStudents.length && <p className="p-4 text-center text-muted-foreground">أضف طلاباً أولاً.</p>}
                </div>
              </TabsContent>

              <TabsContent value="records" className="space-y-3">
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-right">التاريخ</th>
                        <th className="p-2 text-right">الطالب</th>
                        <th className="p-2 text-right">النوع</th>
                        <th className="p-2 text-right">الجديد</th>
                        <th className="p-2 text-right">الربط</th>
                        <th className="p-2 text-right">أميل</th>
                        <th className="p-2 text-right">المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r: any) => {
                        const stu = summerStudents.find(ss => ss.id === r.summer_student_id);
                        return (
                          <tr key={r.id} className="border-t">
                            <td className="p-2">{r.record_date}</td>
                            <td className="p-2">{stu ? studentNameMap[stu.student_id] : "—"}</td>
                            <td className="p-2">{stu?.plan_type === "hifz" ? "حفظ" : stu?.plan_type === "taahud" ? "تعاهد" : "—"}</td>
                            <td className="p-2">{r.new_score}</td>
                            <td className="p-2">{r.link_score}</td>
                            <td className="p-2">{r.amyal_score}</td>
                            <td className="p-2 font-bold text-primary">{r.total_score} / 40</td>
                          </tr>
                        );
                      })}
                      {!records.length && (
                        <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">لا توجد سجلات بعد.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {planTarget && (
        <PlanEditor
          open={!!planTarget}
          onOpenChange={(v) => !v && setPlanTarget(null)}
          summerStudentId={planTarget.id}
          studentName={studentNameMap[planTarget.student_id] || ""}
          initial={{
            plan_type: planTarget.plan_type,
            plan_track: planTarget.plan_track,
            plan_goal: planTarget.plan_goal,
            assigned_reciter: planTarget.assigned_reciter,
          }}
          onSaved={() => selectedMaqra && loadSummerStudents(selectedMaqra)}
        />
      )}
      {dailyTarget && dailyTarget.plan_type && (
        <DailyRecordDialog
          open={!!dailyTarget}
          onOpenChange={(v) => !v && setDailyTarget(null)}
          summerStudentId={dailyTarget.id}
          studentName={studentNameMap[dailyTarget.student_id] || ""}
          planType={dailyTarget.plan_type}
          planTrack={dailyTarget.plan_track}
          defaultReciter={dailyTarget.assigned_reciter}
          onSaved={() => selectedMaqra && loadRecords(selectedMaqra)}
        />
      )}

      <Dialog open={!!transferTarget} onOpenChange={(v) => { if (!v) { setTransferTarget(null); setTransferMaqraId(""); } }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>نقل الطالب إلى مقرأة أخرى</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">{transferTarget && (studentNameMap[transferTarget.student_id] || "")}</p>
            <Select value={transferMaqraId} onValueChange={setTransferMaqraId}>
              <SelectTrigger><SelectValue placeholder="اختر المقرأة الجديدة" /></SelectTrigger>
              <SelectContent>
                {maqare.filter(m => m.id !== transferTarget?.maqra_id).map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={transferStudent} disabled={!transferMaqraId}>نقل</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
