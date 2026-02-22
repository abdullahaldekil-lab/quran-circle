import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CalendarIcon, Users, Clock, AlertTriangle, UserX, FileText } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  present: { label: "حاضر", variant: "default" },
  late: { label: "متأخر", variant: "secondary" },
  absent: { label: "غائب", variant: "destructive" },
  early_leave: { label: "خروج مبكر", variant: "outline" },
  leave: { label: "إجازة", variant: "outline" },
};

const StaffAttendanceLog = () => {
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const dateFromStr = format(dateFrom, "yyyy-MM-dd");
  const dateToStr = format(dateTo, "yyyy-MM-dd");

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-profiles-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title, department, is_staff")
        .eq("is_staff", true)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["staff-attendance-log", dateFromStr, dateToStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_attendance")
        .select("*")
        .gte("attendance_date", dateFromStr)
        .lte("attendance_date", dateToStr)
        .order("attendance_date", { ascending: false });
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

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterStaffId !== "all" && r.staff_id !== filterStaffId) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterDept !== "all") {
        const staff = staffMap[r.staff_id];
        if (!staff || staff.department !== filterDept) return false;
      }
      return true;
    });
  }, [records, filterStaffId, filterStatus, filterDept, staffMap]);

  // Daily summary
  const dailySummary = useMemo(() => {
    const present = filteredRecords.filter((r) => r.status === "present").length;
    const late = filteredRecords.filter((r) => r.status === "late").length;
    const earlyLeave = filteredRecords.filter((r) => r.status === "early_leave").length;
    const absent = filteredRecords.filter((r) => r.status === "absent").length;
    const totalWork = filteredRecords.reduce((sum, r) => sum + (r.total_work_minutes || 0), 0);
    return { present, late, earlyLeave, absent, totalWork };
  }, [filteredRecords]);

  // Individual report
  const individualReport = useMemo(() => {
    if (filterStaffId === "all") return null;
    const staffRecords = records.filter((r) => r.staff_id === filterStaffId);
    const daysPresent = staffRecords.filter((r) => r.status === "present" || r.status === "late" || r.status === "early_leave").length;
    const daysAbsent = staffRecords.filter((r) => r.status === "absent").length;
    const totalLate = staffRecords.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
    const totalEarly = staffRecords.reduce((sum, r) => sum + (r.early_leave_minutes || 0), 0);
    const totalWork = staffRecords.reduce((sum, r) => sum + (r.total_work_minutes || 0), 0);
    return { daysPresent, daysAbsent, totalLate, totalEarly, totalWork };
  }, [records, filterStaffId]);

  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h} س ${min} د` : `${min} د`;
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">سجل الحضور</h1>
        <p className="text-muted-foreground">عرض وتصفية سجلات حضور العاملين</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">من تاريخ</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right">
                    <CalendarIcon className="ml-2 h-4 w-4" />{dateFromStr}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">إلى تاريخ</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right">
                    <CalendarIcon className="ml-2 h-4 w-4" />{dateToStr}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">الموظف</label>
              <Select value={filterStaffId} onValueChange={setFilterStaffId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">القسم</label>
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
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

      <Tabs defaultValue="daily" dir="rtl">
        <TabsList>
          <TabsTrigger value="daily">التقرير اليومي</TabsTrigger>
          <TabsTrigger value="individual" disabled={filterStaffId === "all"}>تقرير فردي</TabsTrigger>
          <TabsTrigger value="records">السجلات</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="w-7 h-7 text-emerald-500" />
                <div>
                  <p className="text-xl font-bold">{dailySummary.present}</p>
                  <p className="text-xs text-muted-foreground">حاضر</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-7 h-7 text-amber-500" />
                <div>
                  <p className="text-xl font-bold">{dailySummary.late}</p>
                  <p className="text-xs text-muted-foreground">متأخر</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-7 h-7 text-orange-500" />
                <div>
                  <p className="text-xl font-bold">{dailySummary.earlyLeave}</p>
                  <p className="text-xs text-muted-foreground">خروج مبكر</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <UserX className="w-7 h-7 text-destructive" />
                <div>
                  <p className="text-xl font-bold">{dailySummary.absent}</p>
                  <p className="text-xs text-muted-foreground">غائب</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="w-7 h-7 text-primary" />
                <div>
                  <p className="text-xl font-bold">{formatMinutes(dailySummary.totalWork)}</p>
                  <p className="text-xs text-muted-foreground">إجمالي العمل</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          {individualReport && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{individualReport.daysPresent}</p>
                  <p className="text-sm text-muted-foreground">أيام حضور</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{individualReport.daysAbsent}</p>
                  <p className="text-sm text-muted-foreground">أيام غياب</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{formatMinutes(individualReport.totalLate)}</p>
                  <p className="text-sm text-muted-foreground">مجموع التأخير</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{formatMinutes(individualReport.totalEarly)}</p>
                  <p className="text-sm text-muted-foreground">خروج مبكر</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{formatMinutes(individualReport.totalWork)}</p>
                  <p className="text-sm text-muted-foreground">ساعات العمل</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

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
                      <TableHead className="text-right">خروج مبكر</TableHead>
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
                          <TableCell>{r.early_leave_minutes > 0 ? `${r.early_leave_minutes} د` : "—"}</TableCell>
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
      </Tabs>
    </div>
  );
};

export default StaffAttendanceLog;
