import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, Users, BookOpen, CheckCircle, AlertTriangle,
  Target, Award, DollarSign, BarChart3, Activity, Clock, Star,
} from "lucide-react";

// --- Types ---
interface KpiCard {
  label: string;
  value: string | number;
  target?: string;
  percent?: number;
  status?: "on_track" | "at_risk" | "delayed";
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}

const statusColor: Record<string, string> = {
  on_track: "bg-success/15 text-success border-success/30",
  at_risk: "bg-warning/15 text-warning border-warning/30",
  delayed: "bg-destructive/15 text-destructive border-destructive/30",
};
const statusLabel: Record<string, string> = {
  on_track: "على المسار",
  at_risk: "تحت المراقبة",
  delayed: "متأخر",
};

const KpiDashboard = () => {
  const { isManager, isSupervisor } = useRole();
  const [loading, setLoading] = useState(true);
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("all");
  const [period, setPeriod] = useState("month");

  // Raw data
  const [students, setStudents] = useState<any[]>([]);
  const [recitations, setRecitations] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchAllData();
  }, [isManager]);

  const fetchAllData = async () => {
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const [
      halaqatRes, studentsRes, recitationsRes, attendanceRes,
      goalsRes, objectivesRes, tasksRes, rewardsRes, transactionsRes,
    ] = await Promise.all([
      supabase.from("halaqat").select("id, name").eq("active", true),
      supabase.from("students").select("*").eq("status", "active"),
      supabase.from("recitation_records").select("*").gte("record_date", monthStart).lte("record_date", today),
      supabase.from("attendance").select("*").gte("attendance_date", monthStart).lte("attendance_date", today),
      supabase.from("strategic_goals").select("*"),
      supabase.from("strategic_objectives").select("*"),
      supabase.from("strategic_tasks").select("*"),
      supabase.from("reward_nominations").select("*").gte("created_at", monthStart + "T00:00:00"),
      isManager ? supabase.from("financial_transactions").select("*") : Promise.resolve({ data: [] }),
    ]);

    setHalaqat(halaqatRes.data || []);
    setStudents(studentsRes.data || []);
    setRecitations(recitationsRes.data || []);
    setAttendance(attendanceRes.data || []);
    setGoals(goalsRes.data || []);
    setObjectives(objectivesRes.data || []);
    setTasks(tasksRes.data || []);
    setRewards(rewardsRes.data || []);
    setTransactions((transactionsRes as any).data || []);
    setLoading(false);
  };

  // Filter by halaqa
  const filtered = useMemo(() => {
    if (selectedHalaqa === "all") return { students, recitations, attendance };
    return {
      students: students.filter((s) => s.halaqa_id === selectedHalaqa),
      recitations: recitations.filter((r) => r.halaqa_id === selectedHalaqa),
      attendance: attendance.filter((a) => a.halaqa_id === selectedHalaqa),
    };
  }, [selectedHalaqa, students, recitations, attendance]);

  // --- Academic KPIs ---
  const academicKpis = useMemo((): KpiCard[] => {
    const recs = filtered.recitations;
    const scores = recs.map((r) => Number(r.total_score)).filter(Boolean);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const tajweedScores = recs.map((r) => Number(r.tajweed_score)).filter(Boolean);
    const avgTajweed = tajweedScores.length ? Math.round(tajweedScores.reduce((a, b) => a + b, 0) / tajweedScores.length) : 0;
    const totalStudents = filtered.students.length;
    const studentsWithRec = new Set(recs.map((r) => r.student_id)).size;
    const completionRate = totalStudents ? Math.round((studentsWithRec / totalStudents) * 100) : 0;
    const mistakes = recs.map((r) => Number(r.mistakes_count)).filter((v) => !isNaN(v));
    const avgMistakes = mistakes.length ? (mistakes.reduce((a, b) => a + b, 0) / mistakes.length).toFixed(1) : "0";

    return [
      {
        label: "نسبة إتمام الحفظ اليومي",
        value: `${completionRate}%`,
        target: "≥ 85%",
        percent: completionRate,
        status: completionRate >= 85 ? "on_track" : completionRate >= 60 ? "at_risk" : "delayed",
        icon: BookOpen,
      },
      {
        label: "متوسط درجة الحفظ",
        value: avgScore,
        target: "≥ 80",
        percent: avgScore,
        status: avgScore >= 80 ? "on_track" : avgScore >= 60 ? "at_risk" : "delayed",
        icon: TrendingUp,
      },
      {
        label: "متوسط الأخطاء",
        value: avgMistakes,
        target: "تحسن مستمر",
        percent: Math.max(0, 100 - Number(avgMistakes) * 5),
        status: Number(avgMistakes) <= 3 ? "on_track" : Number(avgMistakes) <= 6 ? "at_risk" : "delayed",
        icon: Activity,
        trend: "down",
      },
      {
        label: "مؤشر جودة التجويد",
        value: avgTajweed,
        target: "≥ 85",
        percent: avgTajweed,
        status: avgTajweed >= 85 ? "on_track" : avgTajweed >= 70 ? "at_risk" : "delayed",
        icon: Star,
      },
    ];
  }, [filtered]);

  // --- Attendance KPIs ---
  const attendanceKpis = useMemo((): KpiCard[] => {
    const att = filtered.attendance;
    const total = att.length;
    const present = att.filter((a) => a.status === "present" || a.status === "late").length;
    const absent = att.filter((a) => a.status === "absent").length;
    const attendRate = total ? Math.round((present / total) * 100) : 0;
    const absentRate = total ? Math.round((absent / total) * 100) : 0;

    // Teacher compliance: days with recitation entries / total possible days
    const uniqueTeacherDays = new Set(filtered.recitations.map((r) => `${r.teacher_id}_${r.record_date}`)).size;
    const uniqueTeachers = new Set(filtered.recitations.map((r) => r.teacher_id)).size;
    const daysInMonth = new Date().getDate();
    const compliance = uniqueTeachers && daysInMonth ? Math.round((uniqueTeacherDays / (uniqueTeachers * daysInMonth)) * 100) : 0;

    return [
      {
        label: "نسبة حضور الطلاب",
        value: `${attendRate}%`,
        target: "≥ 90%",
        percent: attendRate,
        status: attendRate >= 90 ? "on_track" : attendRate >= 75 ? "at_risk" : "delayed",
        icon: Users,
      },
      {
        label: "نسبة الغياب غير المبرر",
        value: `${absentRate}%`,
        target: "≤ 5%",
        percent: Math.max(0, 100 - absentRate * 10),
        status: absentRate <= 5 ? "on_track" : absentRate <= 10 ? "at_risk" : "delayed",
        icon: AlertTriangle,
        trend: absentRate <= 5 ? "down" : "up",
      },
      {
        label: "التزام المعلمين بالإدخال",
        value: `${Math.min(compliance, 100)}%`,
        target: "≥ 95%",
        percent: Math.min(compliance, 100),
        status: compliance >= 95 ? "on_track" : compliance >= 80 ? "at_risk" : "delayed",
        icon: Clock,
      },
    ];
  }, [filtered]);

  // --- Student Progress KPIs ---
  const progressKpis = useMemo((): KpiCard[] => {
    const recs = filtered.recitations;
    const scores = recs.map((r) => Number(r.total_score)).filter(Boolean);
    const highPerformers = scores.filter((s) => s >= 90).length;
    const highRatio = scores.length ? Math.round((highPerformers / scores.length) * 100) : 0;
    const khatmStudents = filtered.students.filter((s) => (s.total_memorized_pages || 0) >= 604).length;

    return [
      {
        label: "نسبة المتميزين (≥90)",
        value: `${highRatio}%`,
        target: "تتزايد",
        percent: highRatio,
        status: highRatio >= 30 ? "on_track" : highRatio >= 15 ? "at_risk" : "delayed",
        icon: Award,
      },
      {
        label: "عدد الطلاب ختموا القرآن",
        value: khatmStudents,
        target: "متتبع سنوياً",
        percent: null as any,
        icon: CheckCircle,
        status: "on_track",
      },
    ];
  }, [filtered]);

  // --- Strategic KPIs ---
  const strategicKpis = useMemo((): KpiCard[] => {
    const avgGoalProgress = goals.length ? Math.round(goals.reduce((a, g) => a + (g.progress_percentage || 0), 0) / goals.length) : 0;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const taskRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const delayedObj = objectives.filter((o) => o.status === "delayed" || (o.status !== "completed" && new Date(o.end_date) < new Date())).length;

    return [
      {
        label: "تقدم الأهداف الاستراتيجية",
        value: `${avgGoalProgress}%`,
        target: "حسب الجدول",
        percent: avgGoalProgress,
        status: avgGoalProgress >= 60 ? "on_track" : avgGoalProgress >= 30 ? "at_risk" : "delayed",
        icon: Target,
      },
      {
        label: "نسبة إنجاز المهام",
        value: `${taskRate}%`,
        target: "≥ 90%",
        percent: taskRate,
        status: taskRate >= 90 ? "on_track" : taskRate >= 70 ? "at_risk" : "delayed",
        icon: CheckCircle,
      },
      {
        label: "الأهداف الفرعية المتأخرة",
        value: delayedObj,
        target: "صفر",
        percent: delayedObj === 0 ? 100 : Math.max(0, 100 - delayedObj * 20),
        status: delayedObj === 0 ? "on_track" : delayedObj <= 2 ? "at_risk" : "delayed",
        icon: AlertTriangle,
      },
    ];
  }, [goals, objectives, tasks]);

  // --- Rewards KPIs ---
  const rewardsKpis = useMemo((): KpiCard[] => {
    const approved = rewards.filter((r) => r.status === "approved").length;
    return [
      {
        label: "المكافآت الموزعة هذا الشهر",
        value: approved,
        target: "متتبع",
        percent: null as any,
        icon: Award,
        status: "on_track",
      },
      {
        label: "إجمالي الترشيحات",
        value: rewards.length,
        target: "متتبع",
        percent: null as any,
        icon: Star,
        status: "on_track",
      },
    ];
  }, [rewards]);

  // --- Financial KPIs (manager only) ---
  const financialKpis = useMemo((): KpiCard[] => {
    if (!isManager) return [];
    const approved = transactions.filter((t: any) => t.status === "approved");
    const income = approved.filter((t: any) => t.transaction_type === "income").reduce((a: number, t: any) => a + Number(t.amount), 0);
    const expense = approved.filter((t: any) => t.transaction_type === "expense").reduce((a: number, t: any) => a + Number(t.amount), 0);
    const balance = income - expense;

    return [
      {
        label: "الرصيد الشهري",
        value: `${balance.toLocaleString()} ر.س`,
        target: "موجب",
        percent: balance > 0 ? 100 : 30,
        status: balance > 0 ? "on_track" : "delayed",
        icon: DollarSign,
      },
      {
        label: "إجمالي الإيرادات",
        value: `${income.toLocaleString()} ر.س`,
        percent: null as any,
        icon: TrendingUp,
        status: "on_track",
      },
      {
        label: "إجمالي المصروفات",
        value: `${expense.toLocaleString()} ر.س`,
        percent: null as any,
        icon: TrendingDown,
        status: income > 0 && expense > income ? "delayed" : "on_track",
      },
    ];
  }, [transactions, isManager]);

  // --- Alerts ---
  const alerts = useMemo(() => {
    const items: { message: string; type: "warning" | "error" }[] = [];
    academicKpis.forEach((k) => {
      if (k.status === "delayed") items.push({ message: `${k.label}: ${k.value} (الهدف: ${k.target})`, type: "error" });
      else if (k.status === "at_risk") items.push({ message: `${k.label}: ${k.value} (الهدف: ${k.target})`, type: "warning" });
    });
    attendanceKpis.forEach((k) => {
      if (k.status === "delayed") items.push({ message: `${k.label}: ${k.value}`, type: "error" });
    });
    const delayedGoals = goals.filter((g) => g.status === "delayed" || (g.progress_percentage < 20 && g.is_activated));
    delayedGoals.forEach((g) => items.push({ message: `هدف استراتيجي متأخر: ${g.title}`, type: "error" }));
    return items;
  }, [academicKpis, attendanceKpis, goals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sections: { id: string; label: string; kpis: KpiCard[]; show: boolean }[] = [
    { id: "academic", label: "الأداء الأكاديمي", kpis: academicKpis, show: true },
    { id: "attendance", label: "الحضور والالتزام", kpis: attendanceKpis, show: true },
    { id: "progress", label: "تقدم الطلاب", kpis: progressKpis, show: true },
    { id: "strategic", label: "الخطة الاستراتيجية", kpis: strategicKpis, show: isManager || isSupervisor },
    { id: "rewards", label: "الحوافز والتحفيز", kpis: rewardsKpis, show: true },
    { id: "financial", label: "المؤشرات المالية", kpis: financialKpis, show: isManager || isSupervisor },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            لوحة مؤشرات الأداء
          </h1>
          <p className="text-muted-foreground mt-1">مجمع حويلان لتحفيظ القرآن الكريم</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="جميع الحلقات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحلقات</SelectItem>
              {halaqat.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 5).map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                alert.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-warning"
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all">نظرة شاملة</TabsTrigger>
          {sections.filter((s) => s.show).map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* All KPIs tab */}
        <TabsContent value="all" className="space-y-6">
          {sections.filter((s) => s.show && s.kpis.length > 0).map((section) => (
            <div key={section.id}>
              <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                {section.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {section.kpis.map((kpi, i) => (
                  <KpiCardComponent key={i} kpi={kpi} />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Individual tabs */}
        {sections.filter((s) => s.show).map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <h2 className="text-lg font-bold text-foreground mb-4">{section.label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.kpis.map((kpi, i) => (
                <KpiCardComponent key={i} kpi={kpi} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

const KpiCardComponent = ({ kpi }: { kpi: KpiCard }) => {
  const Icon = kpi.icon;
  const status = kpi.status || "on_track";

  return (
    <Card className="animate-slide-in">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
            {kpi.label}
          </CardTitle>
          <Icon className="w-5 h-5 text-primary shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-foreground">{kpi.value}</span>
          <Badge variant="outline" className={`text-xs ${statusColor[status]}`}>
            {statusLabel[status]}
          </Badge>
        </div>
        {kpi.percent != null && (
          <Progress value={Math.min(kpi.percent, 100)} className="h-2" />
        )}
        {kpi.target && (
          <p className="text-xs text-muted-foreground">الهدف: {kpi.target}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default KpiDashboard;
