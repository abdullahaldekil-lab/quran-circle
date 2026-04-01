import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Target, BookOpen, TrendingUp, AlertTriangle, CheckCircle, Rocket, Printer, FileText, RefreshCw, ArrowRight } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PLAN_LABELS: Record<string, string> = {
  silver: "🥈 المسار الفضي",
  gold: "🥇 المسار الذهبي",
  custom: "⚙️ مخصص",
};

const StudentAnnualPlan = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { isManager, isSupervisor, isTeacher } = useRole();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [plan, setPlan] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [editingMonth, setEditingMonth] = useState<any>(null);
  const [actualPages, setActualPages] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!studentId) return;
    setLoading(true);

    // Get the active plan for this student
    const { data: plans } = await supabase
      .from("student_annual_plans")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    const activePlan = plans?.[0];
    if (!activePlan) {
      setLoading(false);
      return;
    }
    setPlan(activePlan);

    // Fetch student and progress in parallel
    const [studentRes, progressRes] = await Promise.all([
      supabase.from("students").select("full_name, halaqat(name)").eq("id", studentId).single(),
      supabase.from("student_plan_progress").select("*").eq("plan_id", activePlan.id).order("month_number"),
    ]);

    setStudent(studentRes.data);
    setProgress(progressRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [studentId]);

  const totalActual = progress.reduce((s, p) => s + (p.actual_pages || 0), 0);
  const totalTarget = plan?.total_target_pages || 0;
  const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
  const remaining = totalTarget - totalActual;

  // Determine current month index based on today
  const currentMonthIndex = progress.findIndex((p, i) => {
    if (i === progress.length - 1) return true;
    // Target accumulated up to this month vs next
    return p.actual_pages === 0 || i === progress.length - 1;
  });

  // Calculate expected progress up to now
  const monthsElapsed = progress.filter((_, i) => i <= currentMonthIndex).length;
  const expectedPages = progress.slice(0, monthsElapsed).reduce((s, p) => s + p.target_pages, 0);
  const commitmentPct = expectedPages > 0 ? Math.round((totalActual / expectedPages) * 100) : 100;

  const getStatus = () => {
    if (commitmentPct >= 100) return { label: "متقدم", icon: <Rocket className="w-5 h-5" />, color: "text-primary", bg: "bg-primary/10" };
    if (commitmentPct >= 85) return { label: "على المسار", icon: <CheckCircle className="w-5 h-5" />, color: "text-success", bg: "bg-success/10" };
    return { label: "متأخر", icon: <AlertTriangle className="w-5 h-5" />, color: "text-warning", bg: "bg-warning/10" };
  };

  const status = getStatus();

  // Chart data
  const chartData = progress.map((p, i) => {
    const cumulativeTarget = progress.slice(0, i + 1).reduce((s, m) => s + m.target_pages, 0);
    const cumulativeActual = progress.slice(0, i + 1).reduce((s, m) => s + (m.actual_pages || 0), 0);
    return {
      name: `شهر ${p.month_number}`,
      الهدف_التراكمي: cumulativeTarget,
      المنجز_الفعلي: cumulativeActual,
    };
  });

  const openUpdate = (monthRow: any) => {
    setEditingMonth(monthRow);
    setActualPages(monthRow.actual_pages || 0);
    setUpdateDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingMonth) return;
    setSaving(true);
    const pct = editingMonth.target_pages > 0 ? Math.round((actualPages / editingMonth.target_pages) * 100) : 0;
    const rowStatus = pct >= 100 ? "ahead" : pct >= 70 ? "on_track" : "behind";

    const { error } = await supabase
      .from("student_plan_progress")
      .update({ actual_pages: actualPages, commitment_percentage: pct, status: rowStatus })
      .eq("id", editingMonth.id);

    if (error) {
      toast.error("خطأ في التحديث");
    } else {
      toast.success("تم تحديث المنجز");
      setUpdateDialogOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleRecoveryPlan = async () => {
    const futureMonths = progress.filter((_, i) => i >= monthsElapsed);
    if (futureMonths.length === 0) { toast.error("لا توجد أشهر متبقية"); return; }

    const pagesPerMonth = Math.ceil(remaining / futureMonths.length);
    for (const m of futureMonths) {
      await supabase.from("student_plan_progress").update({ target_pages: pagesPerMonth }).eq("id", m.id);
    }
    toast.success("تم إنشاء خطة تعويضية");
    fetchData();
  };

  // Send guardian alert
  const sendGuardianAlert = async () => {
    if (!studentId) return;
    try {
      const { data: links } = await supabase
        .from("guardian_students")
        .select("guardian_id")
        .eq("student_id", studentId)
        .eq("active", true);

      for (const link of links || []) {
        await supabase.from("notifications").insert({
          user_id: link.guardian_id,
          title: "تنبيه: تأخر في الخطة السنوية",
          body: `الطالب ${student?.full_name} متأخر عن خطته السنوية بنسبة التزام ${commitmentPct}%. يرجى المتابعة.`,
          channel: "inApp",
          status: "pending",
        });
      }
      toast.success("تم إرسال إشعار لولي الأمر");
    } catch {
      toast.error("خطأ في إرسال الإشعار");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text(`الخطة السنوية - ${student?.full_name || ""}`, 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`${PLAN_LABELS[plan?.plan_type] || ""} | ${plan?.academic_year}`, 105, 28, { align: "center" });
    doc.text(`نسبة الإنجاز: ${overallPct}% | المنجز: ${totalActual} / ${totalTarget}`, 105, 35, { align: "center" });

    autoTable(doc, {
      startY: 42,
      head: [["#", "الشهر", "أيام العمل", "الهدف", "المنجز", "الالتزام%", "الحالة"]],
      body: progress.map((p) => [
        p.month_number,
        `شهر ${p.month_number}`,
        p.attendance_days,
        p.target_pages,
        p.actual_pages,
        p.target_pages > 0 ? `${Math.round((p.actual_pages / p.target_pages) * 100)}%` : "—",
        p.status === "ahead" ? "متقدم" : p.status === "on_track" ? "على المسار" : "متأخر",
      ]),
      styles: { font: "helvetica", fontSize: 9, halign: "center" },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`خطة_سنوية_${student?.full_name || "student"}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-20 space-y-4">
        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground" />
        <p className="text-lg font-semibold">لا توجد خطة سنوية نشطة لهذا الطالب</p>
        <Button variant="outline" onClick={() => navigate(-1)}>العودة</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4" ref={printRef}>
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">الخطة السنوية</h1>
          <p className="text-sm text-muted-foreground">{student?.full_name} — {(student?.halaqat as any)?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="w-4 h-4 ml-1" />تصدير PDF</Button>
        </div>
      </div>

      {/* Alerts */}
      {commitmentPct < 50 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>تنبيه عاجل</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>نسبة التزام الطالب {commitmentPct}% — متأخر بشكل كبير عن خطته</span>
            <Button size="sm" variant="destructive" onClick={sendGuardianAlert} className="print:hidden">إشعار ولي الأمر</Button>
          </AlertDescription>
        </Alert>
      )}
      {commitmentPct >= 50 && commitmentPct < 70 && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">تنبيه</AlertTitle>
          <AlertDescription>نسبة التزام الطالب {commitmentPct}% — الطالب متأخر عن خطته</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="flex items-center gap-3 mb-2">
        <Badge variant="secondary" className="text-sm">{PLAN_LABELS[plan.plan_type]}</Badge>
        <Badge variant="outline" className="text-sm">{plan.academic_year}</Badge>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
          {status.icon}
          {status.label}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>التقدم الكلي</span>
          <span className="font-bold">{totalActual} / {totalTarget} وجه ({overallPct}%)</span>
        </div>
        <Progress value={overallPct} className="h-3" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-6 h-6 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalTarget}</p>
            <p className="text-xs text-muted-foreground">إجمالي المستهدف</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto mb-1 text-success" />
            <p className="text-2xl font-bold">{totalActual}</p>
            <p className="text-xs text-muted-foreground">المنجز فعلياً</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="w-6 h-6 mx-auto mb-1 text-warning" />
            <p className="text-2xl font-bold">{remaining}</p>
            <p className="text-xs text-muted-foreground">المتبقي</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{commitmentPct}%</p>
            <p className="text-xs text-muted-foreground">نسبة الالتزام</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">الرسم البياني التراكمي</CardTitle></CardHeader>
        <CardContent className="print:hidden">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="الهدف_التراكمي" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} name="الهدف التراكمي" />
              <Area type="monotone" dataKey="المنجز_الفعلي" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.2} strokeWidth={2} name="المنجز الفعلي" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">المتابعة الشهرية</CardTitle>
          {commitmentPct < 70 && isManager && (
            <Button size="sm" variant="outline" onClick={handleRecoveryPlan} className="print:hidden">
              <RefreshCw className="w-4 h-4 ml-1" />خطة تعويضية
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>أيام العمل</TableHead>
                <TableHead>الهدف</TableHead>
                <TableHead>المنجز</TableHead>
                <TableHead>الالتزام%</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="print:hidden">تحديث</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {progress.map((p, i) => {
                const rowPct = p.target_pages > 0 ? Math.round((p.actual_pages / p.target_pages) * 100) : 0;
                const isCurrent = i === currentMonthIndex;
                return (
                  <TableRow key={p.id} className={isCurrent ? "bg-primary/5 font-medium" : ""}>
                    <TableCell>{p.month_number}</TableCell>
                    <TableCell>{p.attendance_days}</TableCell>
                    <TableCell>{p.target_pages}</TableCell>
                    <TableCell className="font-bold">{p.actual_pages}</TableCell>
                    <TableCell>
                      <Badge variant={rowPct >= 85 ? "default" : rowPct >= 70 ? "secondary" : "destructive"} className="text-xs">
                        {rowPct}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.status === "ahead" && <span className="text-primary text-xs">🚀 متقدم</span>}
                      {p.status === "on_track" && <span className="text-success text-xs">✅ على المسار</span>}
                      {p.status === "behind" && <span className="text-destructive text-xs">⚠️ متأخر</span>}
                    </TableCell>
                    <TableCell className="print:hidden">
                      <Button variant="ghost" size="sm" onClick={() => openUpdate(p)}>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تحديث المنجز — شهر {editingMonth?.month_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              الهدف الشهري: <span className="font-bold text-foreground">{editingMonth?.target_pages} وجه</span>
            </div>
            <div className="space-y-2">
              <Label>الأوجه المنجزة فعلياً</Label>
              <Input type="number" min={0} value={actualPages} onChange={(e) => setActualPages(Number(e.target.value))} />
            </div>
            <Button onClick={handleUpdate} disabled={saving} className="w-full">
              {saving ? "جارٍ الحفظ..." : "حفظ التحديث"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentAnnualPlan;
