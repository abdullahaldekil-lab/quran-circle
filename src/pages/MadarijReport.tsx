import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileSpreadsheet, FileText, Users, CheckCircle, Activity, TrendingDown, Award, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import StudentNameLink from "@/components/StudentNameLink";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateHijriOnly } from "@/lib/hijri";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const MadarijReport = () => {
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [levelChanges, setLevelChanges] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [enrollRes, examsRes, changesRes, tracksRes] = await Promise.all([
      supabase.from("madarij_enrollments").select("*, students(full_name, halaqa_id, halaqat(name)), madarij_tracks!madarij_enrollments_track_id_fkey(name, days_required)"),
      supabase.from("madarij_hizb_exams").select("*, madarij_enrollments(student_id, students(full_name, halaqat(name)), madarij_tracks!madarij_enrollments_track_id_fkey(name))").eq("exam_type", "official"),
      supabase.from("madarij_level_changes" as any).select("*, students(full_name), old_track:madarij_tracks!madarij_level_changes_old_track_id_fkey(name), new_track:madarij_tracks!madarij_level_changes_new_track_id_fkey(name)"),
      supabase.from("madarij_tracks").select("*").eq("active", true),
    ]);
    setEnrollments(enrollRes.data || []);
    setExams(examsRes.data || []);
    setLevelChanges(changesRes.data || []);
    setTracks(tracksRes.data || []);
    setLoading(false);
  };

  // === Summary Stats ===
  const totalEnrollments = enrollments.length;
  const activeEnrollments = enrollments.filter(e => e.status === "active").length;
  const completedEnrollments = enrollments.filter(e => e.status === "completed").length;
  const successRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;
  const downgradedCount = enrollments.filter(e => e.level_downgraded).length;
  const avgGrade = exams.length > 0 ? Math.round(exams.reduce((s, e) => s + (e.final_grade || 0), 0) / exams.length) : 0;

  // === Halaqa Analysis ===
  const halaqaMap = new Map<string, { name: string; total: number; active: number; completed: number; grades: number[] }>();
  enrollments.forEach(e => {
    const hName = (e.students as any)?.halaqat?.name || "غير محدد";
    const hId = (e.students as any)?.halaqa_id || "unknown";
    if (!halaqaMap.has(hId)) halaqaMap.set(hId, { name: hName, total: 0, active: 0, completed: 0, grades: [] });
    const h = halaqaMap.get(hId)!;
    h.total++;
    if (e.status === "active") h.active++;
    if (e.status === "completed") h.completed++;
  });
  exams.forEach(ex => {
    const studentId = (ex.madarij_enrollments as any)?.student_id;
    const enrollment = enrollments.find(e => e.student_id === studentId);
    if (enrollment) {
      const hId = (enrollment.students as any)?.halaqa_id || "unknown";
      halaqaMap.get(hId)?.grades.push(ex.final_grade || 0);
    }
  });
  const halaqaData = Array.from(halaqaMap.values()).map(h => ({
    ...h,
    rate: h.total > 0 ? Math.round((h.completed / h.total) * 100) : 0,
    avgGrade: h.grades.length > 0 ? Math.round(h.grades.reduce((a, b) => a + b, 0) / h.grades.length) : 0,
  }));

  // === Track Analysis ===
  const trackMap = new Map<string, { name: string; total: number; completed: number; days: number[] }>();
  tracks.forEach(t => trackMap.set(t.id, { name: t.name, total: 0, completed: 0, days: [] }));
  enrollments.forEach(e => {
    const t = trackMap.get(e.track_id);
    if (t) {
      t.total++;
      if (e.status === "completed") {
        t.completed++;
        if (e.start_date && e.end_date) {
          const days = Math.ceil((new Date(e.end_date).getTime() - new Date(e.start_date).getTime()) / 86400000);
          t.days.push(days);
        }
      }
    }
  });
  const trackData = Array.from(trackMap.values()).map(t => ({
    ...t,
    rate: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0,
    avgDays: t.days.length > 0 ? Math.round(t.days.reduce((a, b) => a + b, 0) / t.days.length) : 0,
  }));
  const donutData = trackData.filter(t => t.total > 0).map(t => ({ name: t.name, value: t.total }));

  // === Monthly Registrations (last 6 months) ===
  const monthlyData: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = formatDateHijriOnly(d);
    const count = enrollments.filter(e => e.created_at?.startsWith(key)).length;
    monthlyData.push({ month: label, count });
  }

  // === Grade Distribution ===
  const excellent = exams.filter(e => e.final_grade >= 80).length;
  const good = exams.filter(e => e.final_grade >= 60 && e.final_grade < 80).length;
  const failed = exams.filter(e => e.final_grade < 60).length;
  const gradeDistribution = [
    { name: "ممتاز (≥80)", value: excellent },
    { name: "جيد (60-79)", value: good },
    { name: "راسب (<60)", value: failed },
  ];

  // === Top 10 Students ===
  const passedExams = exams.filter(e => e.passed);
  const topStudents = passedExams
    .sort((a, b) => (b.final_grade || 0) - (a.final_grade || 0))
    .slice(0, 10);

  // === Export ===
  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    const summarySheet = XLSX.utils.json_to_sheet([
      { "البند": "إجمالي المسجلين", "القيمة": totalEnrollments },
      { "البند": "النشطون", "القيمة": activeEnrollments },
      { "البند": "المكتملون", "القيمة": completedEnrollments },
      { "البند": "نسبة النجاح%", "القيمة": successRate },
      { "البند": "نزول المستوى", "القيمة": downgradedCount },
      { "البند": "متوسط الدرجة", "القيمة": avgGrade },
    ]);
    const halaqaSheet = XLSX.utils.json_to_sheet(halaqaData.map(h => ({
      "الحلقة": h.name, "الطلاب": h.total, "المكتملون": h.completed, "النشطون": h.active,
      "نسبة الإنجاز%": h.rate, "متوسط الدرجة": h.avgGrade,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summarySheet, "ملخص");
    XLSX.utils.book_append_sheet(wb, halaqaSheet, "الحلقات");
    XLSX.writeFile(wb, "تقرير_مدارج.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("Madarij Report", 105, 15, { align: "center" });
    autoTable(doc, {
      startY: 25,
      head: [["Item", "Value"]],
      body: [
        ["Total Enrolled", String(totalEnrollments)],
        ["Active", String(activeEnrollments)],
        ["Completed", String(completedEnrollments)],
        ["Success Rate", successRate + "%"],
        ["Downgraded", String(downgradedCount)],
        ["Avg Grade", String(avgGrade)],
      ],
    });
    doc.save("madarij_report.pdf");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" ref={printRef}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">تقارير برنامج مدارج</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}><FileSpreadsheet className="w-4 h-4 ml-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="w-4 h-4 ml-1" />PDF</Button>
        </div>
      </div>

      {/* Section 1: Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "إجمالي المسجلين", value: totalEnrollments, icon: Users, color: "text-primary" },
          { label: "التسجيلات النشطة", value: activeEnrollments, icon: Activity, color: "text-chart-2" },
          { label: "المكتملة", value: completedEnrollments, icon: CheckCircle, color: "text-chart-3" },
          { label: "نسبة النجاح%", value: successRate + "%", icon: Award, color: "text-chart-4" },
          { label: "نزول المستوى", value: downgradedCount, icon: TrendingDown, color: "text-destructive" },
          { label: "متوسط الدرجة", value: avgGrade, icon: BarChart3, color: "text-chart-5" },
        ].map((card, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <card.icon className={`w-6 h-6 mx-auto mb-1 ${card.color}`} />
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 2: Halaqa Analysis */}
      <Card>
        <CardHeader><CardTitle className="text-base">تحليلات الحلقات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الحلقة</TableHead>
                  <TableHead>الطلاب</TableHead>
                  <TableHead>المكتملون</TableHead>
                  <TableHead>النشطون</TableHead>
                  <TableHead>نسبة الإنجاز%</TableHead>
                  <TableHead>متوسط الدرجة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {halaqaData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : halaqaData.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{h.total}</TableCell>
                    <TableCell>{h.completed}</TableCell>
                    <TableCell>{h.active}</TableCell>
                    <TableCell>
                      <Badge variant={h.rate >= 70 ? "default" : h.rate >= 40 ? "secondary" : "destructive"}>{h.rate}%</Badge>
                    </TableCell>
                    <TableCell>{h.avgGrade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {halaqaData.length > 0 && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={halaqaData} layout="vertical" margin={{ right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(v: number) => v + "%"} />
                  <Bar dataKey="rate" name="نسبة الإنجاز%" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Track Analysis */}
      <Card>
        <CardHeader><CardTitle className="text-base">تحليلات المسارات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {donutData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                      {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المسار</TableHead>
                    <TableHead>المسجلون</TableHead>
                    <TableHead>المكتملون</TableHead>
                    <TableHead>النجاح%</TableHead>
                    <TableHead>متوسط الأيام</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trackData.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.total}</TableCell>
                      <TableCell>{t.completed}</TableCell>
                      <TableCell><Badge variant={t.rate >= 50 ? "default" : "destructive"}>{t.rate}%</Badge></TableCell>
                      <TableCell>{t.avgDays || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Performance Indicators */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Monthly registrations */}
        <Card>
          <CardHeader><CardTitle className="text-base">التسجيلات الشهرية (آخر 6 أشهر)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="التسجيلات" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grade distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">توزيع الدرجات</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="عدد الطلاب" radius={[4, 4, 0, 0]}>
                    <Cell fill="hsl(var(--chart-3))" />
                    <Cell fill="hsl(var(--chart-4))" />
                    <Cell fill="hsl(var(--destructive))" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Students */}
      <Card>
        <CardHeader><CardTitle className="text-base">أفضل 10 طلاب أداءً</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>الحلقة</TableHead>
                <TableHead>المسار</TableHead>
                <TableHead>الدرجة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topStudents.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
              ) : topStudents.map((ex, i) => {
                const enr = ex.madarij_enrollments as any;
                return (
                  <TableRow key={ex.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <StudentNameLink studentId={enr?.student_id} studentName={enr?.students?.full_name || "—"} />
                    </TableCell>
                    <TableCell>{enr?.students?.halaqat?.name || "—"}</TableCell>
                    <TableCell>{enr?.madarij_tracks?.name || "—"}</TableCell>
                    <TableCell><Badge>{ex.final_grade}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Level Changes */}
      {levelChanges.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-destructive">الطلاب الذين نزل مستواهم</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>المسار السابق</TableHead>
                  <TableHead>المسار الجديد</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levelChanges.map((lc: any) => (
                  <TableRow key={lc.id}>
                    <TableCell>
                      <StudentNameLink studentId={lc.student_id} studentName={lc.students?.full_name || "—"} />
                    </TableCell>
                    <TableCell>{lc.old_track?.name || "—"}</TableCell>
                    <TableCell>{lc.new_track?.name || "—"}</TableCell>
                    <TableCell>{lc.reason || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{lc.created_at?.split("T")[0]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MadarijReport;
