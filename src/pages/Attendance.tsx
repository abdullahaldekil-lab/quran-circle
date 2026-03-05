import { useEffect, useState, useCallback } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckSquare, X, Clock, AlertCircle, Check, Sun, CalendarOff, CalendarDays, Lock, Unlock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import { sendNotification } from "@/utils/sendNotification";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

// Teacher permission window & status thresholds (minutes relative to Asr adhan)
const TEACHER_WINDOW_OPEN = 0;      // تفتح عند أذان العصر بالضبط
const TEACHER_WINDOW_CLOSE = 105;   // العصر + 105 دقيقة
const ON_TIME_THRESHOLD = 70;       // العصر + 70 دقيقة = حد التأخر
const COUNTDOWN_RED_THRESHOLD = 10; // آخر 10 دقائق = أحمر

type TeacherWindowStatus = "before_open" | "open" | "closed";

const formatTo12h = (time24: string): string => {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

const Attendance = () => {
  const { user } = useAuth();
  const { isManager, isAdminStaff, isSupervisor, isTeacher, role } = useRole();
  const { filterHalaqat, loading: accessLoading, isReadOnly: halaqaReadOnly } = useTeacherHalaqat();
  const calendar = useAcademicCalendar();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [originalAttendance, setOriginalAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [markedTimes, setMarkedTimes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [asrTime, setAsrTime] = useState<string | null>(null);
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [teacherWindow, setTeacherWindow] = useState<TeacherWindowStatus>("before_open");
  const [countdown, setCountdown] = useState("");
  const [countdownColor, setCountdownColor] = useState("text-primary");
  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showCalendar, setShowCalendar] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = selectedDate === todayStr;

  // Admin = manager or secretary/admin_staff — no time restrictions
  const isAdmin = isManager || isAdminStaff;

  // Edit permission logic
  const canEditDate = useCallback((dateStr: string): boolean => {
    if (isAdmin) return true; // Admin: anytime, any date
    if (isSupervisor || halaqaReadOnly) return false;
    // Teachers: only today, only within window
    if (dateStr !== todayStr) return false;
    return teacherWindow === "open";
  }, [isAdmin, isSupervisor, halaqaReadOnly, todayStr, teacherWindow]);

  const canEdit = canEditDate(selectedDate);

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

  // Compute teacher window status & countdown
  useEffect(() => {
    if (!asrTime || !isToday || calendar.status !== "active") return;
    const [h, m] = asrTime.split(":").map(Number);

    const openTime = new Date();
    openTime.setHours(h, m + TEACHER_WINDOW_OPEN, 0, 0);

    const closeTime = new Date();
    closeTime.setHours(h, m + TEACHER_WINDOW_CLOSE, 0, 0);

    const lateThreshold = new Date();
    lateThreshold.setHours(h, m + ON_TIME_THRESHOLD, 0, 0);

    const nowMs = now.getTime();

    if (nowMs < openTime.getTime()) {
      setTeacherWindow("before_open");
      setCountdown(formatCountdown(openTime.getTime() - nowMs));
      setCountdownColor("text-primary");
    } else if (nowMs < closeTime.getTime()) {
      setTeacherWindow("open");
      const remainingMs = closeTime.getTime() - nowMs;
      setCountdown(formatCountdown(remainingMs));

      const remainingMin = remainingMs / 60000;
      if (remainingMin <= COUNTDOWN_RED_THRESHOLD) {
        setCountdownColor("text-red-600");
      } else if (nowMs >= lateThreshold.getTime()) {
        setCountdownColor("text-yellow-600");
      } else {
        setCountdownColor("text-primary");
      }
    } else {
      setTeacherWindow("closed");
      setCountdown("");
      setCountdownColor("text-primary");
    }
  }, [now, asrTime, isToday, calendar.status]);

  const formatCountdown = (ms: number) => {
    const t = Math.floor(ms / 1000);
    const hrs = Math.floor(t / 3600);
    const mins = Math.floor((t % 3600) / 60);
    const secs = t % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const formatTimeFromAsr = (offsetMin: number) => {
    if (!asrTime) return "";
    const [h, m] = asrTime.split(":").map(Number);
    const d = new Date(); d.setHours(h, m + offsetMin, 0, 0);
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Determine status based on current time relative to Asr
  const getAutoStatus = (): AttendanceStatus => {
    if (!asrTime) return "present";
    const [h, m] = asrTime.split(":").map(Number);
    const lateThreshold = new Date();
    lateThreshold.setHours(h, m + ON_TIME_THRESHOLD, 0, 0);

    if (now.getTime() >= lateThreshold.getTime()) return "late";
    return "present";
  };

  useEffect(() => {
    if (accessLoading) return;
    const fetchHalaqat = async () => {
      if (isTeacher && user) {
        const { data } = await supabase
          .from("halaqat")
          .select("*")
          .eq("active", true)
          .or(`teacher_id.eq.${user.id},assistant_teacher_id.eq.${user.id}`);
        const teacherHalaqat = data || [];
        setHalaqat(teacherHalaqat);
        if (teacherHalaqat.length > 0 && !selectedHalaqa) {
          setSelectedHalaqa(teacherHalaqat[0].id);
        }
      } else {
        const { data } = await supabase.from("halaqat").select("*").eq("active", true);
        const filtered = filterHalaqat(data || []);
        setHalaqat(filtered);
        if (filtered.length === 1 && !selectedHalaqa) setSelectedHalaqa(filtered[0].id);
      }
    };
    fetchHalaqat();
  }, [accessLoading, user, isTeacher]);

  // Fetch students & attendance for selected date
  useEffect(() => {
    if (!selectedHalaqa) return;
    const fetchData = async () => {
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase.from("students").select("*").eq("halaqa_id", selectedHalaqa).eq("status", "active").order("full_name"),
        supabase.from("attendance").select("student_id, status, marked_at").eq("halaqa_id", selectedHalaqa).eq("attendance_date", selectedDate),
      ]);

      const studentList = studentsRes.data || [];
      setStudents(studentList);

      // Build attendance & markedTimes from existing records
      const existing: Record<string, AttendanceStatus> = {};
      const existingTimes: Record<string, string> = {};
      if (attendanceRes.data?.length) {
        attendanceRes.data.forEach((a: any) => {
          existing[a.student_id] = a.status;
          if (a.marked_at) {
            existingTimes[a.student_id] = a.marked_at;
          }
        });
      }

      if (isAdmin || !isToday || Object.keys(existing).length > 0) {
        // Admin or past date or existing records: show as before
        const init: Record<string, AttendanceStatus> = {};
        if (isAdmin && Object.keys(existing).length === 0) {
          // Admin new records default to present
          studentList.forEach((s: any) => { init[s.id] = "present"; });
        }
        setAttendance({ ...init, ...existing });
      } else {
        // Teacher, today, no existing records: leave empty (unrecorded)
        setAttendance(existing);
      }

      setOriginalAttendance(existing);
      setMarkedTimes(existingTimes);
    };
    fetchData();
  }, [selectedHalaqa, selectedDate]);

  const handleSave = async () => {
    setSaving(true);
    const markedAt = new Date().toISOString();

    // Build final attendance: unrecorded students become absent
    const finalAttendance = { ...attendance };
    students.forEach((student: any) => {
      const sid = student.id;
      if (!finalAttendance[sid]) {
        // Not marked = absent
        finalAttendance[sid] = "absent";
      }
    });

    const records = Object.entries(finalAttendance).map(([student_id, status]) => ({
      student_id, halaqa_id: selectedHalaqa, attendance_date: selectedDate, status,
      marked_at: markedTimes[student_id] || markedAt,
    }));
    const { error } = await supabase.from("attendance").upsert(records, { onConflict: "student_id,attendance_date" });

    if (error) { setSaving(false); toast.error("حدث خطأ أثناء الحفظ"); return; }

    // Log audit entries for changed statuses
    if (user && Object.keys(originalAttendance).length > 0) {
      const auditEntries = Object.entries(finalAttendance)
        .filter(([sid, status]) => originalAttendance[sid] && originalAttendance[sid] !== status)
        .map(([student_id, new_status]) => ({
          attendance_id: student_id,
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

    // Send automatic notifications for absent/late students
    const absentStudents = Object.entries(finalAttendance).filter(([, s]) => s === "absent");
    const lateStudents = Object.entries(finalAttendance).filter(([, s]) => s === "late");

    if (absentStudents.length > 0) {
      for (const [sid] of absentStudents) {
        const student = students.find((s: any) => s.id === sid);
        if (!student) continue;
        const { data: links } = await supabase.from("guardian_students").select("guardian_id").eq("student_id", sid).eq("active", true);
        if (links && links.length > 0) {
          sendNotification({
            templateCode: "STUDENT_ABSENT",
            recipientIds: links.map((l: any) => l.guardian_id),
            variables: { studentName: student.full_name, date: selectedDate },
          }).catch(console.error);
        }
      }
    }

    if (lateStudents.length > 0) {
      for (const [sid] of lateStudents) {
        const student = students.find((s: any) => s.id === sid);
        if (!student) continue;
        const { data: links } = await supabase.from("guardian_students").select("guardian_id").eq("student_id", sid).eq("active", true);
        if (links && links.length > 0) {
          sendNotification({
            templateCode: "STUDENT_LATE",
            recipientIds: links.map((l: any) => l.guardian_id),
            variables: { studentName: student.full_name, date: selectedDate },
          }).catch(console.error);
        }
      }
    }

    setSaving(false);
    setAttendance(finalAttendance);
    setOriginalAttendance({ ...finalAttendance });
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

  const TEACHER_WINDOW_MAP: Record<TeacherWindowStatus, { label: string; color: string; icon: any }> = {
    before_open: { label: "مغلق – لم يحن الوقت", color: "bg-muted text-muted-foreground", icon: <Lock className="w-4 h-4" /> },
    open: { label: "مفتوح – يمكنك التحضير", color: "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300", icon: <Unlock className="w-4 h-4" /> },
    closed: { label: "مُغلق – انتهى الوقت", color: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300", icon: <Lock className="w-4 h-4" /> },
  };

  const handleTeacherMark = (studentId: string) => {
    if (!canEdit) return;

    // If already marked, allow toggling back to unrecorded
    if (attendance[studentId]) {
      const newAtt = { ...attendance };
      delete newAtt[studentId];
      setAttendance(newAtt);
      const newTimes = { ...markedTimes };
      delete newTimes[studentId];
      setMarkedTimes(newTimes);
      return;
    }

    // Mark with current time
    const markTime = new Date();
    const status = getAutoStatus();

    setAttendance({ ...attendance, [studentId]: status });
    setMarkedTimes({ ...markedTimes, [studentId]: markTime.toISOString() });
  };

  const cycleStatus = (studentId: string) => {
    if (!canEdit) return;
    // Admin can cycle all 4 statuses; teachers use the new tap system
    if (!isAdmin) {
      handleTeacherMark(studentId);
      return;
    }
    const order: AttendanceStatus[] = ["present", "absent", "late", "excused"];
    const current = attendance[studentId] || "present";
    const idx = order.indexOf(current);
    setAttendance({ ...attendance, [studentId]: order[(idx + 1) % order.length] });
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const formatMarkedTime = (isoStr: string) => {
    const d = new Date(isoStr);
    const h = d.getHours();
    const m = d.getMinutes();
    const period = h >= 12 ? "م" : "ص";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
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

  // For today: use calendar hook; for past dates: check weekend only
  if (isToday && calendar.status !== "active" && !isAdmin) {
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
          {isAdmin && (
            <Badge variant="outline" className="text-xs">وصول إداري بلا قيود</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(todayStr); setShowCalendar(false); }}>
            العودة لليوم
          </Button>
        </div>
      )}

      {/* Halaqa selector: admin sees dropdown, teacher sees fixed label */}
      {isTeacher ? (
        halaqat.length > 0 ? (
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                <span className="font-medium">حلقتك: {halaqat.find(h => h.id === selectedHalaqa)?.name || "—"}</span>
              </div>
              <Badge variant="secondary">{students.length}/25</Badge>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/30">
            <CardContent className="p-8 text-center space-y-2">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive/60" />
              <p className="font-bold text-destructive">لا توجد حلقة مرتبطة بحسابك. راجع الإدارة.</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
          <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
          <SelectContent>
            {halaqat.map((h) => (<SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>))}
          </SelectContent>
        </Select>
      )}

      {/* Calendar panel */}
      {showCalendar && selectedHalaqa && (
        <Card>
          <CardContent className="p-4">
            <AttendanceCalendar halaqaId={selectedHalaqa} selectedDate={selectedDate} onSelectDate={handleDateSelect} />
          </CardContent>
        </Card>
      )}

      {/* Teacher Attendance Window Info (teachers only, today) */}
      {isToday && asrTime && calendar.status === "active" && !isAdmin && (
        <Card className={teacherWindow === "open" ? "border-green-500 border-2" : teacherWindow === "closed" ? "border-destructive/50 border-2" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="w-5 h-5 text-primary" />
              نافذة التحضير (بريدة)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">الحالة</span>
              <Badge className={`${TEACHER_WINDOW_MAP[teacherWindow].color} flex items-center gap-1`}>
                {TEACHER_WINDOW_MAP[teacherWindow].icon}
                {TEACHER_WINDOW_MAP[teacherWindow].label}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">أذان العصر</p>
                <p className="text-sm font-bold">{formatTo12h(asrTime)}</p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                <p className="text-xs text-muted-foreground">حد التأخر (العصر+70د)</p>
                <p className="text-sm font-bold">{formatTimeFromAsr(ON_TIME_THRESHOLD)}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="text-xs text-muted-foreground">إغلاق النافذة (العصر+105د)</p>
                <p className="text-sm font-bold">{formatTimeFromAsr(TEACHER_WINDOW_CLOSE)}</p>
              </div>
            </div>

            {teacherWindow !== "closed" && countdown && (
              <div className="text-center pt-1">
                <p className="text-xs text-muted-foreground mb-1">
                  {teacherWindow === "before_open" ? "تفتح النافذة بعد" : "تغلق النافذة بعد"}
                </p>
                <p className={`text-3xl font-bold font-mono tabular-nums ${countdownColor}`}>{countdown}</p>
              </div>
            )}

            {teacherWindow === "before_open" && (
              <p className="text-xs text-center text-muted-foreground">
                تفتح النافذة عند أذان العصر وتغلق بعد 105 دقائق. بعد 70 دقيقة يُسجَّل الطالب متأخراً.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin: show Asr info card (simpler) */}
      {isToday && asrTime && calendar.status === "active" && isAdmin && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">أذان العصر (بريدة)</span>
              </div>
              <span className="text-sm font-bold">{formatTo12h(asrTime)}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>حد التأخر (العصر+70د): {formatTimeFromAsr(ON_TIME_THRESHOLD)}</span>
              <span>•</span>
              <Badge variant="outline" className="text-xs">وصول إداري – بلا قيود زمنية</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekend/holiday message for past selected dates */}
      {!isToday && isSelectedWeekend && !isAdmin && (
        <Card className="border-muted">
          <CardContent className="p-6 text-center">
            <CalendarOff className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">إجازة نهاية الأسبوع</p>
          </CardContent>
        </Card>
      )}

      {/* No students message for teachers */}
      {selectedHalaqa && students.length === 0 && isTeacher && halaqat.length > 0 && (
        <Card className="border-muted">
          <CardContent className="p-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">لا يوجد طلاب مسجلين في هذه الحلقة حتى الآن.</p>
          </CardContent>
        </Card>
      )}
      {/* Attendance Summary */}
      {selectedHalaqa && students.length > 0 && Object.keys(originalAttendance).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">ملخص حضور اليوم</span>
              <Badge variant="outline" className="text-xs">
                {students.length} طالب
              </Badge>
            </div>
            {(() => {
              const presentCount = Object.values(originalAttendance).filter(s => s === "present").length;
              const lateCount = Object.values(originalAttendance).filter(s => s === "late").length;
              const absentCount = Object.values(originalAttendance).filter(s => s === "absent").length;
              const excusedCount = Object.values(originalAttendance).filter(s => s === "excused").length;
              const totalRecords = Object.keys(originalAttendance).length;
              const attendanceRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden flex">
                      {presentCount > 0 && <div className="h-full bg-green-500" style={{ width: `${(presentCount / totalRecords) * 100}%` }} />}
                      {lateCount > 0 && <div className="h-full bg-yellow-500" style={{ width: `${(lateCount / totalRecords) * 100}%` }} />}
                      {excusedCount > 0 && <div className="h-full bg-blue-500" style={{ width: `${(excusedCount / totalRecords) * 100}%` }} />}
                      {absentCount > 0 && <div className="h-full bg-red-500" style={{ width: `${(absentCount / totalRecords) * 100}%` }} />}
                    </div>
                    <span className="text-sm font-bold min-w-[3rem] text-left">{attendanceRate}%</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> حاضر: {presentCount}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> متأخر: {lateCount}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> غائب: {absentCount}</span>
                    {excusedCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> معذور: {excusedCount}</span>}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {selectedHalaqa && students.length > 0 && (!isSelectedWeekend || isAdmin) && (
        <>
          {/* Status note for teachers */}
          {!isAdmin && isToday && asrTime && teacherWindow === "open" && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
              {now.getTime() >= (() => { const [h,m] = asrTime.split(":").map(Number); const d = new Date(); d.setHours(h, m + ON_TIME_THRESHOLD, 0, 0); return d.getTime(); })()
                ? "⚠️ الوقت الحالي بعد حد التأخر — الضغط على الطالب سيسجله «متأخر» مع الوقت الفعلي"
                : "✅ اضغط على بطاقة الطالب عند حضوره لتسجيل وقته الفعلي"
              }
            </div>
          )}

          <div className="space-y-2">
            {students.map((student) => {
              const status = attendance[student.id];
              const isRecorded = !!status;
              const markedTime = markedTimes[student.id];

              // For teachers on today with no existing record: show gray unrecorded card
              if (!isAdmin && isToday && !isRecorded && Object.keys(originalAttendance).length === 0) {
                return (
                  <button
                    key={student.id}
                    onClick={() => cycleStatus(student.id)}
                    disabled={!canEdit}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all bg-muted/40 text-muted-foreground border-muted ${!canEdit ? "opacity-70 cursor-default" : "hover:bg-muted/60"}`}
                  >
                    <StudentNameLink studentId={student.id} studentName={student.full_name} className="text-sm" />
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Clock className="w-4 h-4" />
                      لم يُسجَّل
                    </div>
                  </button>
                );
              }

              const displayStatus = status || "present";
              return (
                <button
                  key={student.id}
                  onClick={() => cycleStatus(student.id)}
                  disabled={!canEdit}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${statusColors[displayStatus]} ${!canEdit ? "opacity-70 cursor-default" : ""}`}
                >
                  <StudentNameLink studentId={student.id} studentName={student.full_name} className="text-sm" />
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {markedTime && !isAdmin && (
                      <span className="text-[11px] opacity-75">{formatMarkedTime(markedTime)}</span>
                    )}
                    {statusIcons[displayStatus]}
                    {statusLabels[displayStatus]}
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
