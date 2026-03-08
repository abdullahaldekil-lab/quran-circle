import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatHijriArabic } from "@/lib/hijri";
import { ClipboardCheck, AlertCircle, Users, Clock, UserX } from "lucide-react";

interface HalaqaAttendance {
  halaqaId: string;
  halaqaName: string;
  teacherName: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

const DailyAttendanceSummary = () => {
  const { user } = useAuth();
  const { allowedHalaqatIds } = useTeacherHalaqat();
  const [markedHalaqat, setMarkedHalaqat] = useState<HalaqaAttendance[]>([]);
  const [unmarkedHalaqat, setUnmarkedHalaqat] = useState<{ id: string; name: string; teacherName: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all active halaqat with teachers
        let halaqatQuery = supabase
          .from("halaqat")
          .select("id, name, teacher_id, profiles:teacher_id(full_name)")
          .eq("active", true);

        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          halaqatQuery = halaqatQuery.in("id", allowedHalaqatIds);
        } else if (allowedHalaqatIds !== null && allowedHalaqatIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data: halaqatData } = await halaqatQuery;
        const allHalaqat = halaqatData || [];

        // Fetch today's attendance
        let attQuery = supabase
          .from("attendance")
          .select("halaqa_id, student_id, status")
          .eq("attendance_date", today);

        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          attQuery = attQuery.in("halaqa_id", allowedHalaqatIds);
        }

        const { data: attData } = await attQuery;
        const attendance = attData || [];

        // Fetch active students per halaqa
        let studentsQuery = supabase
          .from("students")
          .select("id, halaqa_id")
          .eq("status", "active");

        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          studentsQuery = studentsQuery.in("halaqa_id", allowedHalaqatIds);
        }

        const { data: studentsData } = await studentsQuery;
        const students = studentsData || [];

        // Group attendance by halaqa
        const attByHalaqa: Record<string, any[]> = {};
        attendance.forEach((a) => {
          if (!attByHalaqa[a.halaqa_id]) attByHalaqa[a.halaqa_id] = [];
          attByHalaqa[a.halaqa_id].push(a);
        });

        // Group students by halaqa
        const studentsByHalaqa: Record<string, number> = {};
        students.forEach((s) => {
          if (s.halaqa_id) studentsByHalaqa[s.halaqa_id] = (studentsByHalaqa[s.halaqa_id] || 0) + 1;
        });

        const marked: HalaqaAttendance[] = [];
        const unmarked: { id: string; name: string; teacherName: string }[] = [];

        allHalaqat.forEach((h: any) => {
          const teacherName = h.profiles?.full_name || "بدون معلم";
          const totalStudents = studentsByHalaqa[h.id] || 0;
          const halaqaAtt = attByHalaqa[h.id];

          if (halaqaAtt && halaqaAtt.length > 0) {
            const present = halaqaAtt.filter((a: any) => a.status === "present").length;
            const late = halaqaAtt.filter((a: any) => a.status === "late").length;
            const absent = halaqaAtt.filter((a: any) => a.status === "absent").length;
            const pct = totalStudents > 0 ? Math.round(((present + late) / totalStudents) * 100) : 0;

            marked.push({
              halaqaId: h.id,
              halaqaName: h.name,
              teacherName,
              totalStudents,
              present,
              absent,
              late,
              percentage: Math.min(pct, 100),
            });
          } else if (totalStudents > 0) {
            unmarked.push({ id: h.id, name: h.name, teacherName });
          }
        });

        marked.sort((a, b) => a.percentage - b.percentage);
        setMarkedHalaqat(marked);
        setUnmarkedHalaqat(unmarked);
      } catch (e) {
        console.error("Attendance summary error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, allowedHalaqatIds]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const totalMarked = markedHalaqat.length;
  const totalAll = totalMarked + unmarkedHalaqat.length;
  const totalPresent = markedHalaqat.reduce((s, h) => s + h.present + h.late, 0);
  const avgPct = totalMarked > 0
    ? Math.round(markedHalaqat.reduce((s, h) => s + h.percentage, 0) / totalMarked)
    : 0;

  const getRowBg = (pct: number) => {
    if (pct >= 90) return "bg-success/5 border-success/20";
    if (pct < 70) return "bg-warning/5 border-warning/20";
    return "";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            ملخص حضور اليوم
          </CardTitle>
          <span className="text-xs text-muted-foreground">{formatHijriArabic(new Date())}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-lg font-bold text-primary">{totalMarked} / {totalAll}</p>
            <p className="text-xs text-muted-foreground">حلقات محضَّرة</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-success/5 border border-success/10">
            <p className="text-lg font-bold text-success">{totalPresent}</p>
            <p className="text-xs text-muted-foreground">إجمالي الحاضرين</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-info/5 border border-info/10">
            <p className="text-lg font-bold text-info">{avgPct}%</p>
            <p className="text-xs text-muted-foreground">متوسط الحضور</p>
          </div>
        </div>

        {/* Marked Halaqat */}
        {markedHalaqat.length > 0 && (
          <div className="space-y-2">
            {markedHalaqat.map((h) => (
              <div key={h.halaqaId} className={`p-3 rounded-lg border transition-colors ${getRowBg(h.percentage)}`}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-medium">{h.halaqaName}</p>
                    <p className="text-xs text-muted-foreground">{h.teacherName}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{h.present + h.late} / {h.totalStudents}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {h.absent > 0 && (
                        <span className="flex items-center gap-0.5 text-destructive">
                          <UserX className="w-3 h-3" /> {h.absent}
                        </span>
                      )}
                      {h.late > 0 && (
                        <span className="flex items-center gap-0.5 text-warning">
                          <Clock className="w-3 h-3" /> {h.late}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={h.percentage}
                    className={`h-2 flex-1 ${h.percentage >= 90 ? "[&>div]:bg-success" : h.percentage < 70 ? "[&>div]:bg-warning" : ""}`}
                  />
                  <span className="text-xs font-medium w-10 text-left">{h.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Unmarked Halaqat */}
        {unmarkedHalaqat.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              حلقات لم تُحضَّر بعد ({unmarkedHalaqat.length})
            </p>
            {unmarkedHalaqat.map((h) => (
              <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                <span className="text-destructive text-lg">🔴</span>
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.teacherName}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {markedHalaqat.length === 0 && unmarkedHalaqat.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد حلقات نشطة</p>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyAttendanceSummary;
