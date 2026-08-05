import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageDateHeader from "@/components/PageDateHeader";
import {
  Users,
  UserX,
  CheckSquare,
  Briefcase,
  UserPlus,
  MessageSquare,
  ArrowUpLeft,
  AlertTriangle,
} from "lucide-react";

const withTimeout = <T,>(promise: PromiseLike<T> | Promise<T>, ms = 5000): Promise<T> => {
  const p = Promise.resolve(promise);
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
};

interface Kpis {
  activeStudents: number;
  inactiveStudents: number;
  attendancePct: number;
  staffPresent: number;
  pendingEnrollments: number;
  newMessages: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis>({
    activeStudents: 0,
    inactiveStudents: 0,
    attendancePct: 0,
    staffPresent: 0,
    pendingEnrollments: 0,
    newMessages: 0,
  });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [absentToday, setAbsentToday] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      try {
        const [
          activeRes,
          inactiveRes,
          attendanceRes,
          staffRes,
          enrollRes,
          messagesRes,
        ] = await withTimeout(
          Promise.all([
            supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
            supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "inactive"),
            supabase.from("attendance").select("status").eq("attendance_date", today),
            supabase
              .from("staff_attendance")
              .select("id", { count: "exact", head: true })
              .eq("attendance_date", today)
              .in("status", ["present", "late"]),
            supabase
              .from("enrollment_requests")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending"),
            supabase
              .from("guardian_messages")
              .select("id", { count: "exact", head: true })
              .is("replied_at", null),
          ]),
        );

        if (cancelled) return;

        const attRows = attendanceRes.data || [];
        const present = attRows.filter(
          (r: any) => r.status === "present" || r.status === "late" || r.status === "late_excused",
        ).length;
        const attendancePct = attRows.length ? Math.round((present / attRows.length) * 100) : 0;

        setKpis({
          activeStudents: activeRes.count || 0,
          inactiveStudents: inactiveRes.count || 0,
          attendancePct,
          staffPresent: staffRes.count || 0,
          pendingEnrollments: enrollRes.count || 0,
          newMessages: messagesRes.count || 0,
        });

        // Latest enrollment requests
        const { data: reqRows } = await supabase
          .from("enrollment_requests")
          .select("id, student_full_name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (!cancelled) setRecentRequests(reqRows || []);

        // Today's absences
        const { data: absentRows } = await supabase
          .from("attendance")
          .select("id, status, students(full_name), halaqat(name)")
          .eq("attendance_date", today)
          .in("status", ["absent", "excused"])
          .limit(10);
        if (!cancelled) setAbsentToday(absentRows || []);

        // Alerts
        const newAlerts: string[] = [];
        if ((inactiveRes.count || 0) > 0) {
          newAlerts.push(`${inactiveRes.count} طالب بحالة منقطع بحاجة إلى متابعة`);
        }
        if ((enrollRes.count || 0) > 0) {
          newAlerts.push(`${enrollRes.count} طلب التحاق بانتظار المراجعة`);
        }
        if ((messagesRes.count || 0) > 0) {
          newAlerts.push(`${messagesRes.count} رسالة من أولياء الأمور دون رد`);
        }
        if (attRows.length > 0 && attendancePct < 80) {
          newAlerts.push(`نسبة حضور الطلاب اليوم ${attendancePct}% — أقل من المستهدف`);
        }
        if (!cancelled) setAlerts(newAlerts);
      } catch (e) {
        console.error("AdminDashboard fetch error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { title: "الطلاب النشطون", value: kpis.activeStudents, icon: Users, color: "text-primary", href: "/students" },
    { title: "الطلاب المنقطعون", value: kpis.inactiveStudents, icon: UserX, color: "text-destructive", href: "/inactive-students" },
    { title: "حضور الطلاب اليوم", value: `${kpis.attendancePct}%`, icon: CheckSquare, color: "text-success", href: "/attendance" },
    { title: "حضور العاملين اليوم", value: kpis.staffPresent, icon: Briefcase, color: "text-info", href: "/staff-attendance" },
    { title: "طلبات الالتحاق المعلقة", value: kpis.pendingEnrollments, icon: UserPlus, color: "text-warning", href: "/enrollment-requests" },
    { title: "رسائل دون رد", value: kpis.newMessages, icon: MessageSquare, color: "text-secondary", href: "/admin/guardian-messages" },
  ];

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">لوحة الشؤون الإدارية</h1>
          <p className="text-muted-foreground text-sm mt-1">
            متابعة الطلاب والحضور والقبول والرسائل في مكان واحد
          </p>
        </div>
        <PageDateHeader />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cards.map((c) => (
              <Card
                key={c.title}
                className="cursor-pointer group relative transition-shadow hover:shadow-lg"
                onClick={() => navigate(c.href)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{c.title}</CardTitle>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value}</div>
                </CardContent>
                <ArrowUpLeft className="w-4 h-4 text-muted-foreground absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            ))}
          </div>

          {alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">تنبيهات إدارية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg p-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {a}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <Card
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => navigate("/enrollment-requests")}
            >
              <CardHeader>
                <CardTitle className="text-lg">آخر طلبات الالتحاق</CardTitle>
              </CardHeader>
              <CardContent>
                {recentRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
                ) : (
                  <div className="space-y-2">
                    {recentRequests.map((r) => (
                      <div key={r.id} className="flex items-center justify-between border-b last:border-0 py-2">
                        <span className="text-sm font-medium">{r.student_full_name || "—"}</span>
                        <Badge variant={r.status === "pending" ? "secondary" : "outline"}>
                          {r.status === "pending"
                            ? "معلق"
                            : r.status === "approved"
                            ? "مقبول"
                            : r.status === "rejected"
                            ? "مرفوض"
                            : "قائمة انتظار"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => navigate("/attendance")}
            >
              <CardHeader>
                <CardTitle className="text-lg">غياب اليوم</CardTitle>
              </CardHeader>
              <CardContent>
                {absentToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا يوجد غياب مسجل اليوم</p>
                ) : (
                  <div className="space-y-2">
                    {absentToday.map((a) => (
                      <div key={a.id} className="flex items-center justify-between border-b last:border-0 py-2">
                        <div>
                          <p className="text-sm font-medium">{a.students?.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{a.halaqat?.name || ""}</p>
                        </div>
                        <Badge variant={a.status === "absent" ? "destructive" : "secondary"}>
                          {a.status === "absent" ? "غائب" : "مستأذن"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
