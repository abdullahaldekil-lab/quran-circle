import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentNameLink from "@/components/StudentNameLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, ClipboardList, TrendingUp, AlertTriangle, CheckCircle, ArrowUpLeft, Briefcase, CalendarDays, ScrollText, Sparkles } from "lucide-react";
import StudentAnalytics from "@/components/dashboard/StudentAnalytics";
import AttendanceAnalytics from "@/components/dashboard/AttendanceAnalytics";
import HalaqatAnalytics from "@/components/dashboard/HalaqatAnalytics";
import QuizAnalytics from "@/components/dashboard/QuizAnalytics";
import DailyAttendanceSummary from "@/components/dashboard/DailyAttendanceSummary";
import TeacherQuickPanel from "@/components/dashboard/TeacherQuickPanel";
import PageDateHeader from "@/components/PageDateHeader";
import { QuranicVerseHeader, IslamicDivider, EightPointStar } from "@/components/ui/IslamicOrnament";
import { formatDateHijriOnly } from "@/lib/hijri";

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
  const { isManager, isSupervisor, isAdminStaff, isTeacher } = useRole();
  const canSeeStaff = isManager || isSupervisor || isAdminStaff;
  const [stats, setStats] = useState({ students: 0, halaqat: 0, todayRecitations: 0, avgScore: 0 });
  const [staffPct, setStaffPct] = useState<number | null>(null);
  const [planStats, setPlanStats] = useState<{ onTrack: number; total: number } | null>(null);
  const [alerts, setAlerts] = useState<{ type: string; message: string }[]>([]);
  const [pendingRequests, setPendingRequests] = useState<number>(0);
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

        // Upcoming holidays alert
        const twoDaysLater = new Date(Date.now() + 2 * 864e5).toISOString().split("T")[0];
        const { data: upcomingHolidays } = await supabase
          .from("holidays")
          .select("title, start_date, end_date")
          .gte("start_date", today)
          .lte("start_date", twoDaysLater);
        if (upcomingHolidays?.length) {
          newAlerts.push({
            type: "info",
            message: `📅 تنبيه: إجازة «${upcomingHolidays[0].title}» تبدأ ${formatDateHijriOnly(upcomingHolidays[0].start_date)}`,
          });
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

        // Fetch annual plan stats
        if (isManager || isSupervisor) {
          const { data: allPlans } = await supabase
            .from("student_annual_plans").select("id").eq("status", "active");
          if (allPlans && allPlans.length > 0) {
            const { data: allProgress } = await supabase
              .from("student_plan_progress").select("plan_id, target_pages, actual_pages")
              .in("plan_id", allPlans.map(p => p.id));
            // Group by plan_id and calculate commitment
            const planMap = new Map<string, { target: number; actual: number }>();
            for (const row of allProgress || []) {
              const cur = planMap.get(row.plan_id) || { target: 0, actual: 0 };
              cur.target += row.target_pages || 0;
              cur.actual += row.actual_pages || 0;
              planMap.set(row.plan_id, cur);
            }
            let onTrack = 0;
            planMap.forEach(v => { if (v.target > 0 && (v.actual / v.target) >= 0.7) onTrack++; });
            if (!cancelled) setPlanStats({ onTrack, total: planMap.size });

            const behindPct = planMap.size > 0 ? ((planMap.size - onTrack) / planMap.size) * 100 : 0;
            if (behindPct > 20) {
              newAlerts.push({ type: "warning", message: `${Math.round(behindPct)}% من الطلاب متأخرون عن خططهم السنوية` });
            }
          }
        }

        // Fetch pending internal requests for current user
        const role = profile?.role || "teacher";
        const isManagerRole = profile?.role === "manager";
        let reqQuery = supabase
          .from("internal_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "in_progress"]);
        if (!isManagerRole) {
          reqQuery = reqQuery.or(`to_user_id.eq.${user.id},to_role.eq.${role}`);
        }
        const { count: reqCount } = await reqQuery;
        if (!cancelled) setPendingRequests(reqCount || 0);
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
    <div className="space-y-6 animate-fade-in">
      {/* Quranic Spiritual Header Banner */}
      <QuranicVerseHeader
        quote="﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾"
        subtitle={`مرحباً بك، ${profile?.full_name || "مستخدم"}`}
      />

      {/* لوحة المعلم: تحضير الحلقة وإدخال التسميع مباشرة */}
      {isTeacher && <TeacherQuickPanel />}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
             className={`flex items-center gap-3 p-3.5 rounded-xl text-sm border shadow-xs ${
                alert.type === "error"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : alert.type === "warning"
                  ? "bg-warning/10 text-warning border-warning/20"
                  : alert.type === "info"
                  ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 border-blue-200 dark:border-blue-800/40"
                  : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
              }`}
            >
              {alert.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : alert.type === "info" ? (
                <CalendarDays className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span className="font-medium">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {!dataLoaded ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground font-amiri text-base">جاري تحميل بيانات المجمع...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Main Key Metrics */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <EightPointStar className="w-4 h-4 text-amber-500" />
              <h2 className="font-cairo font-bold text-base text-foreground">المؤشرات الرئيسية اليومية</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 sm:gap-4">
              {cards.map((card) => (
                <Card
                  key={card.title}
                  className="islamic-card cursor-pointer group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => navigate(card.href)}
                >
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-600 to-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground font-cairo">{card.title}</CardTitle>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 dark:bg-emerald-950/50">
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="text-2xl lg:text-3xl font-extrabold font-cairo tracking-tight text-foreground">{card.value}</div>
                  </CardContent>
                  <ArrowUpLeft className="w-3.5 h-3.5 text-amber-500 absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Card>
              ))}
              {canSeeStaff && staffPct !== null && (
                <Card
                  className="islamic-card cursor-pointer group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => navigate("/staff-attendance")}
                >
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground font-cairo">حضور الموظفين</CardTitle>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                      <Briefcase className={`w-4 h-4 ${staffPct >= 90 ? 'text-success' : staffPct >= 70 ? 'text-warning' : 'text-destructive'}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className={`text-2xl lg:text-3xl font-extrabold font-cairo ${staffPct >= 90 ? 'text-success' : staffPct >= 70 ? 'text-warning' : 'text-destructive'}`}>
                      {staffPct}%
                    </div>
                  </CardContent>
                  <ArrowUpLeft className="w-3.5 h-3.5 text-amber-500 absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Card>
              )}
              {planStats && planStats.total > 0 && (isManager || isSupervisor) && (
                <Card
                  className="islamic-card cursor-pointer group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => navigate("/madarij")}
                >
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-amber-300 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground font-cairo">الخطط السنوية</CardTitle>
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <CalendarDays className={`w-4 h-4 ${planStats.onTrack === planStats.total ? 'text-success' : 'text-warning'}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="text-2xl lg:text-3xl font-extrabold font-cairo">{planStats.onTrack}/{planStats.total}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">طالب منتظم</p>
                  </CardContent>
                  <ArrowUpLeft className="w-3.5 h-3.5 text-amber-500 absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Card>
              )}
              {pendingRequests > 0 && (
                <Card
                  className="islamic-card cursor-pointer group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => navigate("/internal-requests", { state: { defaultTab: isManager || isSupervisor ? "admin" : "inbox" } })}
                >
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground font-cairo">الطلبات المعلقة</CardTitle>
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <ScrollText className="w-4 h-4 text-warning" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="text-2xl lg:text-3xl font-extrabold font-cairo text-warning">{pendingRequests}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">طلب بانتظار الإجراء</p>
                  </CardContent>
                  <ArrowUpLeft className="w-3.5 h-3.5 text-amber-500 absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Card>
              )}
            </div>
          </div>

          <IslamicDivider variant="gold" title="سجلات الحضور والتسميع اليومية" />

          {/* Daily Attendance Summary */}
          <DailyAttendanceSummary />

          <IslamicDivider variant="emerald" title="التحليلات والإحصاءات الشاملة" />

          {/* Student Analytics Section */}
          <StudentAnalytics />
          <AttendanceAnalytics />
          <HalaqatAnalytics />
          <QuizAnalytics />

          {!isMobile && (
            <div className="grid lg:grid-cols-2 gap-6 pt-2">
              <Card className="islamic-card">
                <CardHeader className="border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <EightPointStar className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-base font-bold font-cairo">آخر التسميعات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <RecentRecitations />
                </CardContent>
              </Card>
              <Card className="islamic-card">
                <CardHeader className="border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <EightPointStar className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-base font-bold font-cairo">التعليمات الجديدة</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
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
