import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, ClipboardList, CheckCircle2, AlertTriangle, Users } from "lucide-react";

interface StudentRow {
  id: string;
  full_name: string;
  recited: boolean;
  hasPlan: boolean;
}

/**
 * Teacher-first panel: today's halaqa preparation (attendance) plus direct
 * recitation entry for each student, so a teacher can act without hunting
 * through the sidebar.
 */
const TeacherQuickPanel = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [halaqa, setHalaqa] = useState<any>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendanceDone, setAttendanceDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      try {
        const { data: h } = await (supabase as any)
          .from("halaqat")
          .select("id, name, capacity_max")
          .or(`teacher_id.eq.${profile.id},assistant_teacher_id.eq.${profile.id}`)
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setHalaqa(h || null);
        if (!h) {
          setLoading(false);
          return;
        }

        const { data: studentRows } = await supabase
          .from("students")
          .select("id, full_name")
          .eq("halaqa_id", h.id)
          .eq("status", "active")
          .order("full_name")
          .limit(30);
        const ids = (studentRows || []).map((s) => s.id);

        const [recRes, attRes, planRes, madarijRes] = await Promise.all([
          ids.length
            ? supabase
                .from("recitation_records")
                .select("student_id")
                .eq("record_date", today)
                .in("student_id", ids)
            : Promise.resolve({ data: [] } as any),
          supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("halaqa_id", h.id)
            .eq("attendance_date", today),
          ids.length
            ? supabase
                .from("student_annual_plans")
                .select("student_id")
                .eq("status", "active")
                .in("student_id", ids)
            : Promise.resolve({ data: [] } as any),
          ids.length
            ? supabase
                .from("madarij_enrollments")
                .select("student_id")
                .eq("status", "active")
                .in("student_id", ids)
            : Promise.resolve({ data: [] } as any),
        ]);
        if (cancelled) return;

        const recited = new Set(((recRes as any).data || []).map((r: any) => r.student_id));
        const planned = new Set([
          ...(((planRes as any).data || []).map((r: any) => r.student_id)),
          ...(((madarijRes as any).data || []).map((r: any) => r.student_id)),
        ]);

        setAttendanceDone(((attRes as any).count || 0) > 0);
        setStudents(
          (studentRows || []).map((s) => ({
            id: s.id,
            full_name: s.full_name,
            recited: recited.has(s.id),
            hasPlan: planned.has(s.id),
          })),
        );
      } catch (e) {
        console.error("TeacherQuickPanel error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (loading || !halaqa) return null;

  const recitedCount = students.filter((s) => s.recited).length;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* تحضير حلقتي */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">تحضير حلقتي</CardTitle>
          <CheckSquare className="w-5 h-5 text-primary" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-bold">{halaqa.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {students.length} طالب
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {attendanceDone ? (
              <Badge className="bg-success text-success-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 ml-1" /> تم تحضير اليوم
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3.5 h-3.5 ml-1" /> لم يتم التحضير اليوم
              </Badge>
            )}
          </div>
          <Button className="w-full" onClick={() => navigate("/attendance")}>
            <CheckSquare className="w-4 h-4 ml-2" />
            تسجيل الحضور
          </Button>
        </CardContent>
      </Card>

      {/* إدخال التسميع */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">
            إدخال التسميع
            <span className="text-sm font-normal text-muted-foreground mr-2">
              ({recitedCount}/{students.length} اليوم)
            </span>
          </CardTitle>
          <ClipboardList className="w-5 h-5 text-info" />
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد طلاب في حلقتك</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 border-b last:border-0 py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name}</p>
                    {!s.hasPlan && (
                      <button
                        className="text-[11px] text-destructive underline"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        غير مربوط بخطة
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.recited ? (
                      <Badge variant="outline" className="text-success border-success/40">سُمِّع</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">لم يُسمَّع</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/recitation?student=${s.id}`)}
                    >
                      تسميع
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherQuickPanel;
