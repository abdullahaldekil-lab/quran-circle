import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckSquare, X, Clock, AlertCircle, Check, Sun, CalendarOff, CalendarDays } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import AttendanceCalendar from "@/components/AttendanceCalendar";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
type WindowStatus = "not_open" | "on_time" | "late" | "closed";

const Attendance = () => {
  const { user } = useAuth();
  const { isManager, isSupervisor } = useRole();
  const { filterHalaqat, loading: accessLoading, isReadOnly: halaqaReadOnly } = useTeacherHalaqat();
  const calendar = useAcademicCalendar();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [originalAttendance, setOriginalAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [asrTime, setAsrTime] = useState<string | null>(null);
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [windowStatus, setWindowStatus] = useState<WindowStatus>("not_open");
  const [countdown, setCountdown] = useState("");
  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showCalendar, setShowCalendar] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = selectedDate === todayStr;

  // Edit permission logic
  const canEditDate = useCallback((dateStr: string): boolean => {
    if (isManager) return true;
    if (isSupervisor || halaqaReadOnly) return false;
    // Teachers: today + previous 2 days
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 2;
  }, [isManager, isSupervisor, halaqaReadOnly]);

  const canEdit = canEditDate(selectedDate);

  const OFFSET_START = 0;
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
    if (isToday && calendar.status === "active") fetchPrayerTimes();
  }, [isToday, calendar.status, fetchPrayerTimes]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!asrTime || !isToday || calendar.status !== "active") return;
    const [h, m] = asrTime.split(":").map(Number);
    const startTime = new Date(); startTime.setHours(h, m + OFFSET_START, 0, 0);
    const lateTime = new Date(); lateTime.setHours(h, m + OFFSET_LATE, 0, 0);
    const endMs = startTime.getTime() + SESSION_DURATION * 60 * 1000;
    const nowMs = now.getTime();
    if (nowMs < startTime.getTime()) { setWindowStatus("not_open"); setCountdown(formatCountdown(startTime.getTime() - nowMs)); }
    else if (nowMs < lateTime.getTime()) { setWindowStatus("on_time"); setCountdown(formatCountdown(lateTime.getTime() - nowMs)); }
    else if (nowMs < endMs) { setWindowStatus("late"); setCountdown(formatCountdown(endMs - nowMs)); }
    else { setWindowStatus("closed"); setCountdown(""); }
  }, [now, asrTime, isToday, calendar.status]);

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

  // Fetch students & attendance for selected date
  useEffect(() => {
    if (!selectedHalaqa) return;
    const fetchData = async () => {
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase.from("students").select("*").eq("halaqa_id", selectedHalaqa).eq("status", "active").order("full_name"),
        supabase.from("attendance").select("student_id, status").eq("halaqa_id", selectedHalaqa).eq("attendance_date", selectedDate),
      ]);

      const studentList = studentsRes.data || [];
      setStudents(studentList);

      // Build default attendance (all present)
      const init: Record<string, AttendanceStatus> = {};
      studentList.forEach((s: any) => { init[s.id] = "present"; });

      // Overlay existing attendance records
      const existing: Record<string, AttendanceStatus> = {};
      if (attendanceRes.data?.length) {
        attendanceRes.data.forEach((a: any) => { existing[a.student_id] = a.status; });
      }

      setAttendance({ ...init, ...existing });
      setOriginalAttendance(existing);
    };
    fetchData();
  }, [selectedHalaqa, selectedDate]);

  const handleSave = async () => {
    setSaving(true);
    const markedAt = new Date().toISOString();
    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id, halaqa_id: selectedHalaqa, attendance_date: selectedDate, status, marked_at: markedAt,
    }));
    const { error } = await supabase.from("attendance").upsert(records, { onConflict: "student_id,attendance_date" });

    if (error) { setSaving(false); toast.error("حدث خطأ أثناء الحفظ"); return; }

    // Log audit entries for changed statuses (past dates)
    if (!isToday && user) {
      const auditEntries = Object.entries(attendance)
        .filter(([sid, status]) => originalAttendance[sid] && originalAttendance[sid] !== status)
        .map(([student_id, new_status]) => ({
          attendance_id: student_id, // used as reference
          student_id,
          attendance_date: selectedDate,
          old_status: originalAttendance[student_id] || "unknown",
          new_status,
          edited_by: user.id,
        }));
      if (auditEntries.length > 0) {
        await supabase.from("attendance_audit_log").insert(auditEntries);
      }
    }

    setSaving(false);
    setOriginalAttendance({ ...attendance });
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
    if (!canEdit) return;
    const order: AttendanceStatus[] = ["present", "absent", "late", "excused"];
    const current = attendance[studentId] || "present";
    setAttendance({ ...attendance, [studentId]: order[(order.indexOf(current) + 1) % order.length] });
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  if (accessLoading || calendar.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check if selected date is weekend/holiday
  const selDay = new Date(selectedDate).getDay();
  const isSelectedWeekend = selDay === 5 || selDay === 6;

  // For today: use calendar hook; for past dates: check weekend only (holidays checked via DB in calendar)
  if (isToday && calendar.status !== "active") {
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
            {calendar.holidayTitle && <Badge variant="secondary" className="text-sm px-4 py-1">{calendar.holidayTitle}</Badge>}
            <p className="text-muted-foreground text-sm">الحضور معطّل تلقائياً في أيام الإجازة</p>
            {calendar.nextActiveDay && <p className="text-sm text-primary font-medium">أقرب يوم دراسي: {calendar.nextActiveDay}</p>}
          </CardContent>
        </Card>
        {/* Still show calendar for historical access */}
        {selectedHalaqa && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" /> سجل الحضور</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceCalendar halaqaId={selectedHalaqa} selectedDate={selectedDate} onSelectDate={handleDateSelect} />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const selectedDateFormatted = new Date(selectedDate).toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الحضور والغياب</h1>
          <p className="text-muted-foreground text-sm">
            {selectedDateFormatted}
            {isToday && hijriDate && ` — ${hijriDate}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCalendar(!showCalendar)}>
          <CalendarDays className="w-4 h-4 ml-1" />
          التقويم
        </Button>
      </div>

      {/* Date navigation bar */}
      {!isToday && (
        <div className="flex items-center gap-2">
          <Badge variant={canEdit ? "default" : "secondary"} className="text-xs">
            {canEdit ? "قابل للتعديل" : "للعرض فقط"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(todayStr); setShowCalendar(false); }}>
            العودة لليوم
          </Button>
        </div>
      )}

      {/* Halaqa selector */}
      <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
        <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
        <SelectContent>
          {halaqat.map((h) => (<SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>))}
        </SelectContent>
      </Select>

      {/* Calendar panel */}
      {showCalendar && selectedHalaqa && (
        <Card>
          <CardContent className="p-4">
            <AttendanceCalendar halaqaId={selectedHalaqa} selectedDate={selectedDate} onSelectDate={handleDateSelect} />
          </CardContent>
        </Card>
      )}

      {/* Today Asr window (only on today) */}
      {isToday && asrTime && calendar.status === "active" && (
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
              <Badge className={WINDOW_STATUS_MAP[windowStatus].color}>{WINDOW_STATUS_MAP[windowStatus].label}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">أذان العصر (بداية الحضور)</p>
                <p className="text-sm font-bold">{asrTime}</p>
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

      {/* Weekend/holiday message for past selected dates */}
      {!isToday && isSelectedWeekend && (
        <Card className="border-muted">
          <CardContent className="p-6 text-center">
            <CalendarOff className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">إجازة نهاية الأسبوع</p>
          </CardContent>
        </Card>
      )}

      {/* Student list */}
      {selectedHalaqa && students.length > 0 && !isSelectedWeekend && (
        <>
          <div className="space-y-2">
            {students.map((student) => {
              const status = attendance[student.id] || "present";
              return (
                <button
                  key={student.id}
                  onClick={() => cycleStatus(student.id)}
                  disabled={!canEdit}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${statusColors[status]} ${!canEdit ? "opacity-70 cursor-default" : ""}`}
                >
                  <span className="font-medium text-sm">{student.full_name}</span>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {statusIcons[status]}
                    {statusLabels[status]}
                  </div>
                </button>
              );
            })}
          </div>

          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
              <CheckSquare className="w-4 h-4 ml-2" />
              {saving ? "جارٍ الحفظ..." : "حفظ الحضور"}
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default Attendance;
