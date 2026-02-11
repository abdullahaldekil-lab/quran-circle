import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, ClipboardList, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

const Dashboard = () => {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({ students: 0, halaqat: 0, todayRecitations: 0, avgScore: 0 });
  const [alerts, setAlerts] = useState<{ type: string; message: string }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [studentsRes, halaqatRes, recitationsRes, allStudentsRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("halaqat").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("recitation_records").select("total_score").eq("record_date", today),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      const scores = recitationsRes.data?.map((r) => Number(r.total_score)).filter(Boolean) || [];
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      setStats({
        students: studentsRes.count || 0,
        halaqat: halaqatRes.count || 0,
        todayRecitations: recitationsRes.data?.length || 0,
        avgScore: Math.round(avg),
      });

      // Generate alerts
      const newAlerts: { type: string; message: string }[] = [];
      const totalStudents = allStudentsRes.count || 0;
      const todayCount = recitationsRes.data?.length || 0;

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
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "عدد الطلاب", value: stats.students, icon: Users, color: "text-primary" },
    { title: "الحلقات", value: stats.halaqat, icon: BookOpen, color: "text-secondary" },
    { title: "تسميعات اليوم", value: stats.todayRecitations, icon: ClipboardList, color: "text-info" },
    { title: "متوسط الدرجات", value: stats.avgScore, icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          مرحباً {profile?.full_name || ""}
        </h1>
        <p className="text-muted-foreground mt-1">مجمع حويلان لتحفيظ القرآن الكريم</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="animate-slide-in">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hide detailed sections on mobile for performance */}
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
    </div>
  );
};

const RecentRecitations = () => {
  const [records, setRecords] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("recitation_records")
      .select("*, students(full_name), halaqat(name)")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecords(data || []));
  }, []);

  if (!records.length) return <p className="text-muted-foreground text-sm">لا توجد تسميعات حتى الآن</p>;

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <p className="font-medium text-sm">{r.students?.full_name}</p>
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
  useEffect(() => {
    supabase
      .from("instructions")
      .select("*")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setItems(data || []));
  }, []);

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
