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
import { Sun, Plus, MapPin, Users, X, Trash2, ClipboardList, BookOpen, Pencil, ArrowRightLeft, BarChart3, Target } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PlanEditor from "@/components/summer/PlanEditor";
import DailyRecordDialog from "@/components/summer/DailyRecordDialog";
import { PLAN_TRACKS, computeDailyPages, juzToPages, planDurationDays, type PlanType } from "@/lib/summer-scoring";
import { Progress } from "@/components/ui/progress";

type Program = { id: string; name: string; description: string | null; start_date: string; end_date: string; status: string };
type Maqra = { id: string; program_id: string; name: string; maqra_type: string; plan_category: PlanType | null; location: string | null; teacher_id: string | null };
type SummerStudent = { id: string; maqra_id: string; student_id: string; source_halaqa_id: string | null; joined_at: string; active: boolean | null; plan_type: PlanType | null; plan_track: string | null; plan_goal: string | null; assigned_reciter: string | null; pages_target: number | null; plan_start_date: string | null; plan_end_date: string | null; daily_pages: number | null };
type StudentLite = { id: string; full_name: string; halaqa_id: string | null };
type Teacher = { id: string; full_name: string };
type HalaqaLite = { id: string; name: string };

export default function SummerPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [maqare, setMaqare] = useState<Maqra[]>([]);
  const [summerStudents, setSummerStudents] = useState<SummerStudent[]>([]);
  const [allStudents, setAllStudents] = useState<StudentLite[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [halaqat, setHalaqat] = useState<HalaqaLite[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedMaqra, setSelectedMaqra] = useState<string | null>(null);
  const [tab, setTab] = useState("maqare");
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<Record<string, string>>({});

  const [progOpen, setProgOpen] = useState(false);
  const [progForm, setProgForm] = useState({ name: "", description: "", start_date: "", end_date: "", status: "planned" });
  const [maqraOpen, setMaqraOpen] = useState(false);
  const [editingMaqraId, setEditingMaqraId] = useState<string | null>(null);
  const [maqraForm, setMaqraForm] = useState<{ name: string; maqra_type: string; plan_category: PlanType; location: string; teacher_id: string }>({ name: "", maqra_type: "male", plan_category: "hifz", location: "", teacher_id: "" });
  const [addStuOpen, setAddStuOpen] = useState(false);
  const [pickStudents, setPickStudents] = useState<string[]>([]);
  const [stuSearch, setStuSearch] = useState("");
  const [linkPlanTrack, setLinkPlanTrack] = useState<string>("");
  const [linkReciter, setLinkReciter] = useState<string>("");
  const [linkJuz, setLinkJuz] = useState<string>("");
  const [linkExtraPages, setLinkExtraPages] = useState<string>("");
  const [linkStartDate, setLinkStartDate] = useState<string>("");
  const [linkEndDate, setLinkEndDate] = useState<string>("");
  const [transferTarget, setTransferTarget] = useState<SummerStudent | null>(null);
  const [transferMaqraId, setTransferMaqraId] = useState<string>("");
  const [planTarget, setPlanTarget] = useState<SummerStudent | null>(null);
  const [dailyTarget, setDailyTarget] = useState<SummerStudent | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [maqraCounts, setMaqraCounts] = useState<Record<string, number>>({});
  const [programRecords, setProgramRecords] = useState<any[]>([]);
  const [programStudents, setProgramStudents] = useState<SummerStudent[]>([]);

  useEffect(() => { loadPrograms(); loadStudents(); loadTeachers(); loadHalaqat(); }, []);
  useEffect(() => { if (selectedProgram) { loadMaqare(selectedProgram); loadMaqraCounts(selectedProgram); loadProgramAggregate(selectedProgram); } }, [selectedProgram]);
  useEffect(() => { if (selectedMaqra) loadSummerStudents(selectedMaqra); }, [selectedMaqra]);
  useEffect(() => { if (selectedMaqra) loadAttendance(); }, [selectedMaqra, attDate, summerStudents]);
  useEffect(() => { if (selectedMaqra && (tab === "records" || tab === "schedule")) loadRecords(selectedMaqra); }, [selectedMaqra, tab]);
  useEffect(() => { if (selectedProgram && tab === "stats") loadProgramAggregate(selectedProgram); }, [tab, selectedProgram]);

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

  async function deleteProgram(pid: string, pname: string) {
    if (!confirm(`هل أنت متأكد من حذف البرنامج "${pname}"؟\n\nسيتم حذف جميع المقارئ والطلاب والسجلات المرتبطة به نهائيًا.`)) return;
    const { data: maqareList } = await supabase.from("summer_maqare").select("id").eq("program_id", pid);
    const mIds = (maqareList || []).map((m: any) => m.id);
    if (mIds.length) {
      const { data: studs } = await supabase.from("summer_students").select("id").in("maqra_id", mIds);
      const sIds = (studs || []).map((s: any) => s.id);
      if (sIds.length) {
        await supabase.from("summer_daily_records").delete().in("summer_student_id", sIds);
        await (supabase as any).from("summer_plan_change_log").delete().in("summer_student_id", sIds);
        await supabase.from("summer_students").delete().in("id", sIds);
      }
      await supabase.from("summer_maqare").delete().in("id", mIds);
    }
    const { error } = await supabase.from("summer_programs").delete().eq("id", pid);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف البرنامج");
    if (selectedProgram === pid) setSelectedProgram(null);
    loadPrograms();
  }

  async function seedDemoData() {
    try {
      const { data: stu } = await supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active").limit(5);
      if (!stu || stu.length === 0) { toast.error("لا يوجد طلاب نشطون لإنشاء بيانات تجريبية"); return; }
      const today = new Date();
      const end = new Date(); end.setDate(today.getDate() + 59);
      const startISO = today.toISOString().slice(0, 10);
      const endISO = end.toISOString().slice(0, 10);
      const { data: prog, error: pErr } = await supabase.from("summer_programs").insert({
        name: "برنامج تجريبي - " + startISO, description: "بيانات توضيحية", start_date: startISO, end_date: endISO, status: "active",
      }).select().single();
      if (pErr || !prog) { toast.error(pErr?.message || "فشل إنشاء البرنامج"); return; }
      const { data: maq, error: mErr } = await supabase.from("summer_maqare").insert({
        program_id: prog.id, name: "مقرأة تجريبية (حفظ)", maqra_type: "male", plan_category: "hifz", location: "قاعة 1",
      }).select().single();
      if (mErr || !maq) { toast.error(mErr?.message || "فشل إنشاء المقرأة"); return; }
      const pagesTarget = juzToPages(2); // 40 pages
      const daily = computeDailyPages(pagesTarget, startISO, endISO);
      const rows = stu.map(s => ({
        maqra_id: maq.id, student_id: s.id, source_halaqa_id: s.halaqa_id, active: true,
        plan_type: "hifz" as const, plan_track: PLAN_TRACKS[0]?.value || null,
        pages_target: pagesTarget, plan_start_date: startISO, plan_end_date: endISO, daily_pages: daily,
      }));
      const { error: sErr } = await supabase.from("summer_students").insert(rows);
      if (sErr) { toast.error(sErr.message); return; }
      toast.success(`تم إنشاء بيانات تجريبية (${stu.length} طلاب)`);
      await loadPrograms();
      setSelectedProgram(prog.id);
      setSelectedMaqra(maq.id);
      setTab("schedule");
    } catch (e: any) {
      toast.error(e?.message || "خطأ غير متوقع");
    }
  }

  async function seedDemoRecords() {
    if (!selectedMaqra) { toast.error("اختر مقرأة أولاً"); return; }
    const students = summerStudents.filter(s => (s.pages_target || 0) > 0);
    if (students.length === 0) { toast.error("لا يوجد طلاب بخطة في هذه المقرأة"); return; }
    try {
      // shift plan_start_date back 6 days so past 7 days are inside the plan window
      const today = new Date();
      const shiftedStart = new Date(today); shiftedStart.setDate(today.getDate() - 6);
      const startISO = shiftedStart.toISOString().slice(0, 10);
      const updates = students.map(s =>
        supabase.from("summer_students").update({ plan_start_date: startISO }).eq("id", s.id)
      );
      await Promise.all(updates);

      // status pattern for the 7 days: منجز, منجز, جزئي, متأخر, منجز, جزئي, منجز(اليوم)
      const pattern = [1, 1, 0.5, 0, 1, 0.6, 1];
      const rows: any[] = [];
      for (const s of students) {
        const daily = Math.max(1, s.daily_pages || 1);
        for (let i = 0; i < 7; i++) {
          const d = new Date(today); d.setDate(today.getDate() - (6 - i));
          const ratio = pattern[i];
          if (ratio === 0) continue; // leave as متأخر (no record)
          const pages = Math.max(1, Math.round(daily * ratio));
          rows.push({
            summer_student_id: s.id,
            record_date: d.toISOString().slice(0, 10),
            link_from: "الفاتحة", link_to: "الفاتحة",
            link_pages_count: pages,
            link_score: ratio >= 1 ? 10 : 7,
            total_score: ratio >= 1 ? 10 : 7,
          });
        }
      }
      const { error } = await supabase.from("summer_daily_records").upsert(rows, { onConflict: "summer_student_id,record_date" });
      if (error) { toast.error(error.message); return; }
      toast.success(`تم إنشاء ${rows.length} سجل تجريبي`);
      await loadSummerStudents(selectedMaqra);
      await loadRecords(selectedMaqra);
    } catch (e: any) {
      toast.error(e?.message || "خطأ غير متوقع");
    }
  }
  function openNewMaqra() {
    setEditingMaqraId(null);
    setMaqraForm({ name: "", maqra_type: "male", plan_category: "hifz", location: "", teacher_id: "" });
    setMaqraOpen(true);
  }
  function openEditMaqra(m: Maqra) {
    setEditingMaqraId(m.id);
    setMaqraForm({ name: m.name, maqra_type: m.maqra_type, plan_category: (m.plan_category || "hifz") as PlanType, location: m.location || "", teacher_id: m.teacher_id || "" });
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
    setMaqraForm({ name: "", maqra_type: "male", plan_category: "hifz", location: "", teacher_id: "" });
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
  async function loadHalaqat() {
    const { data } = await supabase.from("halaqat").select("id, name").order("name");
    setHalaqat((data || []) as any);
  }
  async function loadProgramAggregate(pid: string) {
    // pull all maqare, then their students + records for stats
    const { data: mList } = await supabase.from("summer_maqare").select("id").eq("program_id", pid);
    const mIds = (mList || []).map((r: any) => r.id);
    if (!mIds.length) { setProgramStudents([]); setProgramRecords([]); return; }
    const { data: ss } = await supabase.from("summer_students").select("*").in("maqra_id", mIds).eq("active", true);
    setProgramStudents((ss || []) as any);
    const sIds = (ss || []).map((r: any) => r.id);
    if (!sIds.length) { setProgramRecords([]); return; }
    const { data: rec } = await supabase.from("summer_daily_records").select("summer_student_id, link_pages_count, total_score, record_date").in("summer_student_id", sIds);
    setProgramRecords((rec || []) as any);
  }
  async function addStudents() {
    if (!selectedMaqra || !pickStudents.length) return;
    const maqra = maqare.find(m => m.id === selectedMaqra);
    const planType = (maqra?.plan_category || null) as PlanType | null;
    const planTrack = planType ? (linkPlanTrack || null) : null;
    const reciter = linkReciter.trim() || null;
    const juz = parseFloat(linkJuz) || 0;
    const extra = parseInt(linkExtraPages) || 0;
    const pagesTarget = juzToPages(juz, extra);
    const startDate = linkStartDate || null;
    const endDate = linkEndDate || null;
    const daily = computeDailyPages(pagesTarget, startDate, endDate);
    const rows = pickStudents.map(sid => {
      const stu = allStudents.find(s => s.id === sid);
      return {
        maqra_id: selectedMaqra,
        student_id: sid,
        source_halaqa_id: stu?.halaqa_id || null,
        plan_type: planType,
        plan_track: planTrack,
        assigned_reciter: reciter,
        pages_target: pagesTarget,
        plan_start_date: startDate,
        plan_end_date: endDate,
        daily_pages: daily,
        active: true,
      };
    });
    const { error } = await supabase.from("summer_students").upsert(rows, { onConflict: "maqra_id,student_id" });
    if (error) return toast.error(error.message);
    toast.success(`تمت إضافة ${rows.length} طالب — الحد اليومي: ${daily} وجه`);
    setPickStudents([]); setStuSearch(""); setLinkPlanTrack(""); setLinkReciter("");
    setLinkJuz(""); setLinkExtraPages(""); setLinkStartDate(""); setLinkEndDate("");
    setAddStuOpen(false);
    loadSummerStudents(selectedMaqra);
    if (selectedProgram) { loadMaqraCounts(selectedProgram); loadProgramAggregate(selectedProgram); }
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
    if (error) return toast.error(error.code === "23505" ? "الطالب مسجل مسبقًا في المقرأة المستهدفة" : error.message);
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
        <Button variant="outline" onClick={seedDemoData}>
          <Sun className="w-4 h-4 ml-1" />بيانات تجريبية
        </Button>
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
               <TabsTrigger value="schedule" disabled={!selectedMaqra}>الجدول اليومي</TabsTrigger>
               <TabsTrigger value="stats"><BarChart3 className="w-3.5 h-3.5 ml-1" />الإحصائيات</TabsTrigger>
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
                      <div>
                        <Label>تصنيف المقرأة *</Label>
                        <Select value={maqraForm.plan_category} onValueChange={(v) => setMaqraForm({ ...maqraForm, plan_category: v as PlanType })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hifz">مقرأة حفظ</SelectItem>
                            <SelectItem value="taahud">مقرأة إتقان</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">يحدد نوع الخطة الافتراضية لجميع الطلاب المضافين لاحقاً.</p>
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
                                {m.plan_category && (
                                  <Badge className={m.plan_category === "hifz" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}>
                                    {m.plan_category === "hifz" ? "مقرأة حفظ" : "مقرأة إتقان"}
                                  </Badge>
                                )}
                                {null}
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
                  <Dialog open={addStuOpen} onOpenChange={(v) => { setAddStuOpen(v); if (!v) { setPickStudents([]); setStuSearch(""); setLinkPlanTrack(""); setLinkReciter(""); setLinkJuz(""); setLinkExtraPages(""); setLinkStartDate(""); setLinkEndDate(""); } }}>
                    <DialogTrigger asChild><Button size="sm" disabled={!currentMaqra?.plan_category}><Plus className="w-4 h-4 ml-1" />إضافة طلاب</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="max-w-2xl max-h-[92vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>ربط طلاب بمقرأة {currentMaqra?.plan_category === "hifz" ? "الحفظ" : "الإتقان"}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input placeholder="بحث بالاسم..." value={stuSearch} onChange={e => setStuSearch(e.target.value)} />
                        <p className="text-xs text-muted-foreground">تم تحديد {pickStudents.length} طالب</p>
                        <div className="border rounded max-h-60 overflow-y-auto divide-y">
                          {allStudents
                            .filter(s => !summerStudents.find(ss => ss.student_id === s.id))
                            .filter(s => !stuSearch || s.full_name.includes(stuSearch))
                            .slice(0, 200)
                            .map(s => {
                              const checked = pickStudents.includes(s.id);
                              const halaqa = halaqat.find(h => h.id === s.halaqa_id);
                              return (
                                <label key={s.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50">
                                  <Checkbox checked={checked} onCheckedChange={(v) => {
                                    setPickStudents(prev => v ? [...prev, s.id] : prev.filter(x => x !== s.id));
                                  }} />
                                  <span className="text-sm flex-1">{s.full_name}</span>
                                  {halaqa && <Badge variant="outline" className="text-[10px]">{halaqa.name}</Badge>}
                                </label>
                              );
                            })}
                        </div>
                        <div className="border-t pt-3 space-y-3">
                          <p className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4" />خطة {currentMaqra?.plan_category === "hifz" ? "الحفظ" : "الإتقان"}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <Label className="text-xs">عدد الأجزاء</Label>
                              <Input type="number" min={0} step={0.5} value={linkJuz} onChange={e => setLinkJuz(e.target.value)} placeholder="مثال: 2" />
                            </div>
                            <div>
                              <Label className="text-xs">أوجه إضافية</Label>
                              <Input type="number" min={0} value={linkExtraPages} onChange={e => setLinkExtraPages(e.target.value)} placeholder="0" />
                            </div>
                            <div>
                              <Label className="text-xs">تاريخ البدء</Label>
                              <Input type="date" value={linkStartDate} onChange={e => setLinkStartDate(e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">تاريخ الانتهاء</Label>
                              <Input type="date" value={linkEndDate} onChange={e => setLinkEndDate(e.target.value)} />
                            </div>
                          </div>
                          {(() => {
                            const juz = parseFloat(linkJuz) || 0;
                            const extra = parseInt(linkExtraPages) || 0;
                            const pages = juzToPages(juz, extra);
                            const days = planDurationDays(linkStartDate, linkEndDate);
                            const daily = computeDailyPages(pages, linkStartDate, linkEndDate);
                            if (!pages) return null;
                            return (
                              <div className="grid grid-cols-3 gap-2 text-center text-xs bg-muted/40 rounded p-2">
                                <div><span className="block text-muted-foreground">إجمالي</span><b>{pages} وجه</b></div>
                                <div><span className="block text-muted-foreground">مدة الخطة</span><b>{days} يوم</b></div>
                                <div><span className="block text-muted-foreground">الحد اليومي</span><b className="text-primary">{daily} وجه/يوم</b></div>
                              </div>
                            );
                          })()}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">المسار (اختياري)</Label>
                              <Select value={linkPlanTrack} onValueChange={setLinkPlanTrack}>
                                <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                                <SelectContent>
                                  {currentMaqra?.plan_category && PLAN_TRACKS[currentMaqra.plan_category].map(t => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">المقرئ المرافق</Label>
                              <Input value={linkReciter} onChange={e => setLinkReciter(e.target.value)} placeholder="اختياري" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogFooter><Button onClick={addStudents} disabled={!pickStudents.length}>ربط ({pickStudents.length})</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="border rounded-lg divide-y">
                  {summerStudents.map(s => {
                    const covered = programRecords
                      .filter((r: any) => r.summer_student_id === s.id)
                      .reduce((a: number, r: any) => a + (r.link_pages_count || 0), 0);
                    const target = s.pages_target || 0;
                    const pct = target > 0 ? Math.min(100, Math.round((covered / target) * 100)) : 0;
                    return (
                      <div key={s.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                            <span className="font-medium">{studentNameMap[s.student_id] || "—"}</span>
                            {s.plan_type ? (
                              <Badge variant="outline" className={s.plan_type === "hifz" ? "border-rose-400 text-rose-700 dark:text-rose-300" : "border-amber-400 text-amber-700 dark:text-amber-300"}>
                                {s.plan_type === "hifz" ? "حفظ" : "إتقان"}{s.plan_track ? ` — ${s.plan_track}` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">بدون خطة</Badge>
                            )}
                            {target > 0 && (
                              <Badge variant="outline" className="gap-1"><Target className="w-3 h-3" />{target} وجه · {s.daily_pages || 0}/يوم</Badge>
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
                        {target > 0 && (
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{covered} / {target} · {pct}%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

              <TabsContent value="schedule" className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    توزيع الأوجه المستهدفة على أيام الخطة لكل طالب، مع مقارنة بما تم تسميعه فعلياً في كل تاريخ.
                  </p>
                  <Button size="sm" variant="outline" onClick={seedDemoRecords}>
                    <ClipboardList className="w-4 h-4 ml-1" />سجلات تجريبية (7 أيام)
                  </Button>
                </div>
                {summerStudents.filter(s => s.plan_start_date && s.plan_end_date && (s.pages_target || 0) > 0).length === 0 && (
                  <p className="p-6 text-center text-muted-foreground border rounded-lg">
                    لا يوجد طلاب لديهم خطة محددة بتواريخ. حدّد الأجزاء وتاريخ البدء والانتهاء عند إضافة الطلاب أو من زر «الخطة».
                  </p>
                )}
                {summerStudents.filter(s => s.plan_start_date && s.plan_end_date && (s.pages_target || 0) > 0).map(s => {
                  const start = new Date(s.plan_start_date!);
                  const end = new Date(s.plan_end_date!);
                  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
                  const daily = s.daily_pages || 0;
                  const target = s.pages_target || 0;
                  // group records by record_date for this student
                  const byDate: Record<string, number> = {};
                  records.filter((r: any) => r.summer_student_id === s.id).forEach((r: any) => {
                    byDate[r.record_date] = (byDate[r.record_date] || 0) + (r.link_pages_count || 0);
                  });
                  const rows = Array.from({ length: days }, (_, i) => {
                    const d = new Date(start.getTime() + i * 86400000);
                    const key = d.toISOString().slice(0, 10);
                    const targetCum = Math.min(target, Math.round(daily * (i + 1) * 100) / 100);
                    return { idx: i + 1, date: key, target: daily, targetCum, actual: byDate[key] || 0 };
                  });
                  let actualCum = 0;
                  const today = new Date().toISOString().slice(0, 10);
                  return (
                    <Card key={s.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                          <span className="flex items-center gap-2">
                            {studentNameMap[s.student_id] || "—"}
                            <Badge variant="outline" className={s.plan_type === "hifz" ? "border-rose-400" : "border-amber-400"}>
                              {s.plan_type === "hifz" ? "حفظ" : "إتقان"}
                            </Badge>
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {s.plan_start_date} → {s.plan_end_date} · {days} يوم · {daily} وجه/يوم · الهدف {target} وجه
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-x-auto max-h-96">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr>
                                <th className="p-2 text-right">اليوم</th>
                                <th className="p-2 text-right">التاريخ</th>
                                <th className="p-2 text-right">المطلوب اليومي</th>
                                <th className="p-2 text-right">تراكمي مطلوب</th>
                                <th className="p-2 text-right">المسمَّع فعلاً</th>
                                <th className="p-2 text-right">تراكمي فعلي</th>
                                <th className="p-2 text-right">الحالة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(r => {
                                actualCum = Math.round((actualCum + r.actual) * 100) / 100;
                                const isFuture = r.date > today;
                                let status: { label: string; cls: string };
                                if (isFuture) status = { label: "قادم", cls: "text-muted-foreground" };
                                else if (r.actual >= r.target) status = { label: "منجز", cls: "text-green-600 dark:text-green-400" };
                                else if (r.actual > 0) status = { label: "جزئي", cls: "text-amber-600 dark:text-amber-400" };
                                else status = { label: "متأخر", cls: "text-red-600 dark:text-red-400" };
                                return (
                                  <tr key={r.date} className={`border-t ${r.date === today ? "bg-primary/5" : ""}`}>
                                    <td className="p-2">{r.idx}</td>
                                    <td className="p-2 font-mono">{r.date}</td>
                                    <td className="p-2">{r.target}</td>
                                    <td className="p-2 text-muted-foreground">{r.targetCum}</td>
                                    <td className="p-2 font-semibold">{r.actual || "—"}</td>
                                    <td className="p-2 text-muted-foreground">{actualCum}</td>
                                    <td className={`p-2 font-semibold ${status.cls}`}>{status.label}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                {(() => {
                  const totalStudents = programStudents.length;
                  const hifzStudents = programStudents.filter(s => s.plan_type === "hifz").length;
                  const taahudStudents = programStudents.filter(s => s.plan_type === "taahud").length;
                  const totalPages = programStudents.reduce((a, s) => a + (s.pages_target || 0), 0);
                  const coveredMap: Record<string, number> = {};
                  programRecords.forEach((r: any) => { coveredMap[r.summer_student_id] = (coveredMap[r.summer_student_id] || 0) + (r.link_pages_count || 0); });
                  const totalCovered = Object.values(coveredMap).reduce((a, b) => a + b, 0);
                  const overallPct = totalPages > 0 ? Math.min(100, Math.round((totalCovered / totalPages) * 100)) : 0;

                  // Per maqra
                  const perMaqra = maqare.map(m => {
                    const stu = programStudents.filter(s => s.maqra_id === m.id);
                    const tgt = stu.reduce((a, s) => a + (s.pages_target || 0), 0);
                    const cov = stu.reduce((a, s) => a + (coveredMap[s.id] || 0), 0);
                    const scores = programRecords.filter((r: any) => stu.some(x => x.id === r.summer_student_id)).map((r: any) => Number(r.total_score) || 0);
                    const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
                    return { m, count: stu.length, target: tgt, covered: cov, pct: tgt > 0 ? Math.round((cov / tgt) * 100) : 0, avgScore };
                  }).sort((a, b) => b.count - a.count);

                  // Source halaqa distribution
                  const halaqaCounts: Record<string, number> = {};
                  programStudents.forEach(s => { if (s.source_halaqa_id) halaqaCounts[s.source_halaqa_id] = (halaqaCounts[s.source_halaqa_id] || 0) + 1; });
                  const sourceRanking = Object.entries(halaqaCounts)
                    .map(([hid, count]) => ({ halaqa: halaqat.find(h => h.id === hid), count }))
                    .filter(x => x.halaqa)
                    .sort((a, b) => b.count - a.count);
                  const maxSourceCount = sourceRanking[0]?.count || 1;

                  return (
                    <>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">إجمالي الطلاب</p><p className="text-2xl font-bold">{totalStudents}</p></CardContent></Card>
                        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">طلاب الحفظ</p><p className="text-2xl font-bold text-rose-600">{hifzStudents}</p></CardContent></Card>
                        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">طلاب الإتقان</p><p className="text-2xl font-bold text-amber-600">{taahudStudents}</p></CardContent></Card>
                        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">التقدم الكلي</p><p className="text-2xl font-bold text-primary">{overallPct}%</p><Progress value={overallPct} className="h-1.5 mt-2" /><p className="text-xs text-muted-foreground mt-1">{totalCovered} / {totalPages} وجه</p></CardContent></Card>
                      </div>

                      <Card>
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />تقدم المقارئ</CardTitle></CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="p-2 text-right">المقرأة</th>
                                  <th className="p-2 text-right">التصنيف</th>
                                  <th className="p-2 text-right">الطلاب</th>
                                  <th className="p-2 text-right">الهدف</th>
                                  <th className="p-2 text-right">المُنجَز</th>
                                  <th className="p-2 text-right">التقدم</th>
                                  <th className="p-2 text-right">متوسط الأداء</th>
                                </tr>
                              </thead>
                              <tbody>
                                {perMaqra.map(x => (
                                  <tr key={x.m.id} className="border-t">
                                    <td className="p-2 font-medium">{x.m.name}</td>
                                    <td className="p-2">
                                      {x.m.plan_category === "hifz" ? <Badge className="bg-rose-600">حفظ</Badge> : x.m.plan_category === "taahud" ? <Badge className="bg-amber-600">إتقان</Badge> : <Badge variant="secondary">—</Badge>}
                                    </td>
                                    <td className="p-2">{x.count}</td>
                                    <td className="p-2">{x.target}</td>
                                    <td className="p-2">{x.covered}</td>
                                    <td className="p-2 w-40"><div className="flex items-center gap-2"><Progress value={x.pct} className="flex-1 h-1.5" /><span className="text-xs">{x.pct}%</span></div></td>
                                    <td className="p-2 font-semibold">{x.avgScore} / 40</td>
                                  </tr>
                                ))}
                                {!perMaqra.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">لا توجد مقارئ.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />حصر الطلاب حسب الحلقة المصدر</CardTitle>
                          <p className="text-xs text-muted-foreground">يوضح الحلقات الأكثر التزامًا والأكثر إسهامًا بالطلاب في البرنامج الصيفي.</p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {sourceRanking.map((r, i) => (
                              <div key={r.halaqa!.id} className="flex items-center gap-3">
                                <span className="text-xs w-6 text-center font-bold text-muted-foreground">#{i + 1}</span>
                                <span className="flex-1 text-sm">{r.halaqa!.name}</span>
                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${(r.count / maxSourceCount) * 100}%` }} />
                                </div>
                                <span className="text-sm font-bold w-14 text-left">{r.count} طالب</span>
                              </div>
                            ))}
                            {!sourceRanking.length && <p className="text-center text-muted-foreground">لا توجد بيانات.</p>}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
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
