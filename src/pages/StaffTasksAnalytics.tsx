import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageDateHeader } from "@/components/PageDateHeader";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Zap, ListChecks, Download } from "lucide-react";
import { format, subDays, subMonths, startOfWeek, endOfWeek, isAfter, isBefore, parseISO } from "date-fns";
import { formatDateHijriOnly } from "@/lib/hijri";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

type Task = {
  id: string; title: string; category: string; priority: string; status: string;
  assigned_by: string | null; assigned_to: string | null; assigned_to_role: string | null;
  due_date: string | null; due_time: string | null;
  started_at: string | null; completed_at: string | null;
  estimated_minutes: number | null; actual_minutes: number | null;
  created_at: string;
};

const DONUT_COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))",
  "hsl(210, 70%, 50%)", "hsl(30, 80%, 55%)", "hsl(150, 60%, 45%)",
];

const StaffTasksAnalytics = () => {
  const [period, setPeriod] = useState("month");

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === "week") return subDays(now, 7);
    if (period === "month") return subMonths(now, 1);
    return subMonths(now, 3);
  }, [period]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks-analytics", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_tasks")
        .select("*")
        .gte("created_at", periodStart.toISOString())
        .order("created_at", { ascending: false });
      return (data || []) as Task[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["staff-profiles-analytics"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
      return data || [];
    },
  });

  const getProfileName = (id: string | null) => profiles.find(p => p.id === id)?.full_name || "غير معروف";

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed");
    const onTime = completed.filter(t => {
      if (!t.due_date || !t.completed_at) return true;
      return new Date(t.completed_at) <= new Date(t.due_date + "T23:59:59");
    });
    const overdue = tasks.filter(t => {
      if (t.status === "overdue") return true;
      if (t.status === "completed" && t.due_date && t.completed_at) {
        return new Date(t.completed_at) > new Date(t.due_date + "T23:59:59");
      }
      if (t.status !== "completed" && t.status !== "cancelled" && t.due_date) {
        return new Date(t.due_date) < new Date();
      }
      return false;
    });
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    const avgMinutes = completed.length > 0
      ? completed.reduce((s, t) => s + (t.actual_minutes || 0), 0) / completed.filter(t => t.actual_minutes).length
      : 0;
    const urgentPending = tasks.filter(t => t.priority === "عاجل" && (t.status === "pending" || t.status === "in_progress"));

    return {
      total, completed: completed.length, onTime: onTime.length,
      overdue: overdue.length, completionRate,
      avgHours: avgMinutes ? (avgMinutes / 60).toFixed(1) : "0",
      urgentPending: urgentPending.length,
    };
  }, [tasks]);

  // Per-staff performance
  const staffPerformance = useMemo(() => {
    const map: Record<string, { total: number; completed: number; overdue: number; totalMinutes: number; countWithMinutes: number }> = {};
    tasks.forEach(t => {
      const uid = t.assigned_to;
      if (!uid) return;
      if (!map[uid]) map[uid] = { total: 0, completed: 0, overdue: 0, totalMinutes: 0, countWithMinutes: 0 };
      map[uid].total++;
      if (t.status === "completed") {
        map[uid].completed++;
        if (t.actual_minutes) { map[uid].totalMinutes += t.actual_minutes; map[uid].countWithMinutes++; }
        if (t.due_date && t.completed_at && new Date(t.completed_at) > new Date(t.due_date + "T23:59:59")) map[uid].overdue++;
      } else if (t.status === "overdue" || (t.due_date && new Date(t.due_date) < new Date() && t.status !== "cancelled")) {
        map[uid].overdue++;
      }
    });
    return Object.entries(map).map(([uid, d]) => {
      const rate = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
      const avgMin = d.countWithMinutes > 0 ? Math.round(d.totalMinutes / d.countWithMinutes) : 0;
      let rating = "يحتاج متابعة";
      if (rate >= 85) rating = "ممتاز";
      else if (rate >= 60) rating = "جيد";
      return { uid, name: getProfileName(uid), ...d, rate, avgMin, rating };
    }).sort((a, b) => b.rate - a.rate);
  }, [tasks, profiles]);

  // Bar chart: per staff
  const staffBarData = useMemo(() => {
    return staffPerformance.slice(0, 10).map(s => ({
      name: s.name.split(" ").slice(0, 2).join(" "),
      مكتملة: s.completed, متأخرة: s.overdue, معلّقة: s.total - s.completed - s.overdue,
    }));
  }, [staffPerformance]);

  // Line chart: weekly completion
  const weeklyData = useMemo(() => {
    const weeks: { label: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const ws = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 0 });
      const we = endOfWeek(ws, { weekStartsOn: 0 });
      const label = formatDateHijriOnly(ws);
      const count = tasks.filter(t => {
        if (t.status !== "completed" || !t.completed_at) return false;
        const d = parseISO(t.completed_at);
        return d >= ws && d <= we;
      }).length;
      weeks.push({ label, count });
    }
    return weeks;
  }, [tasks]);

  // Donut: by category
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach(t => { map[t.category] = (map[t.category] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  // Horizontal bar: avg time vs estimated
  const timeComparisonData = useMemo(() => {
    return staffPerformance.filter(s => s.avgMin > 0).slice(0, 8).map(s => {
      const avgEstimated = tasks.filter(t => t.assigned_to === s.uid && t.estimated_minutes).reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
      const countEst = tasks.filter(t => t.assigned_to === s.uid && t.estimated_minutes).length;
      return {
        name: s.name.split(" ").slice(0, 2).join(" "),
        فعلي: s.avgMin,
        مُقدَّر: countEst > 0 ? Math.round(avgEstimated / countEst) : 0,
      };
    });
  }, [staffPerformance, tasks]);

  // Export Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(staffPerformance.map(s => ({
      "الموظف": s.name, "إجمالي المهام": s.total, "المكتملة": s.completed,
      "المتأخرة": s.overdue, "نسبة الإنجاز%": s.rate,
      "متوسط الوقت (دقيقة)": s.avgMin, "التقييم": s.rating,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "أداء الموظفين");
    XLSX.writeFile(wb, "staff-tasks-report.xlsx");
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("تقرير تحليلات المهام", 140, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`الفترة: ${period === "week" ? "هذا الأسبوع" : period === "month" ? "هذا الشهر" : "هذا الفصل"}`, 140, 22, { align: "center" });

    autoTable(doc, {
      startY: 30,
      head: [["الموظف", "إجمالي المهام", "المكتملة", "المتأخرة", "نسبة الإنجاز%", "متوسط الوقت", "التقييم"]],
      body: staffPerformance.map(s => [s.name, s.total, s.completed, s.overdue, `${s.rate}%`, `${s.avgMin} د`, s.rating]),
      styles: { font: "helvetica", halign: "center" },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save("staff-tasks-report.pdf");
  };

  const KpiCard = ({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color?: string }) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color || ""}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">تحليلات المهام</h1>
          <PageDateHeader />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <Label className="text-xs">الفترة</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="quarter">هذا الفصل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1"><Download className="h-3 w-3" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1"><Download className="h-3 w-3" /> PDF</Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="إجمالي المهام" value={kpis.total} icon={<ListChecks className="h-5 w-5" />} />
        <KpiCard title="مكتملة في الوقت" value={kpis.onTime} icon={<CheckCircle2 className="h-5 w-5 text-primary" />} />
        <KpiCard title="متأخرة" value={kpis.overdue} icon={<AlertTriangle className="h-5 w-5 text-destructive" />} />
        <KpiCard title="نسبة الإنجاز" value={`${kpis.completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard title="متوسط الوقت (ساعات)" value={kpis.avgHours} icon={<Clock className="h-5 w-5" />} />
        <KpiCard title="عاجلة معلّقة" value={kpis.urgentPending} icon={<Zap className="h-5 w-5 text-destructive" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar: Per Staff */}
        <Card>
          <CardHeader><CardTitle className="text-sm">المهام لكل موظف</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={staffBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="مكتملة" fill="hsl(var(--primary))" />
                <Bar dataKey="متأخرة" fill="hsl(var(--destructive))" />
                <Bar dataKey="معلّقة" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Line: Weekly */}
        <Card>
          <CardHeader><CardTitle className="text-sm">تطور الإنجاز الأسبوعي</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="مهام مكتملة" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut: Category */}
        <Card>
          <CardHeader><CardTitle className="text-sm">توزيع حسب الفئة</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Horizontal Bar: Time comparison */}
        <Card>
          <CardHeader><CardTitle className="text-sm">الوقت الفعلي vs المُقدَّر (دقائق)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeComparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="فعلي" fill="hsl(var(--primary))" />
                <Bar dataKey="مُقدَّر" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">جدول الأداء الفردي</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>الموظف</TableHead>
                <TableHead>إجمالي المهام</TableHead>
                <TableHead>المكتملة</TableHead>
                <TableHead>المتأخرة</TableHead>
                <TableHead>نسبة الإنجاز</TableHead>
                <TableHead>متوسط الوقت</TableHead>
                <TableHead>التقييم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffPerformance.map((s, i) => (
                <TableRow key={s.uid}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.total}</TableCell>
                  <TableCell>{s.completed}</TableCell>
                  <TableCell>{s.overdue}</TableCell>
                  <TableCell>
                    <Badge variant={s.rate >= 85 ? "default" : s.rate >= 60 ? "secondary" : "destructive"}>
                      {s.rate}%
                    </Badge>
                  </TableCell>
                  <TableCell>{s.avgMin > 0 ? `${s.avgMin} د` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.rating === "ممتاز" ? "default" : s.rating === "جيد" ? "secondary" : "destructive"}>
                      {s.rating}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {staffPerformance.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffTasksAnalytics;
