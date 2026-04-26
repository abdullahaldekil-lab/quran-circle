import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2,
  Users,
  ClipboardCheck,
  Sparkles,
  BookOpen,
  Loader2,
} from "lucide-react";

interface Props {
  open: boolean;
  sessionId: string | null;
  halaqaId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const ATTEND_STATUS = [
  { value: "present", label: "حاضر", cls: "bg-green-100 text-green-700" },
  { value: "absent", label: "غائب", cls: "bg-red-100 text-red-700" },
  { value: "late", label: "متأخر", cls: "bg-amber-100 text-amber-700" },
  { value: "excused", label: "مستأذن", cls: "bg-blue-100 text-blue-700" },
];

const HW_STATUS = [
  { value: "not_submitted", label: "لم يُسلَّم", cls: "bg-muted text-muted-foreground" },
  { value: "submitted", label: "مُسلَّم", cls: "bg-green-100 text-green-700" },
  { value: "late", label: "متأخر", cls: "bg-amber-100 text-amber-700" },
];

export default function TalqeenSessionDetailDialog({
  open,
  sessionId,
  halaqaId,
  onClose,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, { status: string; homework_status: string; notes: string; id?: string }>>({});

  // execution
  const [executed, setExecuted] = useState(false);
  const [executionNotes, setExecutionNotes] = useState("");
  // homework
  const [homework, setHomework] = useState("");
  const [homeworkDueDate, setHomeworkDueDate] = useState("");
  // educational program
  const [eduTitle, setEduTitle] = useState("");
  const [eduDetails, setEduDetails] = useState("");

  useEffect(() => {
    if (open && sessionId && halaqaId) {
      loadAll();
    } else {
      setSession(null);
      setStudents([]);
      setAttendance({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId, halaqaId]);

  const loadAll = async () => {
    if (!sessionId || !halaqaId) return;
    setLoading(true);
    const [sessionRes, studentsRes, attendanceRes] = await Promise.all([
      supabase.from("talqeen_sessions").select("*").eq("id", sessionId).maybeSingle(),
      supabase.from("students").select("id, full_name").eq("halaqa_id", halaqaId).eq("status", "active").order("full_name"),
      supabase.from("talqeen_session_attendance").select("*").eq("session_id", sessionId),
    ]);

    if (sessionRes.data) {
      const s = sessionRes.data;
      setSession(s);
      setExecuted(!!s.executed);
      setExecutionNotes(s.execution_notes || "");
      setHomework(s.homework || "");
      setHomeworkDueDate(s.homework_due_date || "");
      setEduTitle(s.educational_program_title || "");
      setEduDetails(s.educational_program_details || "");
    }

    const studentList = studentsRes.data || [];
    setStudents(studentList);

    // build attendance map
    const map: Record<string, any> = {};
    studentList.forEach((st: any) => {
      map[st.id] = { status: "present", homework_status: "not_submitted", notes: "", id: undefined };
    });
    (attendanceRes.data || []).forEach((row: any) => {
      map[row.student_id] = {
        id: row.id,
        status: row.status || "present",
        homework_status: row.homework_status || "not_submitted",
        notes: row.notes || "",
      };
    });
    setAttendance(map);
    setLoading(false);
  };

  const updateAttendance = (studentId: string, field: string, value: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const setAllPresent = () => {
    const next: Record<string, any> = {};
    Object.entries(attendance).forEach(([sid, row]) => {
      next[sid] = { ...row, status: "present" };
    });
    setAttendance(next);
  };

  const saveExecution = async () => {
    if (!sessionId) return;
    setSaving(true);
    const { error } = await supabase
      .from("talqeen_sessions")
      .update({
        executed,
        executed_at: executed ? new Date().toISOString() : null,
        execution_notes: executionNotes || null,
        status: executed ? "completed" : session?.status || "pending",
      })
      .eq("id", sessionId);
    setSaving(false);
    if (error) { toast.error("تعذر حفظ التنفيذ"); return; }
    toast.success("تم حفظ بيانات التنفيذ");
    onUpdated?.();
    loadAll();
  };

  const saveHomework = async () => {
    if (!sessionId) return;
    setSaving(true);
    const { error } = await supabase
      .from("talqeen_sessions")
      .update({
        homework: homework || null,
        homework_due_date: homeworkDueDate || null,
      })
      .eq("id", sessionId);
    setSaving(false);
    if (error) { toast.error("تعذر حفظ الواجب"); return; }
    toast.success("تم حفظ الواجب المنزلي");
    onUpdated?.();
  };

  const saveEducationalProgram = async () => {
    if (!sessionId) return;
    setSaving(true);
    const { error } = await supabase
      .from("talqeen_sessions")
      .update({
        educational_program_title: eduTitle || null,
        educational_program_details: eduDetails || null,
      })
      .eq("id", sessionId);
    setSaving(false);
    if (error) { toast.error("تعذر حفظ البرنامج التربوي"); return; }
    toast.success("تم حفظ البرنامج التربوي");
    onUpdated?.();
  };

  const saveAttendance = async () => {
    if (!sessionId) return;
    setSaving(true);
    const rows = Object.entries(attendance).map(([student_id, row]) => ({
      session_id: sessionId,
      student_id,
      status: row.status,
      homework_status: row.homework_status,
      notes: row.notes || null,
    }));
    const { error } = await supabase
      .from("talqeen_session_attendance")
      .upsert(rows, { onConflict: "session_id,student_id" });
    setSaving(false);
    if (error) { toast.error("تعذر حفظ الحضور"); return; }
    toast.success(`تم حفظ حضور ${rows.length} طالباً`);
    onUpdated?.();
    loadAll();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <BookOpen className="w-5 h-5 text-primary" />
            جلسة التلقين
            {session && (
              <span className="text-sm font-normal text-muted-foreground">
                — {session.surah}
                {session.from_ayah ? ` (آية ${session.from_ayah}${session.to_ayah ? ` - ${session.to_ayah}` : ""})` : ""}
                {" • "}
                {session.session_date}
              </span>
            )}
            {executed && <Badge className="bg-green-100 text-green-700">منفّذة</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="execution" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="execution"><CheckCircle2 className="w-4 h-4 ml-1" /> التنفيذ</TabsTrigger>
              <TabsTrigger value="attendance"><Users className="w-4 h-4 ml-1" /> الحضور</TabsTrigger>
              <TabsTrigger value="homework"><ClipboardCheck className="w-4 h-4 ml-1" /> الواجب</TabsTrigger>
              <TabsTrigger value="education"><Sparkles className="w-4 h-4 ml-1" /> البرنامج التربوي</TabsTrigger>
            </TabsList>

            {/* التنفيذ */}
            <TabsContent value="execution" className="space-y-4 pt-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <input
                  id="executed-check"
                  type="checkbox"
                  className="w-5 h-5"
                  checked={executed}
                  onChange={(e) => setExecuted(e.target.checked)}
                />
                <Label htmlFor="executed-check" className="cursor-pointer flex-1">
                  تم تنفيذ هذه الجلسة
                  {session?.executed_at && (
                    <span className="text-xs text-muted-foreground block mt-1">
                      آخر تنفيذ: {new Date(session.executed_at).toLocaleString("ar-SA")}
                    </span>
                  )}
                </Label>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات التنفيذ</Label>
                <Textarea
                  rows={5}
                  value={executionNotes}
                  onChange={(e) => setExecutionNotes(e.target.value)}
                  placeholder="ما الذي تم إنجازه فعلياً؟ المعوقات؟ الملاحظات على الطلاب..."
                />
              </div>

              <Button onClick={saveExecution} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                حفظ بيانات التنفيذ
              </Button>
            </TabsContent>

            {/* الحضور */}
            <TabsContent value="attendance" className="space-y-3 pt-4">
              {students.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  لا يوجد طلاب مسجلون في هذه الحلقة
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {students.length} طالب — حدد حالة الحضور وحالة الواجب لكل طالب
                    </p>
                    <Button variant="outline" size="sm" onClick={setAllPresent}>
                      تحديد الكل حاضر
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {students.map((st) => {
                      const row = attendance[st.id] || { status: "present", homework_status: "not_submitted", notes: "" };
                      return (
                        <div key={st.id} className="border rounded-lg p-3 space-y-2 bg-background">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium text-sm">{st.full_name}</span>
                            <div className="flex gap-2 flex-wrap">
                              <Select value={row.status} onValueChange={(v) => updateAttendance(st.id, "status", v)}>
                                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ATTEND_STATUS.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={row.homework_status} onValueChange={(v) => updateAttendance(st.id, "homework_status", v)}>
                                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="الواجب" /></SelectTrigger>
                                <SelectContent>
                                  {HW_STATUS.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>واجب: {s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Input
                            className="h-8 text-xs"
                            placeholder="ملاحظات (اختياري)"
                            value={row.notes}
                            onChange={(e) => updateAttendance(st.id, "notes", e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <Button onClick={saveAttendance} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    حفظ الحضور والواجب
                  </Button>
                </>
              )}
            </TabsContent>

            {/* الواجب المنزلي */}
            <TabsContent value="homework" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>وصف الواجب المنزلي</Label>
                <Textarea
                  rows={5}
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder="مثال: حفظ الآيات من 1 إلى 10 مع تكرار 5 مرات"
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ التسليم المتوقع</Label>
                <Input
                  type="date"
                  value={homeworkDueDate}
                  onChange={(e) => setHomeworkDueDate(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                💡 يمكن متابعة حالة تسليم الواجب لكل طالب من تبويب "الحضور".
              </p>
              <Button onClick={saveHomework} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                حفظ الواجب المنزلي
              </Button>
            </TabsContent>

            {/* البرنامج التربوي */}
            <TabsContent value="education" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>عنوان البرنامج التربوي</Label>
                <Input
                  value={eduTitle}
                  onChange={(e) => setEduTitle(e.target.value)}
                  placeholder="مثال: حديث اليوم - أدب طلب العلم - فائدة..."
                />
              </div>
              <div className="space-y-2">
                <Label>تفاصيل البرنامج</Label>
                <Textarea
                  rows={6}
                  value={eduDetails}
                  onChange={(e) => setEduDetails(e.target.value)}
                  placeholder="نص الحديث، شرح الخلق، الفائدة المستنبطة، التوجيه..."
                />
              </div>
              <Button onClick={saveEducationalProgram} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                حفظ البرنامج التربوي
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
