import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, subWeeks, getDay } from "date-fns";
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
import { CalendarIcon, Users, Clock, AlertTriangle, UserX, FileText, Printer, Download } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  present: { label: "حاضر", variant: "default", color: "hsl(var(--primary))" },
  late: { label: "متأخر", variant: "secondary", color: "#f59e0b" },
  absent: { label: "غائب", variant: "destructive", color: "hsl(var(--destructive))" },
  early_leave: { label: "خروج مبكر", variant: "outline", color: "#f97316" },
  leave: { label: "إجازة", variant: "outline", color: "#6b7280" },
};

const CHART_COLORS = ["hsl(142, 76%, 36%)", "#f59e0b", "hsl(0, 84%, 60%)", "#6b7280", "#f97316"];

const StaffAttendanceLog = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const printRef = useRef<HTMLDivElement>(null);

  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  // Current week
  const weekStart = format(startOfWeek(selectedMonth, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(selectedMonth, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-profiles-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, job_title, department, is_staff").eq("is_staff", true).eq("active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["staff-attendance-log-month", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_attendance").select("*").gte("attendance_date", monthStart).lte("attendance_date", monthEnd).order("attendance_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const staffMap = useMemo(() => {
    const map: Record<string, typeof staffList[0]> = {};
    staffList.forEach((s) => { map[s.id] = s; });
    return map;
  }, [staffList]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    staffList.forEach((s) => { if (s.department) depts.add(s.department); });
    return Array.from(depts);
  }, [staffList]);

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (filterStaffId !== "all" && s.id !== filterStaffId) return false;
      if (filterDept !== "all" && s.department !== filterDept) return false;
      return true;
    });
  }, [staffList, filterStaffId, filterDept]);

  const filteredRecords = useMemo(() => {
    const staffIds = new Set(filteredStaff.map(s => s.id));
    return records.filter((r) => {
      if (!staffIds.has(r.staff_id)) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, filteredStaff, filterStatus]);

  // Monthly days (excluding Fri/Sat)
  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) }).filter(d => {
      const day = getDay(d);
      return day !== 5 && day !== 6;
    });
  }, [selectedMonth]);

  // Week days (Sun-Thu)
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedMonth, { weekStartsOn: 0 });
    return Array.from({ length: 5 }, (_, i) => addDays(start, i)); // Sun-Thu
  }, [selectedMonth]);

  // Records map by staffId -> date -> record
  const recordsByStaffDate = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    records.forEach((r) => {
      if (!map[r.staff_id]) map[r.staff_id] = {};
      map[r.staff_id][r.attendance_date] = r;
    });
    return map;
  }, [records]);

  // Summary stats
  const dailySummary = useMemo(() => {
    const present = filteredRecords.filter((r) => r.status === "present").length;
    const late = filteredRecords.filter((r) => r.status === "late").length;
    const earlyLeave = filteredRecords.filter((r) => r.status === "early_leave").length;
    const absent = filteredRecords.filter((r) => r.status === "absent").length;
    const totalWork = filteredRecords.reduce((sum, r) => sum + (r.total_work_minutes || 0), 0);
    return { present, late, earlyLeave, absent, totalWork };
  }, [filteredRecords]);

  // Individual staff monthly detail
  const individualDetail = useMemo(() => {
    if (filterStaffId === "all") return null;
    const staffRecords = records.filter(r => r.staff_id === filterStaffId);
    const daysPresent = staffRecords.filter(r => ["present", "late", "early_leave"].includes(r.status)).length;
    const daysAbsent = monthDays.length - daysPresent - staffRecords.filter(r => r.status === "leave").length;
    const daysLate = staffRecords.filter(r => r.status === "late").length;
    const totalLateMin = staffRecords.reduce((s, r) => s + (r.late_minutes || 0), 0);
    const totalEarlyMin = staffRecords.reduce((s, r) => s + (r.early_leave_minutes || 0), 0);
    const totalWorkMin = staffRecords.reduce((s, r) => s + (r.total_work_minutes || 0), 0);
    const pct = monthDays.length > 0 ? Math.round((daysPresent / monthDays.length) * 100) : 0;
    return { daysPresent, daysAbsent: Math.max(0, daysAbsent), daysLate, totalLateMin, totalEarlyMin, totalWorkMin, pct, staffRecords };
  }, [records, filterStaffId, monthDays]);

  // Chart data: daily attendance rate
  const lineChartData = useMemo(() => {
    return monthDays.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayLabel = format(day, "d");
      const dayRecords = filteredRecords.filter(r => r.attendance_date === dateStr);
      const attended = dayRecords.filter(r => ["present", "late", "early_leave"].includes(r.status)).length;
      const pct = filteredStaff.length > 0 ? Math.round((attended / filteredStaff.length) * 100) : 0;
      return { day: dayLabel, نسبة_الحضور: pct };
    });
  }, [monthDays, filteredRecords, filteredStaff]);

  // Bar chart: attendance days per staff
  const barChartData = useMemo(() => {
    return filteredStaff.map(s => {
      const staffRecs = records.filter(r => r.staff_id === s.id);
      const attended = staffRecs.filter(r => ["present", "late", "early_leave"].includes(r.status)).length;
      return { name: s.full_name.split(" ").slice(0, 2).join(" "), أيام_الحضور: attended };
    });
  }, [filteredStaff, records]);

  // Pie chart: status distribution
  const pieChartData = useMemo(() => {
    const counts: Record<string, number> = { present: 0, late: 0, absent: 0, leave: 0, early_leave: 0 };
    filteredRecords.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    // Add absent (no record)
    const totalExpected = filteredStaff.length * monthDays.length;
    const totalRecorded = filteredRecords.length;
    counts.absent = Math.max(0, totalExpected - totalRecorded);
    return Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({
      name: STATUS_MAP[k]?.label || k, value: v,
    }));
  }, [filteredRecords, filteredStaff, monthDays]);

  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h} س ${min} د` : `${min} د`;
  };

  const statusBg = (status?: string) => {
    if (!status) return "bg-muted/30";
    switch (status) {
      case "present": return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
      case "late": return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      case "absent": return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
      case "leave": return "bg-muted text-muted-foreground";
      case "early_leave": return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
      default: return "bg-muted/30";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = (data: any[], fileName: string) => {
    import("xlsx-js-style").then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    });
  };

  const exportWeeklyExcel = () => {
    const rows = filteredStaff.map(s => {
      const row: Record<string, string> = { "الموظف": s.full_name };
      weekDays.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const rec = recordsByStaffDate[s.id]?.[dateStr];
        const dayName = format(day, "EEEE", { locale: ar });
        row[dayName] = rec ? (STATUS_MAP[rec.status]?.label || rec.status) : "—";
      });
      return row;
    });
    handleExportExcel(rows, `حضور_أسبوعي_${weekStart}`);
  };

  const exportMonthlyExcel = () => {
    const rows = filteredStaff.map(s => {
      const staffRecs = records.filter(r => r.staff_id === s.id);
      const daysP = staffRecs.filter(r => ["present", "late", "early_leave"].includes(r.status)).length;
      const daysA = Math.max(0, monthDays.length - daysP - staffRecs.filter(r => r.status === "leave").length);
      const daysL = staffRecs.filter(r => r.status === "late").length;
      const totalLate = staffRecs.reduce((s, r) => s + (r.late_minutes || 0), 0);
      const pct = monthDays.length > 0 ? Math.round((daysP / monthDays.length) * 100) : 0;
      return {
        "الموظف": s.full_name, "القسم": s.department || "—",
        "أيام الحضور": daysP, "أيام الغياب": daysA, "أيام التأخر": daysL,
        "دقائق التأخر": totalLate, "نسبة الحضور %": pct,
      };
    });
    handleExportExcel(rows, `حضور_شهري_${monthStart}`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">سجل حضور الموظفين</h1>
        <p className="text-muted-foreground">عرض وتحليل سجلات حضور العاملين</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <label className="text-sm font-medium mb-1 block">الموظف</label>
              <Select value={filterStaffId} onValueChange={setFilterStaffId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">القسم</label>
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">الحالة</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="late">متأخر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="early_leave">خروج مبكر</SelectItem>
                  <SelectItem value="leave">إجازة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:hidden">
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="w-7 h-7 text-emerald-500" /><div><p className="text-xl font-bold">{dailySummary.present}</p><p className="text-xs text-muted-foreground">حاضر</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="w-7 h-7 text-amber-500" /><div><p className="text-xl font-bold">{dailySummary.late}</p><p className="text-xs text-muted-foreground">متأخر</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="w-7 h-7 text-orange-500" /><div><p className="text-xl font-bold">{dailySummary.earlyLeave}</p><p className="text-xs text-muted-foreground">خروج مبكر</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><UserX className="w-7 h-7 text-destructive" /><div><p className="text-xl font-bold">{dailySummary.absent}</p><p className="text-xs text-muted-foreground">غائب</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><FileText className="w-7 h-7 text-primary" /><div><p className="text-xl font-bold">{formatMinutes(dailySummary.totalWork)}</p><p className="text-xs text-muted-foreground">إجمالي العمل</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="weekly" dir="rtl">
        <TabsList className="print:hidden">
          <TabsTrigger value="weekly">أسبوعي</TabsTrigger>
          <TabsTrigger value="monthly">شهري</TabsTrigger>
          <TabsTrigger value="individual" disabled={filterStaffId === "all"}>بيان تفصيلي</TabsTrigger>
          <TabsTrigger value="records">السجلات</TabsTrigger>
          <TabsTrigger value="charts">الرسوم البيانية</TabsTrigger>
        </TabsList>

        {/* Weekly Tab */}
        <TabsContent value="weekly" className="space-y-4">
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
            <Button variant="outline" size="sm" onClick={exportWeeklyExcel}><Download className="w-4 h-4 ml-1" />Excel</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right sticky right-0 bg-background z-10">الموظف</TableHead>
                    {weekDays.map(day => (
                      <TableHead key={day.toISOString()} className="text-center min-w-[80px]">
                        <div>{format(day, "EEEE", { locale: ar })}</div>
                        <div className="text-xs text-muted-foreground">{format(day, "d/M")}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium sticky right-0 bg-background z-10">{s.full_name}</TableCell>
                      {weekDays.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const rec = recordsByStaffDate[s.id]?.[dateStr];
                        return (
                          <TableCell key={dateStr} className={cn("text-center text-xs font-medium", statusBg(rec?.status))}>
                            {rec ? (STATUS_MAP[rec.status]?.label || "—") : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
            <Button variant="outline" size="sm" onClick={exportMonthlyExcel}><Download className="w-4 h-4 ml-1" />Excel</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">القسم</TableHead>
                    <TableHead className="text-center">أيام الحضور</TableHead>
                    <TableHead className="text-center">أيام الغياب</TableHead>
                    <TableHead className="text-center">أيام التأخر</TableHead>
                    <TableHead className="text-center">دقائق التأخر</TableHead>
                    <TableHead className="text-center">نسبة الحضور</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map(s => {
                    const staffRecs = records.filter(r => r.staff_id === s.id);
                    const daysP = staffRecs.filter(r => ["present", "late", "early_leave"].includes(r.status)).length;
                    const daysA = Math.max(0, monthDays.length - daysP - staffRecs.filter(r => r.status === "leave").length);
                    const daysL = staffRecs.filter(r => r.status === "late").length;
                    const totalLate = staffRecs.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
                    const pct = monthDays.length > 0 ? Math.round((daysP / monthDays.length) * 100) : 0;
                    return (
                      <TableRow key={s.id} className={cn(pct < 70 && "bg-amber-50 dark:bg-amber-950/20", pct >= 90 && "bg-emerald-50 dark:bg-emerald-950/20")}>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell>{s.department || "—"}</TableCell>
                        <TableCell className="text-center font-bold text-emerald-600">{daysP}</TableCell>
                        <TableCell className="text-center font-bold text-destructive">{daysA}</TableCell>
                        <TableCell className="text-center font-bold text-amber-600">{daysL}</TableCell>
                        <TableCell className="text-center">{totalLate > 0 ? `${totalLate} د` : "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={pct >= 90 ? "default" : pct >= 70 ? "secondary" : "destructive"}>{pct}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual Detail Tab */}
        <TabsContent value="individual" className="space-y-4">
          {individualDetail && (
            <>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-emerald-600">{individualDetail.daysPresent}</p><p className="text-xs text-muted-foreground">أيام حضور</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-destructive">{individualDetail.daysAbsent}</p><p className="text-xs text-muted-foreground">أيام غياب</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-amber-600">{individualDetail.daysLate}</p><p className="text-xs text-muted-foreground">أيام تأخر</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-amber-600">{formatMinutes(individualDetail.totalLateMin)}</p><p className="text-xs text-muted-foreground">دقائق التأخر</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-primary">{formatMinutes(individualDetail.totalWorkMin)}</p><p className="text-xs text-muted-foreground">ساعات العمل</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{individualDetail.pct}%</p><p className="text-xs text-muted-foreground">نسبة الحضور</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle>التفاصيل اليومية - {staffMap[filterStaffId]?.full_name}</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">اليوم</TableHead>
                        <TableHead className="text-center">الدخول</TableHead>
                        <TableHead className="text-center">الخروج</TableHead>
                        <TableHead className="text-center">تأخير (د)</TableHead>
                        <TableHead className="text-center">خروج مبكر (د)</TableHead>
                        <TableHead className="text-center">ساعات العمل</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthDays.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const rec = recordsByStaffDate[filterStaffId]?.[dateStr];
                        return (
                          <TableRow key={dateStr} className={statusBg(rec?.status)}>
                            <TableCell>{format(day, "d/M")}</TableCell>
                            <TableCell>{format(day, "EEEE", { locale: ar })}</TableCell>
                            <TableCell className="text-center">{rec?.check_in_time ? format(new Date(rec.check_in_time), "HH:mm") : "—"}</TableCell>
                            <TableCell className="text-center">{rec?.check_out_time ? format(new Date(rec.check_out_time), "HH:mm") : "—"}</TableCell>
                            <TableCell className="text-center">{rec?.late_minutes > 0 ? rec.late_minutes : "—"}</TableCell>
                            <TableCell className="text-center">{rec?.early_leave_minutes > 0 ? rec.early_leave_minutes : "—"}</TableCell>
                            <TableCell className="text-center">{rec?.total_work_minutes > 0 ? formatMinutes(rec.total_work_minutes) : "—"}</TableCell>
                            <TableCell className="text-center">
                              {rec ? <Badge variant={STATUS_MAP[rec.status]?.variant || "outline"}>{STATUS_MAP[rec.status]?.label || rec.status}</Badge> : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
              ) : filteredRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد سجلات</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">القسم</TableHead>
                      <TableHead className="text-right">الدخول</TableHead>
                      <TableHead className="text-right">الخروج</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">تأخير</TableHead>
                      <TableHead className="text-right">ساعات العمل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r) => {
                      const staff = staffMap[r.staff_id];
                      const statusInfo = STATUS_MAP[r.status] || STATUS_MAP.absent;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{staff?.full_name || "—"}</TableCell>
                          <TableCell>{r.attendance_date}</TableCell>
                          <TableCell>{staff?.department || "—"}</TableCell>
                          <TableCell>{r.check_in_time ? format(new Date(r.check_in_time), "HH:mm") : "—"}</TableCell>
                          <TableCell>{r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "—"}</TableCell>
                          <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                          <TableCell>{r.late_minutes > 0 ? `${r.late_minutes} د` : "—"}</TableCell>
                          <TableCell>{r.total_work_minutes > 0 ? formatMinutes(r.total_work_minutes) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          {/* Line Chart - Daily Attendance Rate */}
          <Card>
            <CardHeader><CardTitle>نسبة الحضور اليومية خلال الشهر</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="نسبة_الحضور" stroke="hsl(142, 76%, 36%)" strokeWidth={2} name="نسبة الحضور %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart - Days per staff */}
          <Card>
            <CardHeader><CardTitle>أيام حضور كل موظف في الشهر</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={11} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="أيام_الحضور" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="أيام الحضور" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart - Status Distribution */}
          <Card>
            <CardHeader><CardTitle>توزيع حالات الحضور</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StaffAttendanceLog;
