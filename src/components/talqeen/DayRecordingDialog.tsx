import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, BookOpen, Heart, ClipboardCheck } from "lucide-react";
import { formatDateHijriOnly } from "@/lib/hijri";

type AttStatus = "present" | "absent" | "late";
type HwStatus = "submitted" | "not_submitted";

interface Props {
  open: boolean;
  onClose: () => void;
  halaqaId: string;
  halaqaName: string;
  students: Array<{ id: string; full_name: string }>;
  /** Managers/supervisors may open and correct earlier days; teachers stay on today. */
  canEditPastDays?: boolean;
}

export default function DayRecordingDialog({
  open,
  onClose,
  halaqaId,
  halaqaName,
  students,
  canEditPastDays = false,
}: Props) {
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];
  const [today, setToday] = useState(todayStr);
  const dateHijri = formatDateHijriOnly(today);

  // Reopening the dialog always starts on today, so a correction made to an earlier
  // day never becomes the default target for the next recording.
  useEffect(() => {
    if (open) setToday(todayStr);
  }, [open, todayStr]);

  const [todaySession, setTodaySession] = useState<any | null>(null);
  const [todayLesson, setTodayLesson] = useState<any | null>(null);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [syncedFromMain, setSyncedFromMain] = useState(false);

  const [showAttendanceSheet, setShowAttendanceSheet] = useState(false);
  const [showHomeworkSheet, setShowHomeworkSheet] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({});
  const [homeworkStatus, setHomeworkStatus] = useState<Record<string, HwStatus>>({});
  const [savingAtt, setSavingAtt] = useState(false);
  const [savingHw, setSavingHw] = useState(false);

  const refetchTodaySession = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("talqeen_sessions")
      .select("*")
      .eq("halaqa_id", halaqaId)
      .eq("session_date", today)
      .maybeSingle();
    setTodaySession(data || null);

    if (data?.id) {
      const { data: atts } = await (supabase as any)
        .from("talqeen_session_attendance")
        .select("student_id, status, homework_status")
        .eq("session_id", data.id);
      const attMap: Record<string, AttStatus> = {};
      const hwMap: Record<string, HwStatus> = {};
      (atts || []).forEach((a: any) => {
        attMap[a.student_id] = a.status;
        if (a.homework_status === "submitted" || a.homework_status === "not_submitted") {
          hwMap[a.student_id] = a.homework_status;
        }
      });
      setAttendance(attMap);
      setHomeworkStatus(hwMap);

      // Check if attendance was synced from the main attendance system
      if (data.attendance_done) {
        const { data: mainAtt } = await (supabase as any)
          .from("attendance")
          .select("id")
          .eq("halaqa_id", halaqaId)
          .eq("attendance_date", today)
          .limit(1);
        setSyncedFromMain((mainAtt?.length ?? 0) > 0);
      } else {
        setSyncedFromMain(false);
      }
    } else {
      setAttendance({});
      setHomeworkStatus({});
      setSyncedFromMain(false);
    }
  }, [halaqaId, today]);

  useEffect(() => {
    if (!open || !halaqaId) return;
    refetchTodaySession();
  }, [open, halaqaId, refetchTodaySession]);

  // Today's lesson based on progress
  useEffect(() => {
    if (!open || !halaqaId) return;
    (async () => {
      const { data: asg } = await (supabase as any)
        .from("talqeen_program_assignments")
        .select("id, curriculum_id")
        .eq("halaqa_id", halaqaId)
        .eq("is_active", true)
        .maybeSingle();
      if (!asg) { setAssignment(null); setTodayLesson(null); return; }
      setAssignment(asg);

      const { data: chapters } = await (supabase as any)
        .from("talqeen_chapters")
        .select("id")
        .eq("curriculum_id", asg.curriculum_id)
        .order("sort_order", { ascending: true });
      const chapterIds = (chapters || []).map((c: any) => c.id);
      if (chapterIds.length === 0) { setTodayLesson(null); return; }

      const { data: lessons } = await (supabase as any)
        .from("talqeen_lessons")
        .select("id, title, lesson_number, chapter_id")
        .in("chapter_id", chapterIds)
        .order("lesson_number", { ascending: true });

      const { data: progress } = await (supabase as any)
        .from("talqeen_program_progress")
        .select("lesson_id, status")
        .eq("assignment_id", asg.id)
        .eq("status", "completed");
      const completed = new Set((progress || []).map((p: any) => p.lesson_id));
      setTodayLesson((lessons || []).find((l: any) => !completed.has(l.id)) || null);
    })();
  }, [open, halaqaId]);

  const ensureSession = async (extra: Record<string, any> = {}) => {
    if (todaySession?.id) return todaySession;
    const { data, error } = await (supabase as any)
      .from("talqeen_sessions")
      .insert({
        halaqa_id: halaqaId,
        session_date: today,
        teacher_id: user?.id || null,
        surah: todayLesson?.title || "",
        status: "scheduled",
        executed: false,
        ...extra,
      })
      .select("*")
      .single();
    if (error) throw error;
    setTodaySession(data);
    return data;
  };

  const markDone = async (type: "lesson" | "tarbia") => {
    try {
      const now = new Date().toISOString();
      const currentDone = type === "lesson" ? !!todaySession?.lesson_done : !!todaySession?.tarbia_done;
      const newVal = !currentDone;
      const updates = type === "lesson"
        ? { lesson_done: newVal, lesson_done_at: newVal ? now : null }
        : { tarbia_done: newVal, tarbia_done_at: newVal ? now : null };
      if (todaySession?.id) {
        const { error } = await (supabase as any)
          .from("talqeen_sessions")
          .update(updates)
          .eq("id", todaySession.id);
        if (error) throw error;
      } else {
        await ensureSession(updates);
      }

      // If lesson marked done, also advance curriculum progress
      if (type === "lesson" && todayLesson && assignment) {
        const { data: existing } = await (supabase as any)
          .from("talqeen_program_progress")
          .select("id")
          .eq("assignment_id", assignment.id)
          .eq("lesson_id", todayLesson.id)
          .maybeSingle();
        if (existing) {
          await (supabase as any)
            .from("talqeen_program_progress")
            .update({ status: "completed", completed_at: now })
            .eq("id", existing.id);
        } else {
          await (supabase as any).from("talqeen_program_progress").insert({
            assignment_id: assignment.id,
            halaqa_id: halaqaId,
            lesson_id: todayLesson.id,
            status: "completed",
            completed_at: now,
          });
        }
      }

      toast.success(type === "lesson" ? "تم تأكيد شرح الدرس" : "تم تأكيد التنفيذ التربوي");
      await refetchTodaySession();
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    }
  };

  const saveAttendance = async () => {
    if (Object.keys(attendance).length === 0) {
      toast.error("لم يتم تحديد حضور لأي طالب");
      return;
    }
    setSavingAtt(true);
    try {
      const session = await ensureSession();
      const rows = Object.entries(attendance).map(([sid, status]) => ({
        session_id: session.id,
        student_id: sid,
        status,
        homework_status: homeworkStatus[sid] || "not_submitted",
      }));
      const { error } = await (supabase as any)
        .from("talqeen_session_attendance")
        .upsert(rows, { onConflict: "session_id,student_id" });
      if (error) throw error;

      await (supabase as any)
        .from("talqeen_sessions")
        .update({ attendance_done: true, attendance_done_at: new Date().toISOString() })
        .eq("id", session.id);

      toast.success("✅ تم حفظ الحضور");
      setShowAttendanceSheet(false);
      await refetchTodaySession();
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    } finally {
      setSavingAtt(false);
    }
  };

  /** Undo a confirmation so the day can be re-recorded. Answers of individual
   *  students are kept — only the "done" flag is cleared. */
  const unconfirm = async (what: "attendance" | "homework") => {
    if (!todaySession?.id) return;
    const updates = what === "attendance"
      ? { attendance_done: false, attendance_done_at: null }
      : { homework_checked: false, homework_checked_at: null };
    const { error } = await supabase
      .from("talqeen_sessions")
      .update(updates)
      .eq("id", todaySession.id);
    if (error) {
      toast.error(`خطأ: ${error.message}`);
      return;
    }
    toast.success("تم إلغاء التأكيد — يمكنك التعديل الآن");
    if (what === "attendance") setShowAttendanceSheet(false);
    else setShowHomeworkSheet(false);
    await refetchTodaySession();
  };

  const saveHomework = async () => {
    if (Object.keys(homeworkStatus).length === 0) {
      toast.error("لم يتم تحديد حالة لأي طالب");
      return;
    }
    setSavingHw(true);
    try {
      const session = await ensureSession();
      // `attendance` mirrors what is stored for this session, so reusing it here keeps
      // the recorded status intact. "present" is only ever used for a student who has
      // no row yet — in that case there is nothing to overwrite.
      const rows = Object.entries(homeworkStatus).map(([sid, hw]) => ({
        session_id: session.id,
        student_id: sid,
        status: attendance[sid] ?? "present",
        homework_status: hw,
      }));
      const { error } = await (supabase as any)
        .from("talqeen_session_attendance")
        .upsert(rows, { onConflict: "session_id,student_id" });
      if (error) throw error;

      await (supabase as any)
        .from("talqeen_sessions")
        .update({ homework_checked: true, homework_checked_at: new Date().toISOString() })
        .eq("id", session.id);

      toast.success("✅ تم حفظ الواجبات");
      setShowHomeworkSheet(false);
      await refetchTodaySession();
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    } finally {
      setSavingHw(false);
    }
  };

  const allDone =
    todaySession?.attendance_done &&
    todaySession?.lesson_done &&
    todaySession?.tarbia_done &&
    todaySession?.homework_checked;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="sr-only">تسجيل يوم الحلقة</DialogTitle>
          </DialogHeader>

          {/* اليوم والحلقة */}
          <div className="text-center mb-2">
            {dateHijri && (
              <p className="text-xs text-muted-foreground">
                {dateHijri}
              </p>
            )}
            <h2 className="text-lg font-bold text-foreground">{halaqaName}</h2>
            {canEditPastDays && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <input
                  type="date"
                  value={today}
                  max={todayStr}
                  onChange={(e) => setToday(e.target.value || todayStr)}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  aria-label="تاريخ التسجيل"
                />
                {today !== todayStr && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setToday(todayStr)}>
                    اليوم
                  </Button>
                )}
              </div>
            )}
            {today !== todayStr && (
              <p className="mt-1 text-[11px] text-amber-600">تعديل يوم سابق</p>
            )}
          </div>

          {/* 4 بطاقات */}
          <div className="grid grid-cols-2 gap-3">
            {/* الحضور */}
            <button
              onClick={() => setShowAttendanceSheet(true)}
              className={`rounded-2xl p-4 border-2 text-right transition-all ${
                todaySession?.attendance_done
                  ? "bg-green-50 border-green-400"
                  : "bg-card border-border hover:border-green-300"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">{todaySession?.attendance_done ? "✅" : "⭕"}</span>
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-bold text-sm text-foreground">الحضور</p>
              <p className="text-xs text-muted-foreground mt-1">
                {todaySession?.attendance_done ? "تم التسجيل — اضغط للتعديل" : "اضغط للتسجيل"}
              </p>
              {syncedFromMain && (
                <p className="text-[10px] text-blue-600 mt-1">مزامن من صفحة الحضور ✓</p>
              )}
            </button>

            {/* شرح الدرس */}
            <button
              onClick={() => markDone("lesson")}
              className={`rounded-2xl p-4 border-2 text-right transition-all ${
                todaySession?.lesson_done
                  ? "bg-green-50 border-green-400"
                  : "bg-card border-border hover:border-blue-300"
              }`}
              title={todaySession?.lesson_done ? "اضغط للتراجع" : "اضغط عند الإتمام"}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">{todaySession?.lesson_done ? "✅" : "⭕"}</span>
                <BookOpen className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-bold text-sm text-foreground">شرح الدرس</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {todayLesson?.title || "اضغط عند الإتمام"}
              </p>
              {todaySession?.lesson_done && (
                <p className="text-[10px] text-amber-600 mt-1">اضغط للتراجع</p>
              )}
            </button>

            {/* التربوي */}
            <button
              onClick={() => markDone("tarbia")}
              className={`rounded-2xl p-4 border-2 text-right transition-all ${
                todaySession?.tarbia_done
                  ? "bg-green-50 border-green-400"
                  : "bg-card border-border hover:border-purple-300"
              }`}
              title={todaySession?.tarbia_done ? "اضغط للتراجع" : "اضغط عند الإتمام"}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">{todaySession?.tarbia_done ? "✅" : "⭕"}</span>
                <Heart className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-bold text-sm text-foreground">التربوي</p>
              <p className="text-xs text-muted-foreground mt-1">
                {todaySession?.tarbia_done ? "تم الإتمام" : "اضغط عند الإتمام"}
              </p>
              {todaySession?.tarbia_done && (
                <p className="text-[10px] text-amber-600 mt-1">اضغط للتراجع</p>
              )}
            </button>

            {/* الواجبات */}
            <button
              onClick={() => setShowHomeworkSheet(true)}
              className={`rounded-2xl p-4 border-2 text-right transition-all ${
                todaySession?.homework_checked
                  ? "bg-green-50 border-green-400"
                  : "bg-card border-border hover:border-amber-300"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">{todaySession?.homework_checked ? "✅" : "⭕"}</span>
                <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-bold text-sm text-foreground">الواجبات</p>
              <p className="text-xs text-muted-foreground mt-1">
                {todaySession?.homework_checked ? "تم المراجعة — اضغط للتعديل" : "اضغط للتسجيل"}
              </p>
            </button>
          </div>

          {allDone && (
            <div className="mt-3 text-center text-sm text-green-700 bg-green-50 rounded-lg py-2 border border-green-200">
              ✨ اكتمل تنفيذ يوم الحلقة
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>إغلاق</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet الحضور */}
      <Sheet open={showAttendanceSheet} onOpenChange={setShowAttendanceSheet}>
        <SheetContent side="bottom" className="h-[75vh] flex flex-col" dir="rtl">
          <SheetHeader>
            <SheetTitle>تسجيل الحضور — {halaqaName}</SheetTitle>
          </SheetHeader>
          <div className="flex justify-between gap-2 mt-2">
            {todaySession?.attendance_done ? (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => unconfirm("attendance")}>
                إلغاء التأكيد
              </Button>
            ) : <span />}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const all: Record<string, AttStatus> = {};
                students.forEach((s) => (all[s.id] = "present"));
                setAttendance(all);
              }}
            >
              تحديد الكل حاضر
            </Button>
          </div>
          <div className="space-y-2 mt-3 overflow-y-auto flex-1">
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا يوجد طلاب</p>
            ) : (
              students.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border">
                  <span className="font-medium text-sm">{s.full_name}</span>
                  <div className="flex gap-2">
                    {(["present", "late", "absent"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setAttendance((a) => ({ ...a, [s.id]: status }))}
                        className={`w-9 h-9 rounded-full text-lg transition-all ${
                          attendance[s.id] === status ? "scale-110 shadow-md" : "opacity-40"
                        }`}
                        aria-label={status}
                      >
                        {status === "present" ? "✅" : status === "late" ? "⏰" : "❌"}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <Button className="w-full mt-4" onClick={saveAttendance} disabled={savingAtt}>
            {savingAtt ? "جارٍ الحفظ..." : "حفظ الحضور"}
          </Button>
        </SheetContent>
      </Sheet>

      {/* Sheet الواجبات */}
      <Sheet open={showHomeworkSheet} onOpenChange={setShowHomeworkSheet}>
        <SheetContent side="bottom" className="h-[75vh] flex flex-col" dir="rtl">
          <SheetHeader>
            <SheetTitle>مراجعة الواجبات — {halaqaName}</SheetTitle>
          </SheetHeader>
          {todaySession?.homework_checked && (
            <div className="flex justify-start mt-2">
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => unconfirm("homework")}>
                إلغاء التأكيد
              </Button>
            </div>
          )}
          <div className="space-y-2 mt-3 overflow-y-auto flex-1">
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا يوجد طلاب</p>
            ) : (
              students.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border">
                  <span className="font-medium text-sm">{s.full_name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHomeworkStatus((h) => ({ ...h, [s.id]: "submitted" }))}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        homeworkStatus[s.id] === "submitted"
                          ? "bg-green-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      ✅ أتم
                    </button>
                    <button
                      onClick={() => setHomeworkStatus((h) => ({ ...h, [s.id]: "not_submitted" }))}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        homeworkStatus[s.id] === "not_submitted"
                          ? "bg-red-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      ❌ لم يُتم
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button className="w-full mt-4" onClick={saveHomework} disabled={savingHw}>
            {savingHw ? "جارٍ الحفظ..." : "حفظ الواجبات"}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
