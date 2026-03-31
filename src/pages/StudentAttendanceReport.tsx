import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { ar } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CalendarIcon, Printer, Download, Users, Clock, UserX } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import StudentNameLink from "@/components/StudentNameLink";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  present: { label: "حاضر", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
  absent: { label: "غائب", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
  late: { label: "متأخر", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
  excused: { label: "مستأذن", color: "bg-muted text-muted-foreground" },
};

const StudentAttendanceReport = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [filterHalaqaId, setFilterHalaqaId] = useState<string>("all");
  const [filterStudentId, setFilterStudentId] = useState<string>("all");

  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  const { data: halaqat = [] } = useQuery({
    queryKey: ["halaqat-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("halaqat").select("id, name, teacher_id").eq("active", true).order("name");
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

  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) }).filter(d => {
      const day = getDay(d);
      return day !== 5 && day !== 6;
    });
  }, [selectedMonth]);

  const filteredStudents = useMemo(() => {
    if (filterStudentId !== "all") return students.filter(s => s.id === filterStudentId);
    return students;
  }, [students, filterStudentId]);

  // Attendance map: studentId -> date -> status
  const attMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    attendance.forEach(a => {
      if (!map[a.student_id]) map[a.student_id] = {};
      map[a.student_id][a.attendance_date] = a.status;
    });
    return map;
  }, [attendance]);

  // Summary per student
  const studentSummary = useMemo(() => {
    return filteredStudents.map(s => {
      const recs = attendance.filter(a => a.student_id === s.id);
      const present = recs.filter(a => a.status === "present").length;
      const late = recs.filter(a => a.status === "late").length;
      const absent = recs.filter(a => a.status === "absent").length;
      const pct = monthDays.length > 0 ? Math.round(((present + late) / monthDays.length) * 100) : 0;
      return { ...s, present, late, absent, pct };
    });
  }, [filteredStudents, attendance, monthDays]);

  // Line chart: selected student daily attendance
  const lineData = useMemo(() => {
    if (filterStudentId === "all") return [];
    return monthDays.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const status = attMap[filterStudentId]?.[dateStr];
      return {
        day: format(day, "d"),
        حاضر: status === "present" || status === "late" ? 1 : 0,
      };
    });
  }, [filterStudentId, monthDays, attMap]);

  // Bar chart: compare students in halaqa
  const barData = useMemo(() => {
    return studentSummary.map(s => ({
      name: s.full_name.split(" ").slice(0, 2).join(" "),
      نسبة_الحضور: s.pct,
    }));
  }, [studentSummary]);

  const statusBg = (status?: string) => STATUS_LABELS[status || ""]?.color || "bg-muted/30";

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    import("xlsx-js-style").then((XLSX) => {
      const rows = studentSummary.map(s => ({
        "الطالب": s.full_name, "أيام الحضور": s.present, "أيام التأخر": s.late, "أيام الغياب": s.absent, "نسبة الحضور %": s.pct,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "حضور الطلاب");
      XLSX.writeFile(wb, `حضور_الطلاب_${monthStart}.xlsx`);
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تقرير حضور الطلاب</h1>
        <p className="text-muted-foreground">تقارير وتحليلات حضور الطلاب الشهرية</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">الشهر</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right">
                    <CalendarIcon className="ml-2 h-4 w-4" />{format(selectedMonth, "MMMM yyyy", { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedMonth} onSelect={(d) => d && setSelectedMonth(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="w-7 h-7 text-primary" /><div><p className="text-xl font-bold">{filteredStudents.length}</p><p className="text-xs text-muted-foreground">عدد الطلاب</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="w-7 h-7 text-emerald-500" /><div><p className="text-xl font-bold">{studentSummary.reduce((s, x) => s + x.present, 0)}</p><p className="text-xs text-muted-foreground">إجمالي الحضور</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="w-7 h-7 text-amber-500" /><div><p className="text-xl font-bold">{studentSummary.reduce((s, x) => s + x.late, 0)}</p><p className="text-xs text-muted-foreground">إجمالي التأخر</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><UserX className="w-7 h-7 text-destructive" /><div><p className="text-xl font-bold">{studentSummary.reduce((s, x) => s + x.absent, 0)}</p><p className="text-xs text-muted-foreground">إجمالي الغياب</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="monthly" dir="rtl">
        <TabsList className="print:hidden">
          <TabsTrigger value="monthly">الجدول الشهري</TabsTrigger>
          <TabsTrigger value="summary">ملخص الحضور</TabsTrigger>
          <TabsTrigger value="individual" disabled={filterStudentId === "all"}>بيان فردي</TabsTrigger>
          <TabsTrigger value="charts">الرسوم البيانية</TabsTrigger>
        </TabsList>

        {/* Monthly Grid */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="w-4 h-4 ml-1" />Excel</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right sticky right-0 bg-background z-10 min-w-[120px]">الطالب</TableHead>
                    {monthDays.map(day => (
                      <TableHead key={day.toISOString()} className="text-center min-w-[40px] px-1">
                        <div className="text-xs">{format(day, "d")}</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentSummary.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium sticky right-0 bg-background z-10">
<StudentNameLink studentId={s.id} studentName={s.full_name} />
                      </TableCell>
                      {monthDays.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const status = attMap[s.id]?.[dateStr];
                        const label = status === "present" ? "✓" : status === "absent" ? "✗" : status === "late" ? "⏰" : "—";
                        return (
                          <TableCell key={dateStr} className={cn("text-center text-xs px-1", statusBg(status))}>
                            {label}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <Badge variant={s.pct >= 90 ? "default" : s.pct >= 70 ? "secondary" : "destructive"}>{s.pct}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-center">أيام الحضور</TableHead>
                    <TableHead className="text-center">أيام التأخر</TableHead>
                    <TableHead className="text-center">أيام الغياب</TableHead>
                    <TableHead className="text-center">نسبة الحضور</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentSummary.map(s => (
                    <TableRow key={s.id} className={cn(s.pct < 70 && "bg-amber-50 dark:bg-amber-950/20", s.pct >= 90 && "bg-emerald-50 dark:bg-emerald-950/20")}>
                      <TableCell className="font-medium"><StudentNameLink id={s.id} name={s.full_name} /></TableCell>
                      <TableCell className="text-center font-bold text-emerald-600">{s.present}</TableCell>
                      <TableCell className="text-center font-bold text-amber-600">{s.late}</TableCell>
                      <TableCell className="text-center font-bold text-destructive">{s.absent}</TableCell>
                      <TableCell className="text-center"><Badge variant={s.pct >= 90 ? "default" : s.pct >= 70 ? "secondary" : "destructive"}>{s.pct}%</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual Tab */}
        <TabsContent value="individual" className="space-y-4">
          {filterStudentId !== "all" && (() => {
            const s = studentSummary.find(x => x.id === filterStudentId);
            if (!s) return null;
            return (
              <>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة البيان</Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-emerald-600">{s.present}</p><p className="text-xs text-muted-foreground">أيام حضور</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-amber-600">{s.late}</p><p className="text-xs text-muted-foreground">أيام تأخر</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-destructive">{s.absent}</p><p className="text-xs text-muted-foreground">أيام غياب</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{s.pct}%</p><p className="text-xs text-muted-foreground">نسبة الحضور</p></CardContent></Card>
                </div>
                <Card>
                  <CardHeader><CardTitle>بيان الحضور الشهري - {s.full_name}</CardTitle></CardHeader>
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
                          const status = attMap[s.id]?.[dateStr];
                          return (
                            <TableRow key={dateStr} className={statusBg(status)}>
                              <TableCell>{format(day, "d/M")}</TableCell>
                              <TableCell>{format(day, "EEEE", { locale: ar })}</TableCell>
                              <TableCell className="text-center">
                                {status ? <Badge variant={status === "present" ? "default" : status === "late" ? "secondary" : "destructive"}>{STATUS_LABELS[status]?.label || status}</Badge> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          {filterStudentId !== "all" && lineData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>تطور حضور الطالب خلال الشهر</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v) => v === 1 ? "حاضر" : "غائب"} />
                    <Tooltip />
                    <Line type="stepAfter" dataKey="حاضر" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>مقارنة نسب حضور الطلاب</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={11} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="نسبة_الحضور" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="نسبة الحضور %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentAttendanceReport;
