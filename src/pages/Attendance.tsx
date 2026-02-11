import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckSquare, X, Clock, AlertCircle, Check, Sun, CalendarOff } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useAuth } from "@/hooks/useAuth";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
type WindowStatus = "not_open" | "on_time" | "late" | "closed";

const Attendance = () => {
  const { user } = useAuth();
  const { filterHalaqat, loading: accessLoading } = useTeacherHalaqat();
  const calendar = useAcademicCalendar();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [asrTime, setAsrTime] = useState<string | null>(null);
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [windowStatus, setWindowStatus] = useState<WindowStatus>("not_open");
  const [countdown, setCountdown] = useState("");
  const [now, setNow] = useState(new Date());

  const OFFSET_START = 30;
  const OFFSET_LATE = 45;
  const SESSION_DURATION = 120;

  const fetchPrayerTimes = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("prayer-times");
      if (error) throw error;
      setAsrTime(data?.asr || null);
      setHijriDate(data?.hijri_date || null);
    } catch {
      console.error("Failed to fetch prayer times");
    }
  }, []);

  useEffect(() => {
    if (calendar.status === "active") fetchPrayerTimes();
  }, [calendar.status, fetchPrayerTimes]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!asrTime || calendar.status !== "active") return;
    const [h, m] = asrTime.split(":").map(Number);
    const startTime = new Date(); startTime.setHours(h, m + OFFSET_START, 0, 0);
    const lateTime = new Date(); lateTime.setHours(h, m + OFFSET_LATE, 0, 0);
    const endMs = startTime.getTime() + SESSION_DURATION * 60 * 1000;
    const nowMs = now.getTime();

    if (nowMs < startTime.getTime()) {
      setWindowStatus("not_open");
      setCountdown(formatCountdown(startTime.getTime() - nowMs));
    } else if (nowMs < lateTime.getTime()) {
      setWindowStatus("on_time");
      setCountdown(formatCountdown(lateTime.getTime() - nowMs));
    } else if (nowMs < endMs) {
      setWindowStatus("late");
      setCountdown(formatCountdown(endMs - nowMs));
    } else {
      setWindowStatus("closed");
      setCountdown("");
    }
  }, [now, asrTime, calendar.status]);

  const formatCountdown = (ms: number) => {
    const t = Math.floor(ms / 1000);
    const hrs = Math.floor(t / 3600);
    const mins = Math.floor((t % 3600) / 60);
    const secs = t % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const formatTime = (timeStr: string, offsetMin: number) => {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(); d.setHours(h, m + offsetMin, 0, 0);
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  useEffect(() => {
    if (accessLoading) return;
    supabase.from("halaqat").select("*").eq("active", true).then(({ data }) => {
      const filtered = filterHalaqat(data || []);
      setHalaqat(filtered);
      if (filtered.length === 1 && !selectedHalaqa) setSelectedHalaqa(filtered[0].id);
    });
  }, [accessLoading]);

  useEffect(() => {
    if (!selectedHalaqa) return;
    supabase.from("students").select("*").eq("halaqa_id", selectedHalaqa).eq("status", "active").order("full_name")
      .then(({ data }) => {
        setStudents(data || []);
        const init: Record<string, AttendanceStatus> = {};
        (data || []).forEach((s: any) => { init[s.id] = windowStatus === "late" ? "late" : "present"; });
        setAttendance(init);
      });
    const today = new Date().toISOString().split("T")[0];
    supabase.from("attendance").select("student_id, status").eq("halaqa_id", selectedHalaqa).eq("attendance_date", today)
      .then(({ data }) => {
        if (data?.length) {
          const existing: Record<string, AttendanceStatus> = {};
          data.forEach((a: any) => { existing[a.student_id] = a.status; });
          setAttendance((prev) => ({ ...prev, ...existing }));
        }
      });
  }, [selectedHalaqa]);

  const handleSave = async () => {
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const markedAt = new Date().toISOString();
    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id, halaqa_id: selectedHalaqa, attendance_date: today, status, marked_at: markedAt,
    }));
    const { error } = await supabase.from("attendance").upsert(records, { onConflict: "student_id,attendance_date" });
    setSaving(false);
    if (error) { toast.error("حدث خطأ أثناء الحفظ"); return; }
    toast.success("تم حفظ الحضور بنجاح");
  };

  const statusIcons: Record<AttendanceStatus, any> = {
    present: <Check className="w-4 h-4" />, absent: <X className="w-4 h-4" />,
    late: <Clock className="w-4 h-4" />, excused: <AlertCircle className="w-4 h-4" />,
  };
  const statusLabels: Record<AttendanceStatus, string> = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "معذور" };
  const statusColors: Record<AttendanceStatus, string> = {
    present: "bg-success/10 text-success border-success/30",
    absent: "bg-destructive/10 text-destructive border-destructive/30",
    late: "bg-warning/10 text-warning border-warning/30",
    excused: "bg-info/10 text-info border-info/30",
  };
  const WINDOW_STATUS_MAP: Record<WindowStatus, { label: string; color: string }> = {
    not_open: { label: "لم يُفتح بعد", color: "bg-muted text-muted-foreground" },
    on_time: { label: "مفتوح – في الوقت", color: "bg-green-100 text-green-800" },
    late: { label: "مفتوح – متأخر", color: "bg-yellow-100 text-yellow-800" },
    closed: { label: "مُغلق", color: "bg-red-100 text-red-800" },
  };

  const cycleStatus = (studentId: string) => {
    const order: AttendanceStatus[] = ["present", "absent", "late", "excused"];
    const current = attendance[studentId] || "present";
    setAttendance({ ...attendance, [studentId]: order[(order.indexOf(current) + 1) % order.length] });
  };

  if (accessLoading || calendar.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Weekend or Holiday → disable attendance
  if (calendar.status !== "active") {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">الحضور والغياب</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Card className="border-2 border-muted">
          <CardContent className="p-8 text-center space-y-4">
            <CalendarOff className="w-16 h-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">
              {calendar.status === "weekend" ? "إجازة نهاية الأسبوع" : "إجازة رسمية"}
            </h2>
            {calendar.holidayTitle && (
              <Badge variant="secondary" className="text-sm px-4 py-1">{calendar.holidayTitle}</Badge>
            )}
            <p className="text-muted-foreground text-sm">الحضور معطّل تلقائياً في أيام الإجازة</p>
            {calendar.nextActiveDay && (
              <p className="text-sm text-primary font-medium">
                أقرب يوم دراسي: {calendar.nextActiveDay}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الحضور والغياب</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {hijriDate && ` — ${hijriDate}`}
        </p>
      </div>

      {asrTime && (
        <Card className={windowStatus === "on_time" ? "border-green-500 border-2" : windowStatus === "late" ? "border-yellow-500 border-2" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="w-5 h-5 text-primary" />
              نافذة الحضور (صلاة العصر)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">الحالة</span>
              <Badge className={WINDOW_STATUS_MAP[windowStatus].color}>
                {WINDOW_STATUS_MAP[windowStatus].label}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">العصر</p>
                <p className="text-sm font-bold">{asrTime}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">بداية الحضور</p>
                <p className="text-sm font-bold">{formatTime(asrTime, OFFSET_START)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">حد التأخر</p>
                <p className="text-sm font-bold">{formatTime(asrTime, OFFSET_LATE)}</p>
              </div>
            </div>
            {windowStatus !== "closed" && countdown && (
              <div className="text-center pt-1">
                <p className="text-xs text-muted-foreground mb-1">
                  {windowStatus === "not_open" ? "يفتح بعد" : windowStatus === "on_time" ? "التأخر بعد" : "يُغلق بعد"}
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-primary">{countdown}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
        <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
        <SelectContent>
          {halaqat.map((h) => (<SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>))}
        </SelectContent>
      </Select>

      {selectedHalaqa && students.length > 0 && (
        <>
          <div className="space-y-2">
            {students.map((student) => {
              const status = attendance[student.id] || "present";
              return (
                <button key={student.id} onClick={() => cycleStatus(student.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${statusColors[status]}`}>
                  <span className="font-medium text-sm">{student.full_name}</span>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {statusIcons[status]}
                    {statusLabels[status]}
                  </div>
                </button>
              );
            })}
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            <CheckSquare className="w-4 h-4 ml-2" />
            {saving ? "جارٍ الحفظ..." : "حفظ الحضور"}
          </Button>
        </>
      )}
    </div>
  );
};

export default Attendance;
