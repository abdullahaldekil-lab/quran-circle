import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Printer, Download, Users, Clock, UserX, FileText } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import StudentNameLink from "@/components/StudentNameLink";
import PageDateHeader from "@/components/PageDateHeader";

const STATUS_LABELS: Record<string, { label: string; color: string; symbol: string }> = {
  present: { label: "حاضر", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300", symbol: "✓" },
  absent: { label: "غائب", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300", symbol: "✗" },
  late: { label: "متأخر", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300", symbol: "⏰" },
  excused: { label: "مستأذن", color: "bg-muted text-muted-foreground", symbol: "≡" },
};

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: new Date(2024, i).toLocaleDateString("ar-SA", { month: "long" }),
}));

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const StudentAttendanceReport = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filterHalaqaId, setFilterHalaqaId] = useState<string>("all");
  const [filterStudentId, setFilterStudentId] = useState<string>("all");

  const dateObj = new Date(selectedYear, selectedMonth, 1);
  const monthStart = format(startOfMonth(dateObj), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(dateObj), "yyyy-MM-dd");

  const { data: halaqat = [] } = useQuery({
    queryKey: ["halaqat-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("halaqat").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-for-report", filterHalaqaId],
    queryFn: async () => {
      let q = supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active").order("full_name");
      if (filterHalaqaId !== "all") q = q.eq("halaqa_id", filterHalaqaId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["student-attendance-report", monthStart, monthEnd, filterHalaqaId],
    queryFn: async () => {
      let q = supabase.from("attendance").select("*").gte("attendance_date", monthStart).lte("attendance_date", monthEnd);
      if (filterHalaqaId !== "all") q = q.eq("halaqa_id", filterHalaqaId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Last 6 months attendance for trend chart
  const sixMonthsAgo = format(startOfMonth(subMonths(dateObj, 5)), "yyyy-MM-dd");
  const { data: trendAttendance = [] } = useQuery({
    queryKey: ["student-attendance-trend", filterStudentId, sixMonthsAgo, monthEnd],
    enabled: filterStudentId !== "all",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("attendance_date, status")
        .eq("student_id", filterStudentId)
        .gte("attendance_date", sixMonthsAgo)
        .lte("attendance_date", monthEnd);
      if (error) throw error;
      return data;
    },
  });

  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(dateObj), end: endOfMonth(dateObj) }).filter(d => {
      const day = getDay(d);
      return day !== 5 && day !== 6; // exclude Fri/Sat
    });
  }, [selectedMonth, selectedYear]);

  const attMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    attendance.forEach(a => {
      if (!map[a.student_id]) map[a.student_id] = {};
      map[a.student_id][a.attendance_date] = a.status;
    });
    return map;
  }, [attendance]);

  const studentSummary = useMemo(() => {
    return students.map(s => {
      const recs = attendance.filter(a => a.student_id === s.id);
      const present = recs.filter(a => a.status === "present").length;
      const late = recs.filter(a => a.status === "late").length;
      const absent = recs.filter(a => a.status === "absent").length;
      const excused = recs.filter(a => a.status === "excused").length;
      const total = monthDays.length;
      const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      return { ...s, present, late, absent, excused, pct };
    });
  }, [students, attendance, monthDays]);

  const barData = useMemo(() => {
    return studentSummary.map(s => ({
      name: s.full_name.split(" ").slice(0, 2).join(" "),
      نسبة_الحضور: s.pct,
    }));
  }, [studentSummary]);

  // Monthly trend for selected student (last 6 months)
  const trendData = useMemo(() => {
    if (filterStudentId === "all") return [];
    const months: { month: string; pct: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(dateObj, i);
      const ms = format(startOfMonth(d), "yyyy-MM-dd");
      const me = format(endOfMonth(d), "yyyy-MM-dd");
      const recs = trendAttendance.filter(a => a.attendance_date >= ms && a.attendance_date <= me);
      const workDays = eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) }).filter(dd => {
        const day = getDay(dd);
        return day !== 5 && day !== 6;
      }).length;
      const present = recs.filter(a => a.status === "present" || a.status === "late").length;
      const pct = workDays > 0 ? Math.round((present / workDays) * 100) : 0;
      months.push({ month: format(d, "MMM yyyy", { locale: ar }), pct });
    }
    return months;
  }, [filterStudentId, trendAttendance, selectedMonth, selectedYear]);

  const selectedStudent = filterStudentId !== "all" ? studentSummary.find(s => s.id === filterStudentId) : null;

  const handlePrint = () => window.print();

  const handleExportPDF = () => {
    if (!selectedStudent) return;
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        doc.addFont("Helvetica", "Helvetica", "normal");
        doc.setFont("Helvetica");

        doc.setFontSize(16);
        doc.text("Student Attendance Report", 105, 20, { align: "center" });
        doc.setFontSize(11);
        doc.text(`Student: ${selectedStudent.full_name}`, 105, 30, { align: "center" });
        doc.text(`Month: ${format(dateObj, "MMMM yyyy")}`, 105, 37, { align: "center" });

        doc.setFontSize(10);
        doc.text(`Present: ${selectedStudent.present} | Late: ${selectedStudent.late} | Absent: ${selectedStudent.absent} | Excused: ${selectedStudent.excused} | Rate: ${selectedStudent.pct}%`, 105, 47, { align: "center" });

        const tableData = monthDays.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const status = attMap[selectedStudent.id]?.[dateStr];
          return [
            format(day, "yyyy-MM-dd"),
            format(day, "EEEE", { locale: ar }),
            STATUS_LABELS[status || ""]?.label || "-",
          ];
        });

        (doc as any).autoTable({
          startY: 55,
          head: [["Date", "Day", "Status"]],
          body: tableData,
          theme: "grid",
          styles: { fontSize: 9, halign: "center" },
          headStyles: { fillColor: [34, 139, 34] },
        });

        doc.save(`attendance_${selectedStudent.full_name}_${monthStart}.pdf`);
      });
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تقرير حضور الطلاب</h1>
        <PageDateHeader />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">الحلقة</label>
              <Select value={filterHalaqaId} onValueChange={(v) => { setFilterHalaqaId(v); setFilterStudentId("all"); }}>
                <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحلقات</SelectItem>
                  {halaqat.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">الطالب</label>
              <Select value={filterStudentId} onValueChange={setFilterStudentId}>
                <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الطلاب</SelectItem>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">الشهر</label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">السنة</label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="w-7 h-7 text-primary" /><div><p className="text-xl font-bold">{students.length}</p><p className="text-xs text-muted-foreground">عدد الطلاب</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="w-7 h-7 text-emerald-500" /><div><p className="text-xl font-bold">{studentSummary.reduce((s, x) => s + x.present, 0)}</p><p className="text-xs text-muted-foreground">إجمالي الحضور</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="w-7 h-7 text-amber-500" /><div><p className="text-xl font-bold">{studentSummary.reduce((s, x) => s + x.late, 0)}</p><p className="text-xs text-muted-foreground">إجمالي التأخر</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><UserX className="w-7 h-7 text-destructive" /><div><p className="text-xl font-bold">{studentSummary.reduce((s, x) => s + x.absent, 0)}</p><p className="text-xs text-muted-foreground">إجمالي الغياب</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="halaqa-summary" dir="rtl">
        <TabsList className="print:hidden">
          <TabsTrigger value="halaqa-summary">ملخص الحلقة</TabsTrigger>
          <TabsTrigger value="individual" disabled={filterStudentId === "all"}>بيان فردي</TabsTrigger>
        </TabsList>

        {/* Tab 1: Halaqa Summary */}
        <TabsContent value="halaqa-summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>ملخص حضور طلاب الحلقة</span>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    import("xlsx-js-style").then((XLSX) => {
                      const rows = studentSummary.map(s => ({
                        "الطالب": s.full_name, "حضور": s.present, "تأخر": s.late, "غياب": s.absent, "مستأذن": s.excused, "نسبة %": s.pct,
                      }));
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "ملخص الحلقة");
                      XLSX.writeFile(wb, `ملخص_حلقة_${monthStart}.xlsx`);
                    });
                  }}><Download className="w-4 h-4 ml-1" />Excel</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-center">أيام الحضور</TableHead>
                    <TableHead className="text-center">أيام الغياب</TableHead>
                    <TableHead className="text-center">أيام التأخر</TableHead>
                    <TableHead className="text-center">مستأذن</TableHead>
                    <TableHead className="text-center">نسبة الحضور</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentSummary.map(s => (
                    <TableRow key={s.id} className={cn(
                      s.pct < 70 && "bg-amber-50 dark:bg-amber-950/20",
                      s.pct >= 90 && "bg-emerald-50 dark:bg-emerald-950/20"
                    )}>
                      <TableCell className="font-medium"><StudentNameLink studentId={s.id} studentName={s.full_name} /></TableCell>
                      <TableCell className="text-center font-bold text-emerald-600">{s.present}</TableCell>
                      <TableCell className="text-center font-bold text-destructive">{s.absent}</TableCell>
                      <TableCell className="text-center font-bold text-amber-600">{s.late}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.excused}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.pct >= 90 ? "default" : s.pct >= 70 ? "secondary" : "destructive"}>{s.pct}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {studentSummary.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">اختر حلقة لعرض البيانات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          {barData.length > 0 && (
            <Card className="print:hidden">
              <CardHeader><CardTitle>مقارنة نسب حضور الطلاب</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={11} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="نسبة_الحضور" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="نسبة الحضور %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Individual Report */}
        <TabsContent value="individual" className="space-y-6">
          {selectedStudent && (
            <>
              {/* Action buttons */}
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة البيان</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="w-4 h-4 ml-1" />تصدير PDF</Button>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-emerald-600">{selectedStudent.present}</p><p className="text-xs text-muted-foreground">حضور</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-destructive">{selectedStudent.absent}</p><p className="text-xs text-muted-foreground">غياب</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-amber-600">{selectedStudent.late}</p><p className="text-xs text-muted-foreground">تأخر</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-muted-foreground">{selectedStudent.excused}</p><p className="text-xs text-muted-foreground">مستأذن</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{selectedStudent.pct}%</p><p className="text-xs text-muted-foreground">نسبة الحضور</p></CardContent></Card>
              </div>

              {/* Daily grid for the month */}
              <Card>
                <CardHeader><CardTitle>بيان الحضور الشهري — {selectedStudent.full_name}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">اليوم</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthDays.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const status = attMap[selectedStudent.id]?.[dateStr];
                        const info = STATUS_LABELS[status || ""];
                        return (
                          <TableRow key={dateStr} className={info?.color || ""}>
                            <TableCell>{format(day, "d/M/yyyy")}</TableCell>
                            <TableCell>{format(day, "EEEE", { locale: ar })}</TableCell>
                            <TableCell className="text-center">
                              {info ? (
                                <Badge variant={status === "present" ? "default" : status === "late" ? "secondary" : status === "absent" ? "destructive" : "outline"}>
                                  {info.symbol} {info.label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Line Chart: Trend over last 6 months */}
              {trendData.length > 0 && (
                <Card className="print:hidden">
                  <CardHeader><CardTitle>تطور نسبة الحضور خلال الأشهر الماضية</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(v: number) => `${v}%`} />
                        <Line type="monotone" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="نسبة الحضور %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          {!selectedStudent && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">اختر طالباً من الفلتر أعلاه لعرض البيان الفردي</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentAttendanceReport;
