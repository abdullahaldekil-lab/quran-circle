import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentNameLink from "@/components/StudentNameLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, ClipboardList, TrendingUp, AlertTriangle, CheckCircle, ArrowUpLeft, Briefcase } from "lucide-react";
import StudentAnalytics from "@/components/dashboard/StudentAnalytics";
import AttendanceAnalytics from "@/components/dashboard/AttendanceAnalytics";
import HalaqatAnalytics from "@/components/dashboard/HalaqatAnalytics";
import QuizAnalytics from "@/components/dashboard/QuizAnalytics";
import DailyAttendanceSummary from "@/components/dashboard/DailyAttendanceSummary";
import PageDateHeader from "@/components/PageDateHeader";

const withTimeout = <T,>(promise: PromiseLike<T> | Promise<T>, ms = 5000): Promise<T> => {
  const p = Promise.resolve(promise);
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { allowedHalaqatIds, loading: accessLoading } = useTeacherHalaqat();
  const { isManager, isSupervisor, isAdminStaff } = useRole();
  const canSeeStaff = isManager || isSupervisor || isAdminStaff;
  const [stats, setStats] = useState({ students: 0, halaqat: 0, todayRecitations: 0, avgScore: 0 });
  const [staffPct, setStaffPct] = useState<number | null>(null);
  const [planStats, setPlanStats] = useState<{ onTrack: number; total: number } | null>(null);
  const [alerts, setAlerts] = useState<{ type: string; message: string }[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (authLoading || !user || accessLoading) return;

    let cancelled = false;
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        let studentsQuery = supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active");
        let halaqatQuery = supabase.from("halaqat").select("id", { count: "exact", head: true }).eq("active", true);
        let recitationsQuery = supabase.from("recitation_records").select("total_score").eq("record_date", today);

        // Apply halaqa filter for teachers
        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          studentsQuery = studentsQuery.in("halaqa_id", allowedHalaqatIds);
          halaqatQuery = halaqatQuery.in("id", allowedHalaqatIds);
          recitationsQuery = recitationsQuery.in("halaqa_id", allowedHalaqatIds);
        } else if (allowedHalaqatIds !== null && allowedHalaqatIds.length === 0) {
          setStats({ students: 0, halaqat: 0, todayRecitations: 0, avgScore: 0 });
          setDataLoaded(true);
          return;
        }

        const [studentsRes, halaqatRes, recitationsRes] = await withTimeout(Promise.all([
          studentsQuery, halaqatQuery, recitationsQuery,
        ]));

        if (cancelled) return;

        const scores = recitationsRes.data?.map((r) => Number(r.total_score)).filter(Boolean) || [];
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const totalStudents = studentsRes.count || 0;
        const todayCount = recitationsRes.data?.length || 0;

        setStats({
          students: totalStudents,
          halaqat: halaqatRes.count || 0,
          todayRecitations: todayCount,
          avgScore: Math.round(avg),
        });

        const newAlerts: { type: string; message: string }[] = [];
        if (totalStudents > 0 && todayCount < totalStudents * 0.5) {
          newAlerts.push({ type: "warning", message: `تم تسميع ${todayCount} من ${totalStudents} طالب فقط اليوم` });
        }
        const lowScores = (recitationsRes.data || []).filter((r) => Number(r.total_score) < 50);
        if (lowScores.length > 0) {
          newAlerts.push({ type: "error", message: `${lowScores.length} طالب حصلوا على أقل من 50 درجة اليوم` });
        }
        if (todayCount > 0 && avg >= 80) {
          newAlerts.push({ type: "success", message: `أداء ممتاز اليوم! متوسط الدرجات ${Math.round(avg)}` });
        }
        setAlerts(newAlerts);

        // Fetch staff attendance percentage
        if (canSeeStaff) {
          const { count: totalStaff } = await supabase
            .from("profiles").select("id", { count: "exact", head: true })
            .eq("active", true).eq("is_staff", true);
          const { data: staffAtt } = await supabase
            .from("staff_attendance").select("status")
            .eq("attendance_date", today);
          const records = staffAtt || [];
          const presentAndLate = records.filter((r: any) => r.status === "present" || r.status === "late").length;
          const pct = (totalStaff || 0) > 0 ? Math.round((presentAndLate / (totalStaff || 1)) * 100) : 0;
          if (!cancelled) setStaffPct(Math.min(pct, 100));
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, [authLoading, user, accessLoading, allowedHalaqatIds]);

  const cards = [
    { title: "عدد الطلاب", value: stats.students, icon: Users, color: "text-primary", href: "/students" },
    { title: "الحلقات", value: stats.halaqat, icon: BookOpen, color: "text-secondary", href: "/halaqat" },
    { title: "تسميعات اليوم", value: stats.todayRecitations, icon: ClipboardList, color: "text-info", href: "/recitation" },
    { title: "متوسط الدرجات", value: stats.avgScore, icon: TrendingUp, color: "text-success", href: "/quiz-results" },
  ];

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            مرحباً {profile?.full_name || ""}
          </h1>
          <p className="text-muted-foreground mt-1">مجمع حويلان لتحفيظ القرآن الكريم</p>
        </div>
        <PageDateHeader />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                alert.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : alert.type === "warning"
                  ? "bg-warning/10 text-warning"
                  : "bg-success/10 text-success"
              }`}
            >
              {alert.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {!dataLoaded ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 ${canSeeStaff && staffPct !== null ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
            {cards.map((card) => (
              <Card
                key={card.title}
                className="animate-slide-in cursor-pointer group relative transition-shadow hover:shadow-lg"
                onClick={() => navigate(card.href)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl lg:text-3xl font-bold">{card.value}</div>
                </CardContent>
                <ArrowUpLeft className="w-4 h-4 text-muted-foreground absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            ))}
            {canSeeStaff && staffPct !== null && (
              <Card
                className="animate-slide-in cursor-pointer group relative transition-shadow hover:shadow-lg"
                onClick={() => navigate("/staff-attendance")}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">حضور الموظفين</CardTitle>
                  <Briefcase className={`w-5 h-5 ${staffPct >= 90 ? 'text-success' : staffPct >= 70 ? 'text-warning' : 'text-destructive'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl lg:text-3xl font-bold ${staffPct >= 90 ? 'text-success' : staffPct >= 70 ? 'text-warning' : 'text-destructive'}`}>
                    {staffPct}%
                  </div>
                </CardContent>
                <ArrowUpLeft className="w-4 h-4 text-muted-foreground absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            )}
          </div>

          {/* Daily Attendance Summary */}
          <DailyAttendanceSummary />

          {/* Student Analytics Section */}
          <StudentAnalytics />
          <AttendanceAnalytics />
          <HalaqatAnalytics />
          <QuizAnalytics />

          {!isMobile && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">آخر التسميعات</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentRecitations />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">التعليمات الجديدة</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentInstructions />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};
const RecentRecitations = () => {
  const [records, setRecords] = useState<any[]>([]);
  const { user } = useAuth();
  const { allowedHalaqatIds } = useTeacherHalaqat();
  useEffect(() => {
    if (!user) return;
    let query = supabase
      .from("recitation_records")
      .select("*, students(full_name), halaqat(name)")
      .order("created_at", { ascending: false })
      .limit(5);
    if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
      query = query.in("halaqa_id", allowedHalaqatIds);
    }
    withTimeout(query).then(({ data }) => setRecords(data || [])).catch(() => {});
  }, [user, allowedHalaqatIds]);

  if (!records.length) return <p className="text-muted-foreground text-sm">لا توجد تسميعات حتى الآن</p>;

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <p className="font-medium text-sm"><StudentNameLink studentId={r.student_id} studentName={r.students?.full_name || "—"} /></p>
            <p className="text-xs text-muted-foreground">{r.halaqat?.name}</p>
          </div>
          <div className={`text-sm font-bold ${Number(r.total_score) >= 80 ? "text-success" : Number(r.total_score) >= 60 ? "text-warning" : "text-destructive"}`}>
            {r.total_score}
          </div>
        </div>
      ))}
    </div>
  );
};

const RecentInstructions = () => {
  const [items, setItems] = useState<any[]>([]);
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    withTimeout(
      supabase
        .from("instructions")
        .select("*")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(5)
    ).then(({ data }) => setItems(data || [])).catch(() => {});
  }, [user]);

  if (!items.length) return <p className="text-muted-foreground text-sm">لا توجد تعليمات جديدة</p>;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="py-2 border-b last:border-0">
          <p className="font-medium text-sm">{item.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{item.body}</p>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
