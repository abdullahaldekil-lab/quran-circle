import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, BookOpen } from "lucide-react";

type AttStatus = "present" | "absent" | "late";

interface Props {
  open: boolean;
  onClose: () => void;
  halaqaId: string;
  halaqaName: string;
  students: Array<{ id: string; full_name: string }>;
}

export default function DayRecordingDialog({ open, onClose, halaqaId, halaqaName, students }: Props) {
  const [todayLesson, setTodayLesson] = useState<any | null>(null);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({});
  const [lessonDone, setLessonDone] = useState(false);
  const [tarbiaNote, setTarbiaNote] = useState("");
  const [tarbiaDone, setTarbiaDone] = useState(false);
  const [homework, setHomework] = useState("");
  const [homeworkDue, setHomeworkDue] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setAttendance({});
    setLessonDone(false);
    setTarbiaNote("");
    setTarbiaDone(false);
    setHomework("");
    setHomeworkDue("");
  }, [open]);

  // Fetch today's lesson based on completed lessons count
  useEffect(() => {
    if (!open || !halaqaId) return;
    (async () => {
      // Get the active program assignment for this halaqa
      const { data: asg } = await (supabase as any)
        .from("talqeen_program_assignments")
        .select("id, curriculum_id")
        .eq("halaqa_id", halaqaId)
        .eq("is_active", true)
        .maybeSingle();

      if (!asg) {
        setAssignment(null);
        setTodayLesson(null);
        return;
      }
      setAssignment(asg);

      // Get all lessons for this curriculum (via chapters), ordered
      const { data: chapters } = await (supabase as any)
        .from("talqeen_chapters")
        .select("id, sort_order, chapter_number")
        .eq("curriculum_id", asg.curriculum_id)
        .order("sort_order", { ascending: true });

      const chapterIds = (chapters || []).map((c: any) => c.id);
      if (chapterIds.length === 0) {
        setTodayLesson(null);
        return;
      }

      const { data: lessons } = await (supabase as any)
        .from("talqeen_lessons")
        .select("id, title, lesson_number, chapter_id")
        .in("chapter_id", chapterIds)
        .order("lesson_number", { ascending: true });

      // Get progress (completed lessons)
      const { data: progress } = await (supabase as any)
        .from("talqeen_program_progress")
        .select("lesson_id, status")
        .eq("assignment_id", asg.id)
        .eq("status", "completed");

      const completedIds = new Set((progress || []).map((p: any) => p.lesson_id));
      const next = (lessons || []).find((l: any) => !completedIds.has(l.id));
      setTodayLesson(next || null);
    })();
  }, [open, halaqaId]);

  const cycleAttendance = (studentId: string) => {
    setAttendance((prev) => {
      const cur = prev[studentId];
      const next: AttStatus = cur === "present" ? "absent" : cur === "absent" ? "late" : "present";
      return { ...prev, [studentId]: next };
    });
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (Object.keys(attendance).length === 0) missing.push("الحضور");
    if (!lessonDone) missing.push("تنفيذ الدرس");
    if (!tarbiaNote.trim()) missing.push("التنفيذ التربوي");
    if (!homework.trim()) missing.push("الواجب المنزلي");
    if (missing.length > 0) {
      toast.error(`يرجى إكمال: ${missing.join("، ")}`);
      return;
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: created, error } = await (supabase as any)
        .from("talqeen_sessions")
        .insert({
          halaqa_id: halaqaId,
          session_date: today,
          surah: todayLesson?.title || "",
          status: "completed",
          executed: true,
          executed_at: new Date().toISOString(),
          educational_program_title: tarbiaNote,
          educational_program_details: tarbiaDone ? "تم التنفيذ" : "لم يكتمل",
          homework,
          homework_due_date: homeworkDue || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const sessionId = created.id;

      // Save attendance
      const attRows = Object.entries(attendance).map(([sid, status]) => ({
        session_id: sessionId,
        student_id: sid,
        status,
      }));
      if (attRows.length > 0) {
        const { error: attErr } = await (supabase as any)
          .from("talqeen_session_attendance")
          .insert(attRows);
        if (attErr) throw attErr;
      }

      // Mark today's lesson as completed in program progress
      if (todayLesson && assignment) {
        await (supabase as any).from("talqeen_program_progress").upsert(
          {
            assignment_id: assignment.id,
            halaqa_id: halaqaId,
            lesson_id: todayLesson.id,
            status: "completed",
            completed_at: new Date().toISOString(),
          },
          { onConflict: "assignment_id,lesson_id" }
        );
      }

      toast.success("✅ تم حفظ يوم الحلقة بنجاح");
      onClose();
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const attBtn = (sid: string, status: AttStatus, color: string, Icon: any, label: string) => {
    const active = attendance[sid] === status;
    return (
      <Button
        size="sm"
        variant={active ? "default" : "outline"}
        className={active ? color : ""}
        onClick={() => setAttendance((p) => ({ ...p, [sid]: status }))}
      >
        <Icon className="w-3.5 h-3.5 ml-1" />
        {label}
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل يوم الحلقة — {halaqaName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* القسم 1: الحضور */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">١. الحضور ({students.length} طالب)</h3>
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
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا يوجد طلاب</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded border">
                      <span className="text-sm font-medium">{s.full_name}</span>
                      <div className="flex gap-1.5">
                        {attBtn(s.id, "present", "bg-green-600 hover:bg-green-700 text-white", CheckCircle2, "حاضر")}
                        {attBtn(s.id, "absent", "bg-red-600 hover:bg-red-700 text-white", XCircle, "غائب")}
                        {attBtn(s.id, "late", "bg-yellow-600 hover:bg-yellow-700 text-white", Clock, "متأخر")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* القسم 2: تنفيذ الدرس */}
          <div className="rounded-lg border p-4 bg-blue-50">
            <p className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              ٢. درس اليوم
            </p>
            <p className="text-base text-blue-800">{todayLesson?.title || "لا يوجد درس محدد"}</p>
            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                id="lesson-done"
                checked={lessonDone}
                onCheckedChange={(v) => setLessonDone(v === true)}
              />
              <label htmlFor="lesson-done" className="text-sm cursor-pointer">
                تم تنفيذ الدرس
              </label>
            </div>
          </div>

          {/* القسم 3: التنفيذ التربوي */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold text-foreground">٣. التنفيذ التربوي</h3>
              <Textarea
                placeholder="وصف الجانب التربوي المنفّذ اليوم..."
                value={tarbiaNote}
                onChange={(e) => setTarbiaNote(e.target.value)}
                rows={2}
              />
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id="tarbia-done"
                  checked={tarbiaDone}
                  onCheckedChange={(v) => setTarbiaDone(v === true)}
                />
                <label htmlFor="tarbia-done" className="text-sm cursor-pointer">
                  تم تنفيذ الجانب التربوي
                </label>
              </div>
            </CardContent>
          </Card>

          {/* القسم 4: الواجب المنزلي */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold text-foreground">٤. الواجب المنزلي</h3>
              <Input
                placeholder="وصف الواجب المنزلي"
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">تاريخ التسليم</Label>
                <Input
                  type="date"
                  value={homeworkDue}
                  onChange={(e) => setHomeworkDue(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary">
              {saving ? "جارٍ الحفظ..." : "حفظ يوم الحلقة"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
