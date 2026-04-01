import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, LogIn, LogOut, Users, Clock, AlertTriangle, UserX, CalendarOff, Pencil, Printer, FileDown } from "lucide-react";

interface StaffProfile {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  is_staff: boolean;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_in_minutes: number;
  grace_out_minutes: number;
}

interface AttendanceRecord {
  id: string;
  staff_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  shift_id: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  total_work_minutes: number;
  notes: string | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  present: { label: "حاضر", variant: "default" },
  late: { label: "متأخر", variant: "secondary" },
  absent: { label: "غائب", variant: "destructive" },
  early_leave: { label: "خروج مبكر", variant: "outline" },
  leave: { label: "إجازة", variant: "outline" },
};

const StaffAttendance = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isManager, isSupervisor, isAdminStaff } = useRole();
  const { profile } = useAuth();
  const canManage = isManager || isSupervisor || isAdminStaff;
  const canEdit = isManager || isAdminStaff;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStaffId, setEditStaffId] = useState<string>("");
  const [editStaffName, setEditStaffName] = useState<string>("");
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editStatus, setEditStatus] = useState("present");
  const [editNotes, setEditNotes] = useState("");

  const isWeekend = useMemo(() => {
    const day = selectedDate.getDay();
    return day === 5 || day === 6;
  }, [selectedDate]);

  const { data: holidayData } = useQuery({
    queryKey: ["holiday-check", dateStr],
    queryFn: async () => {
      const { data } = await supabase.from("holidays").select("title").lte("start_date", dateStr).gte("end_date", dateStr).limit(1).maybeSingle();
      return data;
    },
  });

  const isHoliday = !!holidayData;
  const isDayOff = isWeekend || isHoliday;
  const dayOffReason = isWeekend ? "عطلة نهاية الأسبوع (الجمعة والسبت)" : holidayData?.title || "إجازة رسمية";

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, job_title, department, is_staff").eq("is_staff", true).eq("active", true).order("full_name");
      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["staff-shifts-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_attendance_shifts").select("*").eq("active", true).order("start_time");
      if (error) throw error;
      return data as Shift[];
    },
  });

  const activeShiftId = selectedShiftId || shifts[0]?.id || "";
  const activeShift = shifts.find((s) => s.id === activeShiftId);

  const { data: records = [] } = useQuery({
    queryKey: ["staff-attendance", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_attendance").select("*").eq("attendance_date", dateStr);
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  const recordMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach((r) => { map[r.staff_id] = r; });
    return map;
  }, [records]);

  const computeStatus = (checkInTime: Date, shift: Shift) => {
    const [sh, sm] = shift.start_time.split(":").map(Number);
    const shiftStart = new Date(checkInTime);
    shiftStart.setHours(sh, sm, 0, 0);
    const graceEnd = new Date(shiftStart.getTime() + shift.grace_in_minutes * 60000);
    if (checkInTime > graceEnd) {
      const lateMs = checkInTime.getTime() - shiftStart.getTime();
      return { status: "late", late_minutes: Math.round(lateMs / 60000) };
    }
    return { status: "present", late_minutes: 0 };
  };

  const computeCheckout = (checkInTime: Date, checkOutTime: Date, shift: Shift) => {
    const [eh, em] = shift.end_time.split(":").map(Number);
    const shiftEnd = new Date(checkOutTime);
    shiftEnd.setHours(eh, em, 0, 0);
    const graceStart = new Date(shiftEnd.getTime() - shift.grace_out_minutes * 60000);
    const totalWork = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
    let earlyLeave = 0;
    let status = "present";
    if (checkOutTime < graceStart) {
      earlyLeave = Math.round((shiftEnd.getTime() - checkOutTime.getTime()) / 60000);
      status = "early_leave";
    }
    return { early_leave_minutes: earlyLeave, total_work_minutes: totalWork, earlyStatus: status };
  };

  const checkInMutation = useMutation({
    mutationFn: async (staffId: string) => {
      if (isDayOff) throw new Error("لا يمكن تسجيل الحضور في أيام العطل");
      if (!activeShift) throw new Error("يرجى اختيار فترة الدوام");
      const now = new Date();
      const { status, late_minutes } = computeStatus(now, activeShift);
      const { error } = await supabase.from("staff_attendance").upsert({
        staff_id: staffId, attendance_date: dateStr, check_in_time: now.toISOString(), status, late_minutes, shift_id: activeShiftId,
      }, { onConflict: "staff_id,attendance_date" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff-attendance", dateStr] }); toast({ title: "تم تسجيل الحضور" }); },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const record = recordMap[staffId];
      if (!record?.check_in_time || !activeShift) throw new Error("لا يوجد تسجيل دخول");
      const now = new Date();
      const checkIn = new Date(record.check_in_time);
      const { early_leave_minutes, total_work_minutes, earlyStatus } = computeCheckout(checkIn, now, activeShift);
      const finalStatus = record.status === "late" ? "late" : earlyStatus;
      const { error } = await supabase.from("staff_attendance").update({ check_out_time: now.toISOString(), early_leave_minutes, total_work_minutes, status: finalStatus }).eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff-attendance", dateStr] }); toast({ title: "تم تسجيل الانصراف" }); },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  // Manual edit mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      const record = recordMap[editStaffId];
      const today = dateStr;
      const checkInIso = editCheckIn ? new Date(`${today}T${editCheckIn}:00`).toISOString() : null;
      const checkOutIso = editCheckOut ? new Date(`${today}T${editCheckOut}:00`).toISOString() : null;
      let lateMin = 0;
      let earlyMin = 0;
      let totalWork = 0;
      if (checkInIso && checkOutIso) {
        totalWork = Math.round((new Date(checkOutIso).getTime() - new Date(checkInIso).getTime()) / 60000);
      }

      const payload = {
        staff_id: editStaffId,
        attendance_date: today,
        check_in_time: checkInIso,
        check_out_time: checkOutIso,
        status: editStatus,
        late_minutes: lateMin,
        early_leave_minutes: earlyMin,
        total_work_minutes: Math.max(0, totalWork),
        notes: editNotes || null,
        shift_id: activeShiftId || null,
      };

      if (record) {
        const { error } = await supabase.from("staff_attendance").update(payload).eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff_attendance").insert(payload);
        if (error) throw error;
      }

      // Audit log
      await supabase.from("admin_audit_log").insert({
        actor_user_id: profile?.id || null,
        action_type: "staff_attendance_edit",
        details: `تعديل يدوي لحضور ${editStaffName} بتاريخ ${today} - الحالة: ${editStatus}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", dateStr] });
      toast({ title: "تم حفظ التعديل" });
      setEditDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const openEditDialog = (staff: StaffProfile) => {
    const record = recordMap[staff.id];
    setEditStaffId(staff.id);
    setEditStaffName(staff.full_name);
    setEditCheckIn(record?.check_in_time ? format(new Date(record.check_in_time), "HH:mm") : "");
    setEditCheckOut(record?.check_out_time ? format(new Date(record.check_out_time), "HH:mm") : "");
    setEditStatus(record?.status || "present");
    setEditNotes(record?.notes || "");
    setEditDialogOpen(true);
  };

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        doc.addFont("https://fonts.gstatic.com/ea/notonaskarabic/v1/NotoNaskhArabic-Regular.ttf", "Noto", "normal");
        // Title
        doc.setFontSize(16);
        doc.text(`تقرير حضور العاملين - ${dateStr}`, doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });
        doc.setFontSize(10);
        doc.text(`نسبة الحضور: ${staffList.length > 0 ? Math.round(((summary.present + summary.late) / staffList.length) * 100) : 0}%`, doc.internal.pageSize.getWidth() / 2, 28, { align: "center" });

        const tableData = staffList.map((staff) => {
          const record = recordMap[staff.id];
          const statusInfo = record ? STATUS_MAP[record.status] || STATUS_MAP.absent : STATUS_MAP.absent;
          return [
            record?.notes || "",
            statusInfo.label,
            record?.check_out_time ? format(new Date(record.check_out_time), "HH:mm") : "—",
            record?.check_in_time ? format(new Date(record.check_in_time), "HH:mm") : "—",
            staff.department || "—",
            staff.full_name,
          ];
        });

        (doc as any).autoTable({
          head: [["ملاحظات", "الحالة", "الخروج", "الدخول", "القسم", "الاسم"]],
          body: tableData,
          startY: 35,
          styles: { font: "helvetica", fontSize: 9, halign: "center" },
          headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: "center" },
          theme: "grid",
        });

        doc.save(`حضور_العاملين_${dateStr}.pdf`);
      });
    });
  };

  const summary = useMemo(() => {
    const present = records.filter((r) => r.status === "present").length;
    const late = records.filter((r) => r.status === "late").length;
    const earlyLeave = records.filter((r) => r.status === "early_leave").length;
    const absent = staffList.length - records.length;
    return { present, late, earlyLeave, absent };
  }, [records, staffList]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">حضور العاملين</h1>
          <p className="text-muted-foreground">تسجيل الحضور والانصراف اليومي</p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-right", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="ml-2 h-4 w-4" />{format(selectedDate, "yyyy-MM-dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {shifts.length > 0 && (
            <Select value={activeShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="اختر الدوام" /></SelectTrigger>
              <SelectContent>
                {shifts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isDayOff && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200">
          <CalendarOff className="h-5 w-5" />
          <AlertTitle>يوم عطلة — {dayOffReason}</AlertTitle>
          <AlertDescription>تسجيل الحضور والانصراف معطّل في هذا اليوم.</AlertDescription>
        </Alert>
      )}

      {!isDayOff && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><Users className="w-8 h-8 text-emerald-500" /><div><p className="text-2xl font-bold">{summary.present}</p><p className="text-sm text-muted-foreground">حاضر</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="w-8 h-8 text-amber-500" /><div><p className="text-2xl font-bold">{summary.late}</p><p className="text-sm text-muted-foreground">متأخر</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="w-8 h-8 text-orange-500" /><div><p className="text-2xl font-bold">{summary.earlyLeave}</p><p className="text-sm text-muted-foreground">خروج مبكر</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><UserX className="w-8 h-8 text-destructive" /><div><p className="text-2xl font-bold">{summary.absent}</p><p className="text-sm text-muted-foreground">غائب</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{staffList.length > 0 ? Math.round(((summary.present + summary.late) / staffList.length) * 100) : 0}%</p><p className="text-sm text-muted-foreground">نسبة الحضور</p></div></CardContent></Card>
        </div>
      )}

      {!isDayOff && (
        <Card>
          <CardHeader><CardTitle>قائمة العاملين - {format(selectedDate, "yyyy-MM-dd")}</CardTitle></CardHeader>
          <CardContent>
            {!activeShift ? (
              <p className="text-center text-muted-foreground py-8">يرجى إضافة فترة دوام أولاً من صفحة "جداول الدوام"</p>
            ) : staffList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا يوجد عاملون مسجلون</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">القسم</TableHead>
                    <TableHead className="text-right">المسمى</TableHead>
                    <TableHead className="text-right">الدخول</TableHead>
                    <TableHead className="text-right">الخروج</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    {canManage && <TableHead className="text-right">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((staff) => {
                    const record = recordMap[staff.id];
                    const statusInfo = record ? STATUS_MAP[record.status] || STATUS_MAP.absent : STATUS_MAP.absent;
                    return (
                      <TableRow key={staff.id}>
                        <TableCell className="font-medium">{staff.full_name}</TableCell>
                        <TableCell>{staff.department || "—"}</TableCell>
                        <TableCell>{staff.job_title || "—"}</TableCell>
                        <TableCell>{record?.check_in_time ? format(new Date(record.check_in_time), "HH:mm") : "—"}</TableCell>
                        <TableCell>{record?.check_out_time ? format(new Date(record.check_out_time), "HH:mm") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          {record?.late_minutes > 0 && <span className="text-xs text-muted-foreground mr-1">({record.late_minutes} د)</span>}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-2">
                              {!record?.check_in_time && (
                                <Button size="sm" variant="outline" onClick={() => checkInMutation.mutate(staff.id)} disabled={checkInMutation.isPending}>
                                  <LogIn className="w-4 h-4 ml-1" />حضور
                                </Button>
                              )}
                              {record?.check_in_time && !record?.check_out_time && (
                                <Button size="sm" variant="outline" onClick={() => checkOutMutation.mutate(staff.id)} disabled={checkOutMutation.isPending}>
                                  <LogOut className="w-4 h-4 ml-1" />انصراف
                                </Button>
                              )}
                              {canEdit && (
                                <Button size="sm" variant="ghost" onClick={() => openEditDialog(staff)} title="تعديل يدوي">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تعديل حضور: {editStaffName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>وقت الدخول</Label>
              <Input type="time" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
            </div>
            <div>
              <Label>وقت الخروج</Label>
              <Input type="time" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="late">متأخر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="leave">إجازة</SelectItem>
                  <SelectItem value="early_leave">خروج مبكر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ملاحظة</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="ملاحظة اختيارية..." />
            </div>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="w-full">
              {editMutation.isPending ? "جارٍ الحفظ..." : "حفظ التعديل"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffAttendance;
