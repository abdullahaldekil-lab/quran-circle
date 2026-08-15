import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronLeft, ClipboardCheck, Save, Users } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import {
  ATTENDANCE_LABELS, isRecordEntered, recordCommitment, shiftWeek, weekEnd, weekStart,
  type AttendanceValue,
} from "@/lib/tarbawi";

interface Student { id: string; full_name: string; halaqa_id: string | null }
interface Draft {
  session_attendance: string;
  reading_pages: string;
  reading_done: boolean;
  listening_minutes: string;
  listening_done: boolean;
  memorization_amount: string;
  memorization_done: boolean;
  notes: string;
}

const emptyDraft: Draft = {
  session_attendance: "", reading_pages: "", reading_done: false,
  listening_minutes: "", listening_done: false,
  memorization_amount: "", memorization_done: false, notes: "",
};

const toDraft = (r: any): Draft => ({
  session_attendance: r?.session_attendance || "",
  reading_pages: r?.reading_pages != null ? String(r.reading_pages) : "",
  reading_done: !!r?.reading_done,
  listening_minutes: r?.listening_minutes != null ? String(r.listening_minutes) : "",
  listening_done: !!r?.listening_done,
  memorization_amount: r?.memorization_amount || "",
  memorization_done: !!r?.memorization_done,
  notes: r?.notes || "",
});

