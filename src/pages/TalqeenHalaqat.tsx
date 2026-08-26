import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StudentNameLink from "@/components/StudentNameLink";
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
import { Plus, BookOpen, Users, User, Pencil, Trash2, ScrollText, ClipboardList, CalendarDays, Settings2, CheckCircle2, BookMarked, GraduationCap, ListChecks, CalendarIcon, History, Undo2, Eye, ClipboardCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { InlineDualDate } from "@/components/DualDateDisplay";
import { formatDateHijriOnly } from "@/lib/hijri";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import ContentViewer, { lessonTypeIcon, lessonTypeLabel } from "@/components/talqeen/ContentViewer";
import DayRecordingDialog from "@/components/talqeen/DayRecordingDialog";
import { Checkbox } from "@/components/ui/checkbox";

// منتقي تاريخ بالتاريخ الهجري كأساس والميلادي كفرعي
const DualDatePicker = ({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) => {
  const dateObj = value ? new Date(value) : undefined;
  const hijriLabel = value ? formatDateHijriOnly(value) : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-right font-normal h-auto py-2", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="ml-2 h-4 w-4 opacity-60 shrink-0" />
          {hijriLabel ? (
            <span className="text-sm font-medium">{hijriLabel}</span>
          ) : (
            <span>اختر التاريخ{required ? " *" : ""}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(d) => { if (d) onChange(d.toISOString().split("T")[0]); }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

interface Teacher {
  id: string;
  full_name: string;
  assigned_halaqa_id: string | null;
  assigned_assistant_halaqa_id: string | null;
}

const TalqeenHalaqat = () => {
  const { isManager, isSupervisor, isTalqeenSupervisor } = useRole();
  const { user } = useAuth();
  const canChangeCurriculum = isManager || isTalqeenSupervisor;
  // مشرف التلقين يدير حلقات التلقين (إضافة/تعديل/حذف) كالمدير.
  const canManageHalaqat = isManager || isTalqeenSupervisor;
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [levelTracks, setLevelTracks] = useState<any[]>([]);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [studentsByHalaqa, setStudentsByHalaqa] = useState<Record<string, any[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentsDialogId, setStudentsDialogId] = useState<string | null>(null);
  const [dayRecHalaqaId, setDayRecHalaqaId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", teacher_id: "", assistant_teacher_id: "", location: "", schedule: "", level_track_id: "", talqeen_curriculum_id: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", teacher_id: "", assistant_teacher_id: "", location: "", schedule: "", capacity_max: 25, level_track_id: "", talqeen_curriculum_id: "" });
  // عرض المنهج
  const [curriculumViewHalaqaId, setCurriculumViewHalaqaId] = useState<string | null>(null);
  const [curriculumWeeks, setCurriculumWeeks] = useState<any[]>([]);
  const [curriculumDays, setCurriculumDays] = useState<any[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // تأكيد تغيير المنهج (مع معاينة الطلاب المتأثرين)
  const [curriculumConfirm, setCurriculumConfirm] = useState<{
    open: boolean;
    halaqaId: string;
    oldCurriculumId: string | null;
    newCurriculumId: string | null;
    affectedStudents: any[];
    oldName: string;
    newName: string;
    proceed: null | (() => Promise<void>);
  }>({ open: false, halaqaId: "", oldCurriculumId: null, newCurriculumId: null, affectedStudents: [], oldName: "", newName: "", proceed: null });
  // سجل تغييرات المنهج
  const [logHalaqaId, setLogHalaqaId] = useState<string | null>(null);
  const [changeLog, setChangeLog] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  // خطة الحفظ
  const [planHalaqaId, setPlanHalaqaId] = useState<string | null>(null);
  const [planSessions, setPlanSessions] = useState<any[]>([]);
  const [planForm, setPlanForm] = useState({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" });
  const [planSaving, setPlanSaving] = useState(false);

  const fetchPlanSessions = async (halaqaId: string) => {
    const { data, error } = await supabase
      .from("talqeen_sessions")
      .select("*")
      .eq("halaqa_id", halaqaId)
      .order("session_date", { ascending: false });
    if (error) { toast.error("تعذر جلب الخطة"); return; }
    setPlanSessions(data || []);
  };

  const openPlan = async (halaqaId: string) => {
    setPlanHalaqaId(halaqaId);
    setPlanForm({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" });
    await fetchPlanSessions(halaqaId);
  };

  const submitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planHalaqaId || !planForm.surah || !planForm.session_date) {
      toast.error("يرجى إدخال السورة والتاريخ");
      return;
    }
    setPlanSaving(true);
    const payload: any = {
      halaqa_id: planHalaqaId,
      session_date: planForm.session_date,
      surah: planForm.surah,
      from_ayah: planForm.from_ayah ? Number(planForm.from_ayah) : null,
      to_ayah: planForm.to_ayah ? Number(planForm.to_ayah) : null,
      status: planForm.status,
      notes: planForm.notes || null,
    };
    let error;
    if (planForm.id) {
      ({ error } = await supabase.from("talqeen_sessions").update(payload).eq("id", planForm.id));
    } else {
      ({ error } = await supabase.from("talqeen_sessions").insert(payload));
    }
    setPlanSaving(false);
    if (error) { toast.error("تعذر حفظ الجلسة"); return; }
    toast.success(planForm.id ? "تم تحديث الجلسة" : "تمت إضافة الجلسة للخطة");
    setPlanForm({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" });
    fetchPlanSessions(planHalaqaId);
  };

  const editPlanSession = (s: any) => {
    setPlanForm({
      id: s.id,
      session_date: s.session_date,
      surah: s.surah,
      from_ayah: s.from_ayah?.toString() || "",
      to_ayah: s.to_ayah?.toString() || "",
      status: s.status || "planned",
      notes: s.notes || "",
    });
  };

  const deletePlanSession = async (id: string) => {
    const { error } = await supabase.from("talqeen_sessions").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تم حذف الجلسة");
    if (planHalaqaId) fetchPlanSessions(planHalaqaId);
  };

  const planStatusBadge = (s: string | null) => {
    const map: Record<string, { label: string; cls: string }> = {
      planned: { label: "مخططة", cls: "bg-blue-100 text-blue-700" },
      in_progress: { label: "جارية", cls: "bg-amber-100 text-amber-700" },
      completed: { label: "مكتملة", cls: "bg-green-100 text-green-700" },
    };
    const m = map[s || "planned"] || map.planned;
    return <Badge className={m.cls}>{m.label}</Badge>;
  };

  // ============== إدارة الجلسة (تنفيذ/حضور/واجب/برنامج تربوي) ==============
  const [manageSession, setManageSession] = useState<any | null>(null);
  const [manageTab, setManageTab] = useState("execution");
  const [manageSaving, setManageSaving] = useState(false);
  const [execForm, setExecForm] = useState({ executed: false, executed_at: "", execution_notes: "" });
  const [homeworkForm, setHomeworkForm] = useState({ homework: "", homework_due_date: "" });
  const [eduForm, setEduForm] = useState({ educational_program_title: "", educational_program_details: "" });
  const [attendanceRows, setAttendanceRows] = useState<Array<{ student_id: string; full_name: string; status: string; homework_status: string; notes: string }>>([]);

  // ========== Halaqa Program (talqeen_program_assignments) ==========
  const [hpAssignment, setHpAssignment] = useState<any | null>(null);
  const [hpChapters, setHpChapters] = useState<any[]>([]);
  const [hpLessonsByChapter, setHpLessonsByChapter] = useState<Record<string, any[]>>({});
  const [hpProgress, setHpProgress] = useState<Record<string, any>>({}); // lesson_id -> progress row
  const [hpViewerLesson, setHpViewerLesson] = useState<any | null>(null);

  const loadHalaqaProgram = async (halaqaId: string) => {
    setHpAssignment(null); setHpChapters([]); setHpLessonsByChapter({}); setHpProgress({});
    const { data: a } = await (supabase as any)
      .from("talqeen_program_assignments")
      .select("*, talqeen_curricula(name)")
      .eq("halaqa_id", halaqaId).eq("is_active", true)
      .order("assigned_at", { ascending: false }).limit(1).maybeSingle();
    if (!a) return;
    setHpAssignment(a);
    const { data: chs } = await (supabase as any)
      .from("talqeen_chapters").select("*").eq("curriculum_id", a.curriculum_id)
      .order("sort_order").order("chapter_number");
    setHpChapters(chs || []);
    const ids = (chs || []).map((c: any) => c.id);
    if (ids.length) {
      const { data: les } = await (supabase as any)
        .from("talqeen_lessons").select("*").in("chapter_id", ids).order("lesson_number");
      const grouped: Record<string, any[]> = {};
      (les || []).forEach((l: any) => { (grouped[l.chapter_id] = grouped[l.chapter_id] || []).push(l); });
      setHpLessonsByChapter(grouped);
    }
    const { data: prog } = await (supabase as any)
      .from("talqeen_program_progress").select("*").eq("assignment_id", a.id);
    const map: Record<string, any> = {};
    (prog || []).forEach((p: any) => { map[p.lesson_id] = p; });
    setHpProgress(map);
  };

  const toggleLessonProgress = async (lesson: any, done: boolean) => {
    if (!hpAssignment) return;
    const existing = hpProgress[lesson.id];
    const status = done ? "completed" : "pending";
    const completed_at = done ? new Date().toISOString() : null;
    if (existing) {
      const { error } = await (supabase as any).from("talqeen_program_progress")
        .update({ status, completed_at }).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await (supabase as any).from("talqeen_program_progress").insert({
        assignment_id: hpAssignment.id, lesson_id: lesson.id, halaqa_id: hpAssignment.halaqa_id,
        status, completed_at,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setHpProgress((m) => ({ ...m, [lesson.id]: data }));
      return;
    }
    setHpProgress((m) => ({ ...m, [lesson.id]: { ...m[lesson.id], status, completed_at } }));
  };

  const openManage = async (s: any) => {
    setManageSession(s);
    setManageTab("execution");
    setExecForm({
      executed: !!s.executed,
      executed_at: s.executed_at ? new Date(s.executed_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      execution_notes: s.execution_notes || "",
    });
    setHomeworkForm({
      homework: s.homework || "",
      homework_due_date: s.homework_due_date || "",
    });
    setEduForm({
      educational_program_title: s.educational_program_title || "",
      educational_program_details: s.educational_program_details || "",
    });
    const halaqaStudents = studentsByHalaqa[s.halaqa_id] || [];
    const { data: existing } = await supabase
      .from("talqeen_session_attendance")
      .select("*")
      .eq("session_id", s.id);
    const existingMap = new Map((existing || []).map((r: any) => [r.student_id, r]));
    setAttendanceRows(
      halaqaStudents.map((st: any) => {
        const ex = existingMap.get(st.id) as any;
        return {
          student_id: st.id,
          full_name: st.full_name,
          status: ex?.status || "present",
          homework_status: ex?.homework_status || "not_submitted",
          notes: ex?.notes || "",
        };
      })
    );
    if (s.halaqa_id) loadHalaqaProgram(s.halaqa_id);
  };

  const closeManage = () => { setManageSession(null); setAttendanceRows([]); };

  const saveExecution = async () => {
    if (!manageSession) return;
    setManageSaving(true);
    const update: any = {
      executed: execForm.executed,
      executed_at: execForm.executed ? (execForm.executed_at ? new Date(execForm.executed_at).toISOString() : new Date().toISOString()) : null,
      execution_notes: execForm.execution_notes || null,
    };
    if (execForm.executed) update.status = "completed";
    const { error } = await supabase.from("talqeen_sessions").update(update).eq("id", manageSession.id);
    setManageSaving(false);
    if (error) { toast.error("تعذر حفظ التنفيذ"); return; }
    toast.success("تم حفظ التنفيذ");
    if (planHalaqaId) fetchPlanSessions(planHalaqaId);
    setManageSession({ ...manageSession, ...update });
  };

  const saveHomework = async () => {
    if (!manageSession) return;
    setManageSaving(true);
    const { error } = await supabase.from("talqeen_sessions").update({
      homework: homeworkForm.homework || null,
      homework_due_date: homeworkForm.homework_due_date || null,
    }).eq("id", manageSession.id);
    setManageSaving(false);
    if (error) { toast.error("تعذر حفظ الواجب"); return; }
    toast.success("تم حفظ الواجب");
    if (planHalaqaId) fetchPlanSessions(planHalaqaId);
  };

  const saveEduProgram = async () => {
    if (!manageSession) return;
    setManageSaving(true);
    const { error } = await supabase.from("talqeen_sessions").update({
      educational_program_title: eduForm.educational_program_title || null,
      educational_program_details: eduForm.educational_program_details || null,
    }).eq("id", manageSession.id);
    setManageSaving(false);
    if (error) { toast.error("تعذر حفظ البرنامج التربوي"); return; }
    toast.success("تم حفظ البرنامج التربوي");
    if (planHalaqaId) fetchPlanSessions(planHalaqaId);
  };

  const saveAttendance = async () => {
    if (!manageSession || attendanceRows.length === 0) {
      toast.error("لا يوجد طلاب للحفظ");
      return;
    }
    setManageSaving(true);
    const payload = attendanceRows.map((r) => ({
      session_id: manageSession.id,
      student_id: r.student_id,
      status: r.status,
      homework_status: r.homework_status,
      notes: r.notes || null,
    }));
    const { error } = await supabase
      .from("talqeen_session_attendance")
      .upsert(payload, { onConflict: "session_id,student_id" });
    setManageSaving(false);
    if (error) { toast.error("تعذر حفظ الحضور"); return; }
    toast.success("تم حفظ الحضور");
  };

  const markAllPresent = () => setAttendanceRows((prev) => prev.map((r) => ({ ...r, status: "present" })));

  const updateAttendanceRow = (student_id: string, patch: Partial<{ status: string; homework_status: string; notes: string }>) =>
    setAttendanceRows((prev) => prev.map((r) => (r.student_id === student_id ? { ...r, ...patch } : r)));

  const homeworkStatusOptions = [
    { value: "submitted", label: "سلّم" },
    { value: "partial", label: "جزئي" },
    { value: "not_submitted", label: "لم يسلم" },
    { value: "exempt", label: "معفى" },
  ];

  const fetchData = async () => {
    const [halaqatRes, teachersRes, studentsRes, tracksRes, curriculaRes] = await Promise.all([
      supabase.from("halaqat").select("*, profiles:teacher_id(full_name), assistant:assistant_teacher_id(full_name)").eq("active", true),
      supabase.from("profiles").select("id, full_name, assigned_halaqa_id, assigned_assistant_halaqa_id").in("role", ["teacher", "assistant_teacher"]),
      supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active"),
      supabase.from("level_tracks").select("*").eq("active", true).order("sort_order"),
      supabase.from("talqeen_curricula").select("*").eq("active", true).order("code"),
    ]);
    const allHalaqat = halaqatRes.data || [];
    setHalaqat(allHalaqat.filter((h: any) => h.name.includes("تلقين")));
    setTeachers((teachersRes.data as Teacher[]) || []);
    setLevelTracks(tracksRes.data || []);
    setCurricula(curriculaRes.data || []);

    const grouped: Record<string, any[]> = {};
    (studentsRes.data || []).forEach((s: any) => {
      if (s.halaqa_id) {
        if (!grouped[s.halaqa_id]) grouped[s.halaqa_id] = [];
        grouped[s.halaqa_id].push(s);
      }
    });
    setStudentsByHalaqa(grouped);
  };

  // ربط طلاب الحلقة النشطين بمنهج التلقين تلقائياً
  const syncStudentsToCurriculum = async (halaqaId: string, curriculumId: string | null) => {
    if (!curriculumId) return;
    const studs = (studentsByHalaqa[halaqaId] || []);
    if (studs.length === 0) return;
    // Deactivate other active curriculum links for these students
    await supabase
      .from("talqeen_student_curricula")
      .update({ active: false })
      .in("student_id", studs.map((s) => s.id))
      .eq("active", true)
      .neq("curriculum_id", curriculumId);
    // Upsert new active links
    const rows = studs.map((s) => ({
      student_id: s.id,
      curriculum_id: curriculumId,
      halaqa_id: halaqaId,
      start_date: new Date().toISOString().split("T")[0],
      active: true,
    }));
    await supabase.from("talqeen_student_curricula").upsert(rows as any, { onConflict: "student_id,curriculum_id" } as any);
  };

  const openCurriculumView = async (halaqaId: string) => {
    const h = halaqat.find((x) => x.id === halaqaId);
    if (!h?.talqeen_curriculum_id) {
      toast.error("لم يتم ربط منهج بهذه الحلقة بعد. عدّل الحلقة وحدّد المنهج.");
      return;
    }
    setCurriculumViewHalaqaId(halaqaId);
    const { data: weeks } = await supabase
      .from("talqeen_curriculum_weeks")
      .select("*")
      .eq("curriculum_id", h.talqeen_curriculum_id)
      .order("week_number");
    setCurriculumWeeks(weeks || []);
    if (weeks && weeks.length > 0) {
      const { data: days } = await supabase
        .from("talqeen_curriculum_days")
        .select("*")
        .in("week_id", weeks.map((w: any) => w.id))
        .order("day_order");
      setCurriculumDays(days || []);
    } else {
      setCurriculumDays([]);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // تحديث فوري لعدد الطلاب وسجل التغييرات عبر Realtime
  useEffect(() => {
    const ch = supabase
      .channel("talqeen-halaqat-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "talqeen_curriculum_change_log" }, (payload: any) => {
        if (logHalaqaId && payload?.new?.halaqa_id === logHalaqaId) {
          openChangeLog(logHalaqaId);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logHalaqaId]);

  // إظهار جميع المعلمين، مع توضيح ارتباط كل معلم بحلقة أخرى (يمكن نقله)
  const getAvailableTeachers = (_currentTeacherId?: string) => teachers;
  const getAvailableAssistants = (_currentAssistantId?: string) => teachers;

  const halaqaNameById = (id?: string | null) =>
    halaqat.find((h) => h.id === id)?.name || null;

  const teacherLabel = (t: Teacher, currentId?: string, assistant = false) => {
    const assignedId = assistant ? t.assigned_assistant_halaqa_id : t.assigned_halaqa_id;
    if (!assignedId) return `${t.full_name} — غير مرتبط بحلقة`;
    if (t.id === currentId) return `${t.full_name} (الحالي)`;
    const name = halaqaNameById(assignedId);
    return name ? `${t.full_name} — مرتبط بـ: ${name}` : t.full_name;
  };

  const linkTeacherToHalaqa = async (teacherId: string | null, halaqaId: string, oldTeacherId?: string | null) => {
    if (oldTeacherId && oldTeacherId !== teacherId) {
      await supabase.from("profiles").update({ assigned_halaqa_id: null } as any).eq("id", oldTeacherId);
    }
    // فك ارتباط المعلم من حلقته السابقة (إن كانت مختلفة)
    if (teacherId) {
      const prev = teachers.find((t) => t.id === teacherId)?.assigned_halaqa_id;
      if (prev && prev !== halaqaId) {
        await supabase.from("halaqat").update({ teacher_id: null }).eq("id", prev);
      }
    }
    const { error } = await supabase.from("halaqat").update({ teacher_id: teacherId }).eq("id", halaqaId);
    if (error) return false;
    if (teacherId) {
      await supabase.from("profiles").update({ assigned_halaqa_id: halaqaId } as any).eq("id", teacherId);
    }
    return true;
  };

  const linkAssistantToHalaqa = async (assistantId: string | null, halaqaId: string, oldAssistantId?: string | null) => {
    if (oldAssistantId && oldAssistantId !== assistantId) {
      await supabase.from("profiles").update({ assigned_assistant_halaqa_id: null } as any).eq("id", oldAssistantId);
    }
    if (assistantId) {
      const prev = teachers.find((t) => t.id === assistantId)?.assigned_assistant_halaqa_id;
      if (prev && prev !== halaqaId) {
        await supabase.from("halaqat").update({ assistant_teacher_id: null }).eq("id", prev);
      }
    }
    const { error } = await supabase.from("halaqat").update({ assistant_teacher_id: assistantId }).eq("id", halaqaId);
    if (error) return false;
    if (assistantId) {
      await supabase.from("profiles").update({ assigned_assistant_halaqa_id: halaqaId } as any).eq("id", assistantId);
    }
    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: newHalaqa, error } = await supabase.from("halaqat").insert({
      name: form.name,
      teacher_id: null,
      assistant_teacher_id: null,
      location: form.location || null,
      schedule: form.schedule || null,
      level_track_id: form.level_track_id || null,
      talqeen_curriculum_id: form.talqeen_curriculum_id || null,
    }).select("id").single();

    if (error || !newHalaqa) { toast.error("حدث خطأ"); return; }

    if (form.teacher_id) {
      const linked = await linkTeacherToHalaqa(form.teacher_id, newHalaqa.id);
      if (!linked) {
        await supabase.from("halaqat").delete().eq("id", newHalaqa.id);
        return;
      }
    }
    if (form.assistant_teacher_id) {
      const linked = await linkAssistantToHalaqa(form.assistant_teacher_id, newHalaqa.id);
      if (!linked) {
        if (form.teacher_id) {
          await supabase.from("profiles").update({ assigned_halaqa_id: null } as any).eq("id", form.teacher_id);
        }
        await supabase.from("halaqat").delete().eq("id", newHalaqa.id);
        return;
      }
    }

    if (form.talqeen_curriculum_id) {
      await syncStudentsToCurriculum(newHalaqa.id, form.talqeen_curriculum_id);
    }

    toast.success("تم إضافة حلقة التلقين بنجاح.");
    setDialogOpen(false);
    setForm({ name: "", teacher_id: "", assistant_teacher_id: "", location: "", schedule: "", level_track_id: "", talqeen_curriculum_id: "" });
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
      assistant_teacher_id: h.assistant_teacher_id || "",
      location: h.location || "",
      schedule: h.schedule || "",
      capacity_max: h.capacity_max || 25,
      level_track_id: h.level_track_id || "",
      talqeen_curriculum_id: h.talqeen_curriculum_id || "",
    });
    setEditOpen(true);
  };

  // كتابة سجل تغيير المنهج
  const recordCurriculumChange = async (
    halaqaId: string,
    oldCurriculumId: string | null,
    newCurriculumId: string | null,
    affectedCount: number,
  ) => {
    await supabase.from("talqeen_curriculum_change_log").insert({
      halaqa_id: halaqaId,
      old_curriculum_id: oldCurriculumId,
      new_curriculum_id: newCurriculumId,
      affected_students_count: affectedCount,
      changed_by: user?.id || null,
    } as any);
  };

  const performEditHalaqa = async () => {
    if (!editId) return;
    const currentHalaqa = halaqat.find((h) => h.id === editId);
    const oldTeacherId = currentHalaqa?.teacher_id || null;
    const newTeacherId = editForm.teacher_id || null;
    const oldAssistantId = currentHalaqa?.assistant_teacher_id || null;
    const newAssistantId = editForm.assistant_teacher_id || null;
    const oldCurriculumId = currentHalaqa?.talqeen_curriculum_id || null;
    const newCurriculumId = editForm.talqeen_curriculum_id || null;
    const curriculumChanged = oldCurriculumId !== newCurriculumId;

    if (oldTeacherId !== newTeacherId) {
      const linked = await linkTeacherToHalaqa(newTeacherId, editId, oldTeacherId);
      if (!linked) return;
    }
    if (oldAssistantId !== newAssistantId) {
      const linked = await linkAssistantToHalaqa(newAssistantId, editId, oldAssistantId);
      if (!linked) return;
    }

    const { error } = await supabase.from("halaqat").update({
      name: editForm.name,
      location: editForm.location || null,
      schedule: editForm.schedule || null,
      capacity_max: editForm.capacity_max,
      level_track_id: editForm.level_track_id || null,
      talqeen_curriculum_id: editForm.talqeen_curriculum_id || null,
    }).eq("id", editId);

    if (error) { toast.error("حدث خطأ أثناء التعديل"); return; }

    if (newCurriculumId) {
      await syncStudentsToCurriculum(editId, newCurriculumId);
    }

    if (curriculumChanged) {
      const affected = (studentsByHalaqa[editId] || []).filter((s: any) => s.status === "active").length;
      await recordCurriculumChange(editId, oldCurriculumId, newCurriculumId, affected);
    }

    toast.success("تم تعديل الحلقة بنجاح.");
    setEditOpen(false);
    fetchData();
  };

  const handleEditHalaqa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    const currentHalaqa = halaqat.find((h) => h.id === editId);
    const oldCurriculumId = currentHalaqa?.talqeen_curriculum_id || "";
    const newCurriculumId = editForm.talqeen_curriculum_id || "";

    // إن تغيّر المنهج، اعرض تأكيد مع معاينة الطلاب المتأثرين
    if (oldCurriculumId !== newCurriculumId && newCurriculumId) {
      if (!canChangeCurriculum) {
        toast.error("صلاحية تغيير المنهج مقصورة على المدير ومشرف التلقين.");
        return;
      }
      const affected = (studentsByHalaqa[editId] || []).filter((s: any) => s.status === "active");
      const oldName = curricula.find((c) => c.id === oldCurriculumId)?.name || "بدون منهج";
      const newName = curricula.find((c) => c.id === newCurriculumId)?.name || "—";
      setCurriculumConfirm({
        open: true,
        halaqaId: editId,
        oldCurriculumId: oldCurriculumId || null,
        newCurriculumId: newCurriculumId || null,
        affectedStudents: affected,
        oldName,
        newName,
        proceed: performEditHalaqa,
      });
      return;
    }

    await performEditHalaqa();
  };

  // فتح سجل تغييرات المنهج
  const openChangeLog = async (halaqaId: string) => {
    setLogHalaqaId(halaqaId);
    setLoadingLog(true);
    const { data } = await supabase
      .from("talqeen_curriculum_change_log")
      .select("*")
      .eq("halaqa_id", halaqaId)
      .order("created_at", { ascending: false });
    setChangeLog(data || []);
    setLoadingLog(false);
  };

  // تنفيذ التراجع عن آخر تغيير منهج
  const undoCurriculumChange = async (logEntry: any) => {
    if (!canChangeCurriculum) {
      toast.error("صلاحية التراجع مقصورة على المدير ومشرف التلقين.");
      return;
    }
    if (logEntry.reverted) {
      toast.error("هذا التغيير تم التراجع عنه مسبقاً.");
      return;
    }
    // إعادة المنهج القديم
    const { error: upErr } = await supabase
      .from("halaqat")
      .update({ talqeen_curriculum_id: logEntry.old_curriculum_id || null })
      .eq("id", logEntry.halaqa_id);
    if (upErr) { toast.error("فشل التراجع"); return; }

    // إعادة ربط الطلاب بالمنهج السابق إن وُجد
    if (logEntry.old_curriculum_id) {
      await syncStudentsToCurriculum(logEntry.halaqa_id, logEntry.old_curriculum_id);
    } else {
      // إلغاء تفعيل ارتباط الطلاب بالمنهج الجديد
      const studs = (studentsByHalaqa[logEntry.halaqa_id] || []);
      if (studs.length > 0 && logEntry.new_curriculum_id) {
        await supabase
          .from("talqeen_student_curricula")
          .update({ active: false })
          .in("student_id", studs.map((s) => s.id))
          .eq("curriculum_id", logEntry.new_curriculum_id);
      }
    }

    await supabase
      .from("talqeen_curriculum_change_log")
      .update({ reverted: true, reverted_at: new Date().toISOString(), reverted_by: user?.id || null })
      .eq("id", logEntry.id);

    toast.success("تم التراجع عن التغيير وإعادة الحالة السابقة.");
    await openChangeLog(logEntry.halaqa_id);
    fetchData();
  };


  const handleDeleteHalaqa = async () => {
    if (!deleteId) return;
    const halaqa = halaqat.find((h) => h.id === deleteId);
    if (halaqa?.teacher_id) {
      await supabase.from("profiles").update({ assigned_halaqa_id: null } as any).eq("id", halaqa.teacher_id);
    }
    if (halaqa?.assistant_teacher_id) {
      await supabase.from("profiles").update({ assigned_assistant_halaqa_id: null } as any).eq("id", halaqa.assistant_teacher_id);
    }
    const { error } = await supabase.from("halaqat").update({ active: false }).eq("id", deleteId);
    if (error) { toast.error("حدث خطأ أثناء الحذف"); return; }
    toast.success("تم حذف الحلقة");
    setDeleteOpen(false);
    setDeleteId(null);
    fetchData();
  };

  const availableTeachersForAdd = getAvailableTeachers();
  const availableAssistantsForAdd = getAvailableAssistants();
  const availableTeachersForEdit = getAvailableTeachers(editForm.teacher_id);
  const availableAssistantsForEdit = getAvailableAssistants(editForm.assistant_teacher_id);

  const totalStudents = halaqat.reduce((sum, h) => sum + (studentsByHalaqa[h.id]?.length || 0), 0);
  const totalCapacity = halaqat.reduce((sum, h) => sum + (h.capacity_max || 25), 0);
  const totalPct = totalCapacity > 0 ? Math.min((totalStudents / totalCapacity) * 100, 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">حلقات التلقين</h1>
            <p className="text-muted-foreground text-sm">{halaqat.length} حلقات تلقين</p>
          </div>
          <div className="mr-4 flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 transition-all hover:bg-primary/15 hover:shadow-md cursor-default group">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-primary">{totalStudents}</span>
                <span className="text-xs text-muted-foreground">/ {totalCapacity}</span>
              </div>
            </div>
            <div className="w-16 mr-2">
              <Progress value={totalPct} className="h-1.5" />
            </div>
          </div>
        </div>
        {canManageHalaqat && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />إضافة حلقة تلقين</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة حلقة تلقين جديدة</DialogTitle></DialogHeader>
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
                        <SelectItem key={t.id} value={t.id}>{teacherLabel(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المعلم المساعد</Label>
                  <Select value={form.assistant_teacher_id} onValueChange={(v) => setForm({ ...form, assistant_teacher_id: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المعلم المساعد (اختياري)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">بدون مساعد</SelectItem>
                      {availableAssistantsForAdd.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{teacherLabel(t, undefined, true)}</SelectItem>
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
                  <Label>منهج التلقين (المستوى) *</Label>
                  <Select value={form.talqeen_curriculum_id} onValueChange={(v) => setForm({ ...form, talqeen_curriculum_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المنهج" /></SelectTrigger>
                    <SelectContent>
                      {curricula.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">سيتم ربط جميع طلاب الحلقة تلقائياً بالمنهج المختار.</p>
                </div>
                <Button type="submit" className="w-full">إضافة</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
                      <ScrollText className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-base">{h.name}</CardTitle>
                  </div>
                  <Badge className={status.color}>{status.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">المعلم: {h.profiles?.full_name || "غير محدد"}</p>
                {h.assistant_teacher_id && <p className="text-muted-foreground">المعلم المساعد: {h.assistant?.full_name || "غير محدد"}</p>}
                {h.level_track_id && (
                  <p className="text-muted-foreground">المسار: {levelTracks.find(t => t.id === h.level_track_id)?.name || "—"}</p>
                )}
                {h.talqeen_curriculum_id && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    المنهج: {curricula.find(c => c.id === h.talqeen_curriculum_id)?.name || "—"}
                  </p>
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
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button variant="default" size="sm" className="flex-1 min-w-[120px] bg-primary" onClick={() => setDayRecHalaqaId(h.id)}>
                    <ClipboardCheck className="w-3 h-3 ml-1" />
                    تسجيل اليوم
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-[120px]" onClick={() => setStudentsDialogId(h.id)}>
                    <User className="w-3 h-3 ml-1" />
                    عرض الطلاب ({count})
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-[120px]" onClick={() => openCurriculumView(h.id)}>
                    <BookOpen className="w-3 h-3 ml-1" />
                    منهج التلقين
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-[120px]" onClick={() => openPlan(h.id)}>
                    <ClipboardList className="w-3 h-3 ml-1" />
                    جلسات الخطة
                  </Button>
                  {canChangeCurriculum && (
                    <Button variant="outline" size="sm" className="flex-1 min-w-[120px]" onClick={() => openChangeLog(h.id)}>
                      <History className="w-3 h-3 ml-1" />
                      سجل المنهج
                    </Button>
                  )}
                  {canManageHalaqat && (
                    <>
                      <Button aria-label="تعديل" variant="outline" size="icon" className="h-9 w-9" onClick={() => openEditHalaqa(h)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button aria-label="حذف" variant="outline" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { setDeleteId(h.id); setDeleteOpen(true); }}>
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

      {/* Day recording dialog */}
      {dayRecHalaqaId && (
        <DayRecordingDialog
          open={!!dayRecHalaqaId}
          onClose={() => setDayRecHalaqaId(null)}
          halaqaId={dayRecHalaqaId}
          halaqaName={halaqat.find((h) => h.id === dayRecHalaqaId)?.name || ""}
          students={(studentsByHalaqa[dayRecHalaqaId] || []).map((s: any) => ({ id: s.id, full_name: s.full_name }))}
          canEditPastDays={isManager || isSupervisor || isTalqeenSupervisor}
        />
      )}

      {/* Students list dialog */}
      <Dialog open={!!studentsDialogId} onOpenChange={() => setStudentsDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>طلاب الحلقة: {halaqat.find((h) => h.id === studentsDialogId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {(studentsByHalaqa[studentsDialogId || ""] || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-6">لا يوجد طلاب</p>
            ) : (
              (studentsByHalaqa[studentsDialogId || ""] || []).map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <StudentNameLink studentId={s.id} studentName={s.full_name} className="text-sm" />
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
                      {teacherLabel(t, editForm.teacher_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المعلم المساعد</Label>
              <Select value={editForm.assistant_teacher_id || "__none__"} onValueChange={(v) => setEditForm({ ...editForm, assistant_teacher_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="اختر المعلم المساعد (اختياري)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون مساعد</SelectItem>
                  {availableAssistantsForEdit.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {teacherLabel(t, editForm.assistant_teacher_id, true)}
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
              <Label>منهج التلقين (المستوى)</Label>
              <Select
                value={editForm.talqeen_curriculum_id}
                onValueChange={(v) => setEditForm({ ...editForm, talqeen_curriculum_id: v })}
                disabled={!canChangeCurriculum}
              >
                <SelectTrigger><SelectValue placeholder="اختر المنهج" /></SelectTrigger>
                <SelectContent>
                  {curricula.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {canChangeCurriculum
                  ? "سيُعرض تأكيد بالطلاب المتأثرين قبل إعادة الربط، ويمكن التراجع لاحقاً."
                  : "تغيير المنهج مقصور على المدير ومشرف التلقين."}
              </p>
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

      {/* تأكيد تغيير المنهج مع معاينة الطلاب المتأثرين */}
      <AlertDialog
        open={curriculumConfirm.open}
        onOpenChange={(o) => !o && setCurriculumConfirm({ open: false, halaqaId: "", oldCurriculumId: null, newCurriculumId: null, affectedStudents: [], oldName: "", newName: "", proceed: null })}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              معاينة تغيير منهج الحلقة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-right">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border p-2 bg-muted/30">
                    <div className="text-xs text-muted-foreground">المنهج الحالي</div>
                    <div className="font-semibold">{curriculumConfirm.oldName}</div>
                  </div>
                  <div className="rounded-md border p-2 bg-primary/10">
                    <div className="text-xs text-muted-foreground">المنهج الجديد</div>
                    <div className="font-semibold text-primary">{curriculumConfirm.newName}</div>
                  </div>
                </div>
                <div className="text-sm">
                  عدد الطلاب الذين سيُعاد ربطهم تلقائياً:{" "}
                  <span className="font-bold text-primary text-base">{curriculumConfirm.affectedStudents.length}</span>
                </div>
                {curriculumConfirm.affectedStudents.length > 0 && (
                  <div className="rounded-md border max-h-48 overflow-y-auto">
                    <ul className="divide-y text-xs">
                      {curriculumConfirm.affectedStudents.map((s: any) => (
                        <li key={s.id} className="px-3 py-1.5 flex justify-between">
                          <span>{s.full_name || s.name}</span>
                          <span className="text-muted-foreground">{s.id?.toString().slice(0, 8)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  ملاحظة: يمكن التراجع عن هذا التغيير لاحقاً من سجل تغييرات المنهج.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const fn = curriculumConfirm.proceed;
                setCurriculumConfirm({ open: false, halaqaId: "", oldCurriculumId: null, newCurriculumId: null, affectedStudents: [], oldName: "", newName: "", proceed: null });
                if (fn) await fn();
              }}
            >
              تأكيد ومتابعة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* سجل تغييرات المنهج */}
      <Dialog open={!!logHalaqaId} onOpenChange={(o) => { if (!o) { setLogHalaqaId(null); setChangeLog([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              سجل تغييرات المنهج — {halaqat.find(h => h.id === logHalaqaId)?.name || ""}
            </DialogTitle>
          </DialogHeader>
          {loadingLog ? (
            <div className="text-center py-8 text-muted-foreground">جارٍ التحميل...</div>
          ) : changeLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد تغييرات مسجلة بعد.</div>
          ) : (
            <ul className="divide-y border rounded-md">
              {changeLog.map((entry) => {
                const oldName = curricula.find(c => c.id === entry.old_curriculum_id)?.name || "بدون منهج";
                const newName = curricula.find(c => c.id === entry.new_curriculum_id)?.name || "بدون منهج";
                const dual = formatDateHijriOnly(entry.created_at);
                return (
                  <li key={entry.id} className="p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1 text-sm">
                      <div>
                        من <span className="font-semibold">{oldName}</span> إلى{" "}
                        <span className="font-semibold text-primary">{newName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dual}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        عدد الطلاب المتأثرين: {entry.affected_students_count}
                      </div>
                      {entry.reverted && (
                        <div className="text-xs text-amber-600 font-medium">
                          ↺ تم التراجع عن هذا التغيير
                        </div>
                      )}
                    </div>
                    {canChangeCurriculum && !entry.reverted && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => undoCurriculumChange(entry)}
                      >
                        <Undo2 className="w-3 h-3 ml-1" />
                        تراجع
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* خطة الحفظ Dialog */}
      <Dialog open={!!planHalaqaId} onOpenChange={(o) => { if (!o) { setPlanHalaqaId(null); setPlanSessions([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              خطة الحفظ — {halaqat.find((h) => h.id === planHalaqaId)?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submitPlan} className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="text-sm font-semibold">{planForm.id ? "تعديل جلسة" : "إضافة جلسة جديدة للخطة"}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>التاريخ</Label>
                <DualDatePicker value={planForm.session_date} onChange={(v) => setPlanForm({ ...planForm, session_date: v })} required />
              </div>
              <div className="space-y-1">
                <Label>السورة</Label>
                <Input value={planForm.surah} onChange={(e) => setPlanForm({ ...planForm, surah: e.target.value })} placeholder="مثال: البقرة" required />
              </div>
              <div className="space-y-1">
                <Label>من آية</Label>
                <Input type="number" min={1} value={planForm.from_ayah} onChange={(e) => setPlanForm({ ...planForm, from_ayah: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>إلى آية</Label>
                <Input type="number" min={1} value={planForm.to_ayah} onChange={(e) => setPlanForm({ ...planForm, to_ayah: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>الحالة</Label>
                <Select value={planForm.status} onValueChange={(v) => setPlanForm({ ...planForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">مخططة</SelectItem>
                    <SelectItem value="in_progress">جارية</SelectItem>
                    <SelectItem value="completed">مكتملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>ملاحظات</Label>
                <Textarea rows={2} value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={planSaving} className="flex-1">
                {planForm.id ? "حفظ التعديلات" : "إضافة للخطة"}
              </Button>
              {planForm.id && (
                <Button type="button" variant="outline" onClick={() => setPlanForm({ id: "", session_date: new Date().toISOString().split("T")[0], surah: "", from_ayah: "", to_ayah: "", status: "planned", notes: "" })}>
                  إلغاء التعديل
                </Button>
              )}
            </div>
          </form>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4" /> جلسات الخطة ({planSessions.length})</h3>
            {planSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد جلسات في الخطة بعد</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {planSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.surah}</span>
                        {s.from_ayah && (
                          <span className="text-xs text-muted-foreground">
                            (آية {s.from_ayah}{s.to_ayah ? ` - ${s.to_ayah}` : ""})
                          </span>
                        )}
                        {planStatusBadge(s.status)}
                        {s.executed && <Badge className="bg-emerald-100 text-emerald-700">منفّذة</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <InlineDualDate date={s.session_date} />
                        {s.notes && <span className="mr-2">• {s.notes}</span>}
                      </div>
                    </div>
                    <Button variant="default" size="sm" className="h-8" onClick={() => openManage(s)}>
                      <Settings2 className="w-3 h-3 ml-1" />
                      إدارة
                    </Button>
                    <Button aria-label="تعديل" variant="outline" size="icon" className="h-8 w-8" onClick={() => editPlanSession(s)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button aria-label="حذف" variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletePlanSession(s.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* إدارة الجلسة Dialog */}
      <Dialog open={!!manageSession} onOpenChange={(o) => { if (!o) closeManage(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              إدارة جلسة — {manageSession?.surah}
              {manageSession?.from_ayah && (
                <span className="text-sm font-normal text-muted-foreground">
                  (آية {manageSession.from_ayah}{manageSession.to_ayah ? ` - ${manageSession.to_ayah}` : ""})
                </span>
              )}
              {manageSession?.session_date && (
                <span className="text-sm font-normal text-muted-foreground mr-2 inline-flex items-center gap-1">• <InlineDualDate date={manageSession.session_date} /></span>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={manageTab} onValueChange={setManageTab} className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="execution"><CheckCircle2 className="w-4 h-4 ml-1" />التنفيذ</TabsTrigger>
              <TabsTrigger value="attendance"><ListChecks className="w-4 h-4 ml-1" />الحضور</TabsTrigger>
              <TabsTrigger value="homework"><BookMarked className="w-4 h-4 ml-1" />الواجب</TabsTrigger>
              <TabsTrigger value="education"><GraduationCap className="w-4 h-4 ml-1" />البرنامج التربوي</TabsTrigger>
              <TabsTrigger value="program"><BookOpen className="w-4 h-4 ml-1" />برنامج الحلقة</TabsTrigger>
            </TabsList>

            {/* تبويب التنفيذ */}
            <TabsContent value="execution" className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div>
                  <Label className="text-base">تأشير الجلسة كمنفّذة</Label>
                  <p className="text-xs text-muted-foreground mt-1">عند التفعيل يتم تحديث حالة الجلسة إلى "مكتملة" تلقائياً.</p>
                </div>
                <Switch checked={execForm.executed} onCheckedChange={(v) => setExecForm({ ...execForm, executed: v })} />
              </div>
              <div className="space-y-2">
                <Label>وقت التنفيذ</Label>
                <Input type="datetime-local" value={execForm.executed_at} onChange={(e) => setExecForm({ ...execForm, executed_at: e.target.value })} disabled={!execForm.executed} />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات التنفيذ</Label>
                <Textarea rows={3} value={execForm.execution_notes} onChange={(e) => setExecForm({ ...execForm, execution_notes: e.target.value })} placeholder="ملاحظات حول سير الجلسة..." />
              </div>
              <Button onClick={saveExecution} disabled={manageSaving} className="w-full">حفظ التنفيذ</Button>
            </TabsContent>

            {/* تبويب الحضور */}
            <TabsContent value="attendance" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">عدد الطلاب: {attendanceRows.length}</p>
                <Button variant="outline" size="sm" onClick={markAllPresent}>
                  <CheckCircle2 className="w-4 h-4 ml-1" />
                  تحديد الكل حاضر
                </Button>
              </div>
              {attendanceRows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">لا يوجد طلاب نشطون في هذه الحلقة</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {attendanceRows.map((r) => (
                    <div key={r.student_id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 rounded-lg border bg-background">
                      <div className="md:col-span-3 font-medium text-sm">{r.full_name}</div>
                      <div className="md:col-span-3">
                        <Select value={r.status} onValueChange={(v) => updateAttendanceRow(r.student_id, { status: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">حاضر</SelectItem>
                            <SelectItem value="absent">غائب</SelectItem>
                            <SelectItem value="late">متأخر</SelectItem>
                            <SelectItem value="late_excused">متأخر بإذن</SelectItem>
                            <SelectItem value="excused">مستأذن</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-3">
                        <Select value={r.homework_status} onValueChange={(v) => updateAttendanceRow(r.student_id, { homework_status: v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="حالة الواجب" /></SelectTrigger>
                          <SelectContent>
                            {homeworkStatusOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-3">
                        <Input className="h-9" placeholder="ملاحظة" value={r.notes} onChange={(e) => updateAttendanceRow(r.student_id, { notes: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={saveAttendance} disabled={manageSaving || attendanceRows.length === 0} className="w-full">حفظ الحضور</Button>
            </TabsContent>

            {/* تبويب الواجب */}
            <TabsContent value="homework" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>وصف الواجب المنزلي</Label>
                <Textarea rows={4} value={homeworkForm.homework} onChange={(e) => setHomeworkForm({ ...homeworkForm, homework: e.target.value })} placeholder="مثال: حفظ من آية 1 إلى آية 10 من سورة البقرة..." />
              </div>
              <div className="space-y-2">
                <Label>تاريخ التسليم المتوقع</Label>
                <DualDatePicker value={homeworkForm.homework_due_date} onChange={(v) => setHomeworkForm({ ...homeworkForm, homework_due_date: v })} />
              </div>
              <Button onClick={saveHomework} disabled={manageSaving} className="w-full">حفظ الواجب</Button>
            </TabsContent>

            {/* تبويب البرنامج التربوي */}
            <TabsContent value="education" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>عنوان البرنامج</Label>
                <Input value={eduForm.educational_program_title} onChange={(e) => setEduForm({ ...eduForm, educational_program_title: e.target.value })} placeholder="مثال: حديث / خلق / فائدة..." />
              </div>
              <div className="space-y-2">
                <Label>التفاصيل</Label>
                <Textarea rows={6} value={eduForm.educational_program_details} onChange={(e) => setEduForm({ ...eduForm, educational_program_details: e.target.value })} placeholder="نص الحديث أو الفائدة أو الخلق المراد ترسيخه..." />
              </div>
              <Button onClick={saveEduProgram} disabled={manageSaving} className="w-full">حفظ البرنامج التربوي</Button>
            </TabsContent>

            {/* تبويب برنامج الحلقة */}
            <TabsContent value="program" className="space-y-3 pt-4">
              {!hpAssignment ? (
                <p className="text-sm text-muted-foreground text-center py-8">لا يوجد برنامج تلقين مُسنَد لهذه الحلقة بعد.</p>
              ) : (
                <>
                  {(() => {
                    const allLessons = Object.values(hpLessonsByChapter).flat();
                    const total = allLessons.length;
                    const done = allLessons.filter((l: any) => hpProgress[l.id]?.status === "completed").length;
                    const pct = total ? Math.round((done / total) * 100) : 0;
                    return (
                      <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">{hpAssignment.talqeen_curricula?.name}</span>
                          <Badge variant="outline">{done} / {total}</Badge>
                        </div>
                        <Progress value={pct} />
                      </div>
                    );
                  })()}

                  <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                    {hpChapters.map((ch) => (
                      <div key={ch.id} className="border rounded">
                        <div className="px-3 py-2 bg-muted/40 text-sm font-medium flex items-center gap-2">
                          <Badge variant="outline">باب {ch.chapter_number}</Badge>
                          {ch.title}
                        </div>
                        <div className="divide-y">
                          {(hpLessonsByChapter[ch.id] || []).length === 0 && (
                            <p className="text-xs text-muted-foreground p-2">لا توجد دروس</p>
                          )}
                          {(hpLessonsByChapter[ch.id] || []).map((l: any) => {
                            const done = hpProgress[l.id]?.status === "completed";
                            return (
                              <div key={l.id} className="flex items-center gap-2 p-2 text-sm">
                                <Checkbox checked={done} onCheckedChange={(v) => toggleLessonProgress(l, !!v)} />
                                {lessonTypeIcon(l.lesson_type)}
                                <span className="flex-1">{l.lesson_number}. {l.title}</span>
                                <Badge variant="outline" className="text-[10px]">{lessonTypeLabel(l.lesson_type)}</Badge>
                                <Button size="sm" variant="ghost" onClick={() => setHpViewerLesson(l)}>
                                  <Eye className="w-3 h-3 ml-1" />عرض
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* عرض منهج التلقين الخاص بالحلقة */}
      <Dialog open={!!curriculumViewHalaqaId} onOpenChange={(o) => { if (!o) { setCurriculumViewHalaqaId(null); setCurriculumWeeks([]); setCurriculumDays([]); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              منهج التلقين — {(() => {
                const h = halaqat.find((x) => x.id === curriculumViewHalaqaId);
                const c = curricula.find((cc) => cc.id === h?.talqeen_curriculum_id);
                return c?.name || "—";
              })()}
            </DialogTitle>
          </DialogHeader>
          {curriculumWeeks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد أسابيع مسجلة لهذا المنهج بعد.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                إجمالي الأسابيع: {curriculumWeeks.length} • طلاب الحلقة مرتبطون تلقائياً بهذا المنهج
              </p>
              {curriculumWeeks.map((w) => {
                const days = curriculumDays.filter((d) => d.week_id === w.id);
                return (
                  <div key={w.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-primary/10 px-4 py-2 border-b">
                      <div className="font-semibold text-sm">الأسبوع {w.week_number}{w.title ? ` — ${w.title}` : ""}</div>
                      {w.lesson_topic && <div className="text-xs text-muted-foreground mt-0.5">{w.lesson_topic}</div>}
                    </div>
                    {days.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">لا توجد أيام</p>
                    ) : (
                      <div className="divide-y">
                        {days.map((d) => (
                          <div key={d.id} className="p-3 text-xs space-y-1">
                            <div className="font-medium text-sm text-primary">{d.day_name}</div>
                            {d.lesson && <div><span className="font-semibold">الدرس:</span> {d.lesson}</div>}
                            {d.quran_homework && <div><span className="font-semibold">الواجب القرآني:</span> {d.quran_homework}</div>}
                            {d.written_homework && <div><span className="font-semibold">الواجب الكتابي:</span> {d.written_homework}</div>}
                            {d.educational && <div><span className="font-semibold">البرنامج التربوي:</span> {d.educational}</div>}
                            {d.reading_in_class && <div><span className="font-semibold">قراءة في الفصل:</span> {d.reading_in_class}</div>}
                            {d.reading_at_home && <div><span className="font-semibold">قراءة في البيت:</span> {d.reading_at_home}</div>}
                            {d.notes && <div className="text-muted-foreground">ملاحظات: {d.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ContentViewer lesson={hpViewerLesson} open={!!hpViewerLesson} onOpenChange={(o) => { if (!o) setHpViewerLesson(null); }} />
    </div>
  );
};

export default TalqeenHalaqat;