export default function TarbawiFollowUp() {
  const { user } = useAuth();
  const { isManager, isSupervisor, role } = useRole();
  const isOversight = isManager || isSupervisor || role === "assistant_supervisor";

  const [week, setWeek] = useState(weekStart(new Date()));
  const [programs, setPrograms] = useState<any[]>([]);
  const [programId, setProgramId] = useState<string>("");
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [halaqaId, setHalaqaId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, any>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardRecords, setBoardRecords] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});

  /** Programs the user may record for: supervisors see all active ones, teachers only theirs. */
  const loadPrograms = useCallback(async () => {
    setLoading(true);
    const { data: progs } = await (supabase as any)
      .from("tarbawi_programs").select("*").neq("status", "draft").order("created_at", { ascending: false });
    const { data: linkRows } = await (supabase as any)
      .from("tarbawi_program_halaqat").select("program_id, halaqa_id");
    const { data: halaqatRows } = await supabase
      .from("halaqat").select("id, name, teacher_id, assistant_teacher_id").eq("active", true);

    const mine = (halaqatRows || []).filter(
      (h: any) => h.teacher_id === user?.id || h.assistant_teacher_id === user?.id,
    );
    const visibleHalaqaIds = isOversight ? (halaqatRows || []).map((h: any) => h.id) : mine.map((h: any) => h.id);
    const visibleProgramIds = new Set(
      (linkRows || []).filter((l: any) => visibleHalaqaIds.includes(l.halaqa_id)).map((l: any) => l.program_id),
    );
    const visiblePrograms = (progs || []).filter((p: any) => visibleProgramIds.has(p.id));
    setPrograms(visiblePrograms);
    setProgramId((prev) => prev || visiblePrograms[0]?.id || "");

    const teacherIds = [...new Set((halaqatRows || []).map((h: any) => h.teacher_id).filter(Boolean))] as string[];
    if (teacherIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
      setTeacherNames(Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name])));
    }

    (window as any).__tarbawiLinks = linkRows || [];
    (window as any).__tarbawiHalaqat = halaqatRows || [];
    setLoading(false);
  }, [user?.id, isOversight]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  // halaqat available for the selected program
  useEffect(() => {
    if (!programId) { setHalaqat([]); return; }
    const links: any[] = (window as any).__tarbawiLinks || [];
    const all: any[] = (window as any).__tarbawiHalaqat || [];
    const ids = links.filter((l) => l.program_id === programId).map((l) => l.halaqa_id);
    let list = all.filter((h) => ids.includes(h.id));
    if (!isOversight) list = list.filter((h) => h.teacher_id === user?.id || h.assistant_teacher_id === user?.id);
    setHalaqat(list);
    setHalaqaId((prev) => (list.some((h) => h.id === prev) ? prev : list[0]?.id || ""));
  }, [programId, isOversight, user?.id, programs]);

  // students + existing records for the selected halaqa/week
  const loadStudents = useCallback(async () => {
    if (!programId || !halaqaId) { setStudents([]); setRecords({}); return; }
    const { data: studs } = await supabase
      .from("students").select("id, full_name, halaqa_id")
      .eq("halaqa_id", halaqaId).eq("status", "active").order("full_name");
    const list = (studs || []) as Student[];
    setStudents(list);

    const { data: recs } = await (supabase as any)
      .from("tarbawi_weekly_records").select("*")
      .eq("program_id", programId).eq("week_start", week)
      .in("student_id", list.map((s) => s.id).length ? list.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"]);
    const map: Record<string, any> = {};
    (recs || []).forEach((r: any) => { map[r.student_id] = r; });
    setRecords(map);
    setDrafts(Object.fromEntries(list.map((s) => [s.id, toDraft(map[s.id])])));
  }, [programId, halaqaId, week]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // supervisor board: entry status of every halaqa in the program this week
  const loadBoard = useCallback(async () => {
    if (!isOversight || !programId) return;
    const { data } = await (supabase as any)
      .from("tarbawi_weekly_records").select("halaqa_id, student_id, session_attendance")
      .eq("program_id", programId).eq("week_start", week);
    setBoardRecords(data || []);
    const { data: studs } = await supabase.from("students").select("halaqa_id").eq("status", "active");
    const counts: Record<string, number> = {};
    (studs || []).forEach((s: any) => { if (s.halaqa_id) counts[s.halaqa_id] = (counts[s.halaqa_id] || 0) + 1; });
    setStudentCounts(counts);
  }, [isOversight, programId, week]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // realtime: keep the supervisor board and the open sheet in sync
  useEffect(() => {
    if (!programId) return;
    const channel = supabase
      .channel(`tarbawi-weekly-${programId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tarbawi_weekly_records", filter: `program_id=eq.${programId}` },
        () => { loadBoard(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [programId, loadBoard]);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || emptyDraft), ...patch } }));

  const saveStudent = async (student: Student) => {
    const d = drafts[student.id] || emptyDraft;
    if (!d.session_attendance) { toast.error("اختر حالة الحضور أولاً"); return; }
    const pages = d.reading_pages ? Number(d.reading_pages) : null;
    const minutes = d.listening_minutes ? Number(d.listening_minutes) : null;
    if (pages !== null && (pages < 0 || pages > 10)) { toast.error("عدد الصفحات من 1 إلى 10"); return; }
    if (minutes !== null && (minutes < 0 || minutes > 600)) { toast.error("عدد الدقائق غير منطقي"); return; }

    setSavingId(student.id);
    const payload = {
      program_id: programId,
      halaqa_id: halaqaId,
      student_id: student.id,
      week_start: week,
      session_attendance: d.session_attendance,
      reading_pages: pages,
      reading_done: d.reading_done,
      listening_minutes: minutes,
      listening_done: d.listening_done,
      memorization_amount: d.memorization_amount.trim().slice(0, 200) || null,
      memorization_done: d.memorization_done,
      notes: d.notes.trim().slice(0, 500) || null,
      recorded_by: user?.id ?? null,
    };
    const { error } = await (supabase as any)
      .from("tarbawi_weekly_records")
      .upsert(payload, { onConflict: "program_id,student_id,week_start" });
    setSavingId(null);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    toast.success(`تم حفظ متابعة ${student.full_name}`);
    loadStudents();
  };

  const markAllPresent = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      students.forEach((s) => { next[s.id] = { ...(next[s.id] || emptyDraft), session_attendance: "present" }; });
      return next;
    });
    toast.info("تم تحديد الكل حاضر — اضغط حفظ لكل طالب أو استخدم الحفظ الجماعي");
  };

  const saveAll = async () => {
    const ready = students.filter((s) => drafts[s.id]?.session_attendance);
    if (!ready.length) { toast.error("لا توجد بيانات جاهزة للحفظ"); return; }
    setSavingId("all");
    const rows = ready.map((s) => {
      const d = drafts[s.id];
      return {
        program_id: programId, halaqa_id: halaqaId, student_id: s.id, week_start: week,
        session_attendance: d.session_attendance,
        reading_pages: d.reading_pages ? Math.min(Number(d.reading_pages), 10) : null,
        reading_done: d.reading_done,
        listening_minutes: d.listening_minutes ? Math.min(Number(d.listening_minutes), 600) : null,
        listening_done: d.listening_done,
        memorization_amount: d.memorization_amount.trim().slice(0, 200) || null,
        memorization_done: d.memorization_done,
        notes: d.notes.trim().slice(0, 500) || null,
        recorded_by: user?.id ?? null,
      };
    });
    const { error } = await (supabase as any)
      .from("tarbawi_weekly_records").upsert(rows, { onConflict: "program_id,student_id,week_start" });
    setSavingId(null);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    toast.success(`تم حفظ ${rows.length} سجلاً`);
    loadStudents();
  };

  const enteredCount = useMemo(
    () => students.filter((s) => isRecordEntered(records[s.id])).length,
    [students, records],
  );

  const entryPanel = (
    <>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="min-w-40">
          <Label className="text-xs">البرنامج</Label>
          <Select value={programId} onValueChange={setProgramId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="اختر برنامجاً" /></SelectTrigger>
            <SelectContent>
              {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-40">
          <Label className="text-xs">الحلقة</Label>
          <Select value={halaqaId} onValueChange={setHalaqaId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="اختر حلقة" /></SelectTrigger>
            <SelectContent>
              {halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="الأسبوع السابق"
            onClick={() => setWeek(shiftWeek(week, -1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="text-center px-2">
            <p className="text-xs font-medium">{formatDateSmart(week)}</p>
            <p className="text-[10px] text-muted-foreground">إلى {formatDateSmart(weekEnd(week))}</p>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="الأسبوع التالي"
            onClick={() => setWeek(shiftWeek(week, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        <Badge variant="outline" className="h-9 flex items-center">
          {enteredCount}/{students.length} مُدخل
        </Badge>
      </div>

      {students.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <Button size="sm" variant="secondary" onClick={markAllPresent}>
            <Users className="w-3 h-3 ml-1" /> تحديد الكل حاضر
          </Button>
          <Button size="sm" onClick={saveAll} disabled={savingId === "all"}>
            <Save className="w-3 h-3 ml-1" /> {savingId === "all" ? "جارٍ الحفظ..." : "حفظ الجميع"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {students.map((s) => {
          const d = drafts[s.id] || emptyDraft;
          const saved = records[s.id];
          return (
            <div key={s.id} className={`rounded-2xl border-2 p-3 ${saved ? "border-green-200 bg-green-50/40" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-sm">{s.full_name}</p>
                {saved
                  ? <Badge className="bg-green-600 hover:bg-green-600 text-xs">مُسجَّل {recordCommitment(saved)}%</Badge>
                  : <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">لم يُسجَّل</Badge>}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {/* attendance */}
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-xs font-medium mb-1">حضور الجلسة الأسبوعية</p>
                  <div className="flex gap-1">
                    {(Object.keys(ATTENDANCE_LABELS) as AttendanceValue[]).map((v) => (
                      <Button key={v} size="sm" variant={d.session_attendance === v ? "default" : "outline"}
                        className="flex-1 h-8 text-xs"
                        onClick={() => setDraft(s.id, { session_attendance: v })}>
                        {ATTENDANCE_LABELS[v]}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* reading */}
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-xs font-medium mb-1">القراءة (عدد الصفحات)</p>
                  <div className="flex gap-1 items-center">
                    <Select value={d.reading_pages} onValueChange={(v) => setDraft(s.id, { reading_pages: v })}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="الصفحات" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant={d.reading_done ? "default" : "outline"} className="h-8 text-xs"
                      onClick={() => setDraft(s.id, { reading_done: !d.reading_done })}>
                      {d.reading_done ? "أتم" : "لم يتم"}
                    </Button>
                  </div>
                </div>

                {/* listening */}
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-xs font-medium mb-1">السماع (عدد الدقائق)</p>
                  <div className="flex gap-1 items-center">
                    <Input type="number" min={0} max={600} value={d.listening_minutes} placeholder="دقائق"
                      className="h-8 text-xs flex-1"
                      onChange={(e) => setDraft(s.id, { listening_minutes: e.target.value })} />
                    <Button size="sm" variant={d.listening_done ? "default" : "outline"} className="h-8 text-xs"
                      onClick={() => setDraft(s.id, { listening_done: !d.listening_done })}>
                      {d.listening_done ? "أتم" : "لم يتم"}
                    </Button>
                  </div>
                </div>

                {/* memorization */}
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-xs font-medium mb-1">الحفظ (المقدار)</p>
                  <div className="flex gap-1 items-center">
                    <Input value={d.memorization_amount} placeholder="المقدار" maxLength={200}
                      className="h-8 text-xs flex-1"
                      onChange={(e) => setDraft(s.id, { memorization_amount: e.target.value })} />
                    <Button size="sm" variant={d.memorization_done ? "default" : "outline"} className="h-8 text-xs"
                      onClick={() => setDraft(s.id, { memorization_done: !d.memorization_done })}>
                      {d.memorization_done ? "أتم" : "لم يتم"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <Input value={d.notes} placeholder="ملاحظة تربوية (اختياري)" maxLength={500}
                  className="h-8 text-xs" onChange={(e) => setDraft(s.id, { notes: e.target.value })} />
                <Button size="sm" className="h-8" disabled={savingId === s.id} onClick={() => saveStudent(s)}>
                  {savingId === s.id ? "..." : "حفظ"}
                </Button>
              </div>
            </div>
          );
        })}

        {!loading && students.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {programs.length === 0
              ? "لا توجد برامج تربوية مسندة لحلقتك بعد"
              : "لا يوجد طلاب في الحلقة المختارة"}
          </div>
        )}
      </div>
    </>
  );

  const board = (
    <div className="space-y-3">
      {halaqat.map((h) => {
        const recs = boardRecords.filter((r) => r.halaqa_id === h.id && r.session_attendance);
        const total = studentCounts[h.id] || 0;
        const pct = total ? Math.round((recs.length / total) * 100) : 0;
        const done = total > 0 && recs.length >= total;
        return (
          <div key={h.id} className={`rounded-2xl border-2 p-3 ${done ? "border-green-300 bg-green-50/50" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{h.name}</p>
                <p className="text-xs text-muted-foreground">{teacherNames[h.teacher_id] || "بدون معلم"}</p>
              </div>
              <Badge className={done ? "bg-green-600 hover:bg-green-600" : ""} variant={done ? "default" : "outline"}>
                {recs.length}/{total} ({pct}%)
              </Badge>
            </div>
            <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {halaqat.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">لا توجد حلقات مسندة لهذا البرنامج</p>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" /> متابعة البرامج التربوية
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          إدخال أسبوعي واحد لكل طالب: حضور الجلسة، القراءة، السماع، الحفظ.
        </p>
      </div>

      {isOversight ? (
        <Tabs defaultValue="entry">
          <TabsList className="mb-4">
            <TabsTrigger value="entry">إدخال المتابعة</TabsTrigger>
            <TabsTrigger value="board">حالة تنفيذ الحلقات</TabsTrigger>
          </TabsList>
          <TabsContent value="entry">{entryPanel}</TabsContent>
          <TabsContent value="board">{board}</TabsContent>
        </Tabs>
      ) : entryPanel}
    </div>
  );
}
