import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowRight, Printer, Save, ScrollText, CheckCircle2, XCircle, Users, UserPlus, Search, Trash2, Pencil, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NarrationPrintTemplate from "@/components/NarrationPrintTemplate";
import NarrationAttemptDialog from "@/components/narration/NarrationAttemptDialog";
import type { NarrationRange, NarrationSettingsFull, NarrationAttemptData } from "@/components/narration/NarrationValidation";
import { calcTotalHizbCount } from "@/components/narration/NarrationValidation";
import { sendNotification } from "@/utils/sendNotification";

interface StudentRow {
  student_id: string;
  student_name: string;
  attempt_id?: string;
  narration_type: "regular" | "multi";
  ranges: NarrationRange[];
  total_hizb_count: number;
  total_pages_approx: number;
  mistakes_count: number;
  lahn_count: number;
  warnings_count: number;
  grade: number;
  status: "pass" | "fail" | "absent" | "pending";
  notes: string;
  manual_entry: boolean;
}

export default function NarrationSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { role } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkNarrationOpen, setBulkNarrationOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const isManager = role === "manager";
  const canWrite = isManager || role === "teacher" || role === "assistant_teacher";

  // جلب بيانات الجلسة
  const { data: session } = useQuery({
    queryKey: ["narration-session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_sessions" as any)
        .select("*, halaqat(id, name, teacher_id)")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return (data as unknown) as {
        id: string;
        session_date: string;
        halaqa_id: string | null;
        title: string | null;
        notes: string | null;
        halaqat?: { id: string; name: string; teacher_id: string | null } | null;
      };
    },
    enabled: !!sessionId,
  });

  // جلب الإعدادات
  const { data: settings } = useQuery({
    queryKey: ["narration-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_settings" as any)
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return (data as unknown) as NarrationSettingsFull;
    },
  });

  // جلب الطلاب من الحلقة
  const { data: students = [] } = useQuery<{ id: string; full_name: string }[]>({
    queryKey: ["halaqa-students", session?.halaqa_id],
    queryFn: async () => {
      if (!session?.halaqa_id) return [];
      const { data, error } = await (supabase as any)
        .from("students")
        .select("id, full_name")
        .eq("halaqa_id", session.halaqa_id)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data as { id: string; full_name: string }[]) || [];
    },
    enabled: !!session?.halaqa_id,
  });

  // جلب جميع الطلاب النشطين للبحث
  const { data: allStudents = [] } = useQuery<{
    id: string;
    full_name: string;
    halaqa_id: string | null;
    halaqat: { name: string } | null;
  }[]>({
    queryKey: ["all-students-search"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("students")
        .select("id, full_name, halaqa_id, halaqat(name)")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: showAddStudent,
  });

  // جلب المحاولات الموجودة مع النطاقات
  const { data: existingAttempts = [] } = useQuery({
    queryKey: ["narration-attempts", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_attempts" as any)
        .select("*")
        .eq("session_id", sessionId!);
      if (error) throw error;
      const attempts = (data as unknown) as any[];
      // Fetch ranges for all attempts
      if (attempts.length === 0) return [];
      const attemptIds = attempts.map((a: any) => a.id);
      const { data: rangesData, error: rangesError } = await supabase
        .from("narration_ranges" as any)
        .select("*")
        .in("attempt_id", attemptIds);
      if (rangesError) throw rangesError;
      const rangesMap = new Map<string, NarrationRange[]>();
      for (const r of (rangesData as unknown as any[])) {
        const list = rangesMap.get(r.attempt_id) || [];
        list.push({ id: r.id, section: r.section, from_hizb: r.from_hizb, to_hizb: r.to_hizb, hizb_count: r.hizb_count });
        rangesMap.set(r.attempt_id, list);
      }
      return attempts.map((a: any) => ({ ...a, ranges: rangesMap.get(a.id) || [] }));
    },
    enabled: !!sessionId,
  });

  // بناء الصفوف
  useEffect(() => {
    if (students.length === 0 && existingAttempts.length === 0) return;
    const attemptMap = new Map(existingAttempts.map((a: any) => [a.student_id, a]));
    const maxGrade = settings?.max_grade ?? 100;

    // Students from halaqa
    const halaqaRows: StudentRow[] = students.map((s) => {
      const existing = attemptMap.get(s.id);
      if (existing) {
        return mapAttemptToRow(s.id, s.full_name, existing);
      }
      return makeEmptyRow(s.id, s.full_name, maxGrade);
    });

    // Students that have attempts but are not in the halaqa
    const halaqaStudentIds = new Set(students.map((s) => s.id));
    const extraRows: StudentRow[] = existingAttempts
      .filter((a: any) => !halaqaStudentIds.has(a.student_id))
      .map((a: any) => mapAttemptToRow(a.student_id, a.student_id, a)); // name will be resolved below

    setRows([...halaqaRows, ...extraRows]);
  }, [students, existingAttempts, settings]);

  // Resolve names for extra students
  useEffect(() => {
    const unknownIds = rows.filter(r => r.student_name === r.student_id).map(r => r.student_id);
    if (unknownIds.length === 0) return;
    (async () => {
      const { data } = await (supabase as any).from("students").select("id, full_name").in("id", unknownIds);
      if (data && data.length > 0) {
        const nameMap = new Map(data.map((d: any) => [d.id, d.full_name]));
        setRows(prev => prev.map(r => nameMap.has(r.student_id) ? { ...r, student_name: nameMap.get(r.student_id) as string } : r));
      }
    })();
  }, [rows.length]);

  function mapAttemptToRow(studentId: string, studentName: string, attempt: any): StudentRow {
    return {
      student_id: studentId,
      student_name: studentName,
      attempt_id: attempt.id,
      narration_type: attempt.narration_type || "regular",
      ranges: attempt.ranges || [],
      total_hizb_count: Number(attempt.total_hizb_count) || 0,
      total_pages_approx: Number(attempt.total_pages_approx) || 0,
      mistakes_count: attempt.mistakes_count || 0,
      lahn_count: attempt.lahn_count || 0,
      warnings_count: attempt.warnings_count || 0,
      grade: Number(attempt.grade) || 0,
      status: attempt.status || "pending",
      notes: attempt.notes || "",
      manual_entry: attempt.manual_entry || false,
    };
  }

  function makeEmptyRow(studentId: string, studentName: string, maxGrade: number): StudentRow {
    return {
      student_id: studentId,
      student_name: studentName,
      narration_type: "regular",
      ranges: [{ section: "regular", from_hizb: 1, to_hizb: 1, hizb_count: 1 }],
      total_hizb_count: 1,
      total_pages_approx: (settings?.pages_per_hizb ?? 10),
      mistakes_count: 0,
      lahn_count: 0,
      warnings_count: 0,
      grade: maxGrade,
      status: "pending",
      notes: "",
      manual_entry: false,
    };
  }

  // إضافة طالب يدوياً
  const addStudentManually = (student: { id: string; full_name: string }) => {
    if (rows.some((r) => r.student_id === student.id)) {
      toast({ title: "الطالب موجود بالفعل في الجلسة", variant: "destructive" });
      return;
    }
    const maxGrade = settings?.max_grade ?? 100;
    setRows((prev) => [...prev, makeEmptyRow(student.id, student.full_name, maxGrade)]);
    setShowAddStudent(false);
    setSearchQuery("");
  };

  // حذف طالب
  const deleteStudent = async (studentId: string) => {
    const row = rows.find((r) => r.student_id === studentId);
    if (row?.attempt_id) {
      // Delete ranges first, then attempt
      await supabase.from("narration_ranges" as any).delete().eq("attempt_id", row.attempt_id);
      const { error } = await supabase.from("narration_attempts" as any).delete().eq("id", row.attempt_id);
      if (error) {
        toast({ title: `خطأ في الحذف: ${error.message}`, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["narration-attempts", sessionId] });
    }
    setRows((prev) => prev.filter((r) => r.student_id !== studentId));
    setDeleteStudentId(null);
    toast({ title: "تم حذف الطالب من الجلسة" });
  };

  // حفظ محاولة طالب واحد (من Dialog)
  const saveStudentAttempt = async (studentId: string, data: NarrationAttemptData) => {
    setSavingAttempt(true);
    try {
      const row = rows.find((r) => r.student_id === studentId);
      const attemptPayload = {
        session_id: sessionId!,
        student_id: studentId,
        narration_type: data.narration_type,
        total_hizb_count: data.total_hizb_count,
        total_pages_approx: data.total_pages_approx,
        mistakes_count: data.mistakes_count,
        lahn_count: data.lahn_count,
        warnings_count: data.warnings_count,
        grade: data.grade,
        status: data.status,
        manual_entry: data.manual_entry,
        notes: data.notes || null,
      };

      let attemptId = row?.attempt_id;

      if (attemptId) {
        // Update existing
        const { error } = await supabase.from("narration_attempts" as any).update(attemptPayload).eq("id", attemptId);
        if (error) throw error;
        // Delete old ranges and insert new
        await supabase.from("narration_ranges" as any).delete().eq("attempt_id", attemptId);
      } else {
        // Insert new
        const { data: created, error } = await supabase.from("narration_attempts" as any).insert(attemptPayload).select().single();
        if (error) throw error;
        attemptId = (created as any).id;
      }

      // Insert ranges
      if (data.ranges.length > 0 && attemptId) {
        const rangesPayload = data.ranges.map((r) => ({
          attempt_id: attemptId,
          section: r.section,
          from_hizb: r.from_hizb,
          to_hizb: r.to_hizb,
          hizb_count: r.to_hizb - r.from_hizb + 1,
        }));
        const { error: rangeError } = await supabase.from("narration_ranges" as any).insert(rangesPayload);
        if (rangeError) throw rangeError;
      }

      queryClient.invalidateQueries({ queryKey: ["narration-attempts", sessionId] });
      setEditingStudent(null);
      toast({ title: "تم حفظ النتيجة بنجاح ✓" });

      // Send narration notification to guardians
      if (data.status === "pass" && row) {
        const { data: guardianLinks } = await supabase.from("guardian_students").select("guardian_id").eq("student_id", row.student_id).eq("active", true);
        if (guardianLinks && guardianLinks.length > 0) {
          sendNotification({
            templateCode: "NARRATION_PASSED",
            recipientIds: guardianLinks.map((l: any) => l.guardian_id),
            variables: { studentName: row.student_name, grade: String(data.grade) },
          }).catch(console.error);
        }
      }
    } catch (err: any) {
      toast({ title: `خطأ: ${err.message}`, variant: "destructive" });
    } finally {
      setSavingAttempt(false);
    }
  };

  const handlePrint = () => { window.print(); };

  // Multi-select helpers
  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStudents.size === rows.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(rows.map(r => r.student_id)));
    }
  };

  // Bulk save narration for selected students
  const saveBulkNarration = async (data: NarrationAttemptData) => {
    setBulkSaving(true);
    try {
      const studentIds = Array.from(selectedStudents);
      for (const studentId of studentIds) {
        const row = rows.find(r => r.student_id === studentId);
        const attemptPayload = {
          session_id: sessionId!,
          student_id: studentId,
          narration_type: data.narration_type,
          total_hizb_count: data.total_hizb_count,
          total_pages_approx: data.total_pages_approx,
          mistakes_count: data.mistakes_count,
          lahn_count: data.lahn_count,
          warnings_count: data.warnings_count,
          grade: data.grade,
          status: data.status,
          manual_entry: data.manual_entry,
          notes: data.notes || null,
        };

        let attemptId = row?.attempt_id;

        if (attemptId) {
          const { error } = await supabase.from("narration_attempts" as any).update(attemptPayload).eq("id", attemptId);
          if (error) throw error;
          await supabase.from("narration_ranges" as any).delete().eq("attempt_id", attemptId);
        } else {
          const { data: created, error } = await supabase.from("narration_attempts" as any).insert(attemptPayload).select().single();
          if (error) throw error;
          attemptId = (created as any).id;
        }

        if (data.ranges.length > 0 && attemptId) {
          const rangesPayload = data.ranges.map((r) => ({
            attempt_id: attemptId,
            section: r.section,
            from_hizb: r.from_hizb,
            to_hizb: r.to_hizb,
            hizb_count: r.to_hizb - r.from_hizb + 1,
          }));
          const { error: rangeError } = await supabase.from("narration_ranges" as any).insert(rangesPayload);
          if (rangeError) throw rangeError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["narration-attempts", sessionId] });
      setBulkNarrationOpen(false);
      setSelectedStudents(new Set());
      toast({ title: `تم حفظ النتائج لـ ${studentIds.length} طالب ✓` });
    } catch (err: any) {
      toast({ title: `خطأ: ${err.message}`, variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
  };

  // الإحصائيات
  const stats = {
    total: rows.length,
    present: rows.filter((r) => r.status !== "absent" && r.status !== "pending").length,
    passed: rows.filter((r) => r.status === "pass").length,
    failed: rows.filter((r) => r.status === "fail").length,
    absent: rows.filter((r) => r.status === "absent").length,
    pending: rows.filter((r) => r.status === "pending").length,
  };

  const avgGrade =
    stats.present > 0
      ? (rows.filter((r) => r.status !== "absent" && r.status !== "pending").reduce((s, r) => s + r.grade, 0) / stats.present).toFixed(1)
      : "—";

  return (
    <div className="space-y-5" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quran-narration")} className="shrink-0">
            <ArrowRight className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {session?.title || "جلسة سرد قرآني"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {session?.halaqat?.name && `حلقة: ${session.halaqat.name} · `}
                {session?.session_date && new Date(session.session_date).toLocaleDateString("ar-SA")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 print:hidden" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            طباعة
          </Button>
        </div>
      </div>

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "إجمالي الطلاب", value: stats.total, icon: Users, color: "text-foreground", bg: "bg-muted" },
          { label: "حضروا وعرضوا", value: stats.present, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
          { label: "ناجحون", value: stats.passed, icon: CheckCircle2, color: "text-chart-2", bg: "bg-chart-2/10" },
          { label: "راسبون", value: stats.failed, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "متوسط الدرجات", value: avgGrade, icon: ScrollText, color: "text-chart-4", bg: "bg-chart-4/10" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground leading-none">{stat.label}</p>
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* جدول النتائج */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              نتائج الطلاب
            </CardTitle>
            <div className="flex items-center gap-2">
              {canWrite && selectedStudents.size > 0 && (
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => setBulkNarrationOpen(true)}>
                  <ListChecks className="w-3.5 h-3.5" />
                  سرد جماعي ({selectedStudents.size})
                </Button>
              )}
              {canWrite && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddStudent(true)}>
                  <UserPlus className="w-3.5 h-3.5" />
                  إضافة طالب
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              {!session?.halaqa_id
                ? "هذه الجلسة غير مرتبطة بحلقة. عدّل الجلسة من الصفحة الرئيسية لإضافة حلقة."
                : "لا يوجد طلاب في هذه الحلقة"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canWrite && (
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={selectedStudents.size === rows.length && rows.length > 0}
                        onCheckedChange={toggleAll}
                        aria-label="تحديد الكل"
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-right min-w-[140px]">اسم الطالب</TableHead>
                  <TableHead className="text-center w-24">نوع السرد</TableHead>
                  <TableHead className="text-center w-20">الأحزاب</TableHead>
                  <TableHead className="text-center w-20">الأوجه</TableHead>
                  <TableHead className="text-center w-20">أخطاء</TableHead>
                  <TableHead className="text-center w-20">لحون</TableHead>
                  <TableHead className="text-center w-20">تنبيهات</TableHead>
                  <TableHead className="text-center w-20">الدرجة</TableHead>
                  <TableHead className="text-center w-24">الحالة</TableHead>
                  {canWrite && <TableHead className="w-20 text-center">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.student_id}
                    className={`${row.status === "absent" ? "opacity-50" : ""} ${selectedStudents.has(row.student_id) ? "bg-primary/5" : ""}`}
                  >
                    {canWrite && (
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedStudents.has(row.student_id)}
                          onCheckedChange={() => toggleStudent(row.student_id)}
                          aria-label={`تحديد ${row.student_name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-sm">{row.student_name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {row.narration_type === "regular" ? "منتظم" : "متعدد"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-primary">{row.total_hizb_count}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.total_pages_approx}</TableCell>
                    <TableCell className="text-center">{row.mistakes_count}</TableCell>
                    <TableCell className="text-center">{row.lahn_count}</TableCell>
                    <TableCell className="text-center">{row.warnings_count}</TableCell>
                    <TableCell className={`text-center font-semibold ${
                      row.status === "pass" ? "text-chart-2" : row.status === "fail" ? "text-destructive" : ""
                    }`}>
                      {row.status === "absent" ? "—" : row.grade}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.status === "pass" ? "default" : row.status === "fail" ? "destructive" : "secondary"} className="text-xs">
                        {row.status === "pass" ? "ناجح" : row.status === "fail" ? "راسب" : row.status === "absent" ? "غائب" : "معلّق"}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => setEditingStudent(row)}
                            title="تعديل النتيجة"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteStudentId(row.student_id)}
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* قالب الطباعة */}
      {session && (
        <div className="hidden print:block" ref={printRef}>
          <NarrationPrintTemplate
            session={session}
            rows={rows.map(r => ({
              student_id: r.student_id,
              student_name: r.student_name,
              narration_type: r.narration_type,
              ranges: r.ranges,
              total_hizb_count: r.total_hizb_count,
              total_pages_approx: r.total_pages_approx,
              mistakes_count: r.mistakes_count,
              lahn_count: r.lahn_count,
              warnings_count: r.warnings_count,
              grade: r.grade,
              status: r.status,
              notes: r.notes,
              manual_entry: r.manual_entry,
            }))}
            settings={settings ? {
              min_grade: settings.min_grade,
              max_grade: settings.max_grade,
              deduction_per_mistake: settings.deduction_per_mistake,
              deduction_per_lahn: settings.deduction_per_lahn,
              deduction_per_warning: settings.deduction_per_warning,
            } : undefined}
          />
        </div>
      )}

      {/* Dialog إدخال/تعديل النتيجة */}
      {settings && editingStudent && (
        <NarrationAttemptDialog
          open={!!editingStudent}
          onClose={() => setEditingStudent(null)}
          student={{ student_id: editingStudent.student_id, student_name: editingStudent.student_name }}
          settings={settings}
          existing={editingStudent.attempt_id ? {
            id: editingStudent.attempt_id,
            narration_type: editingStudent.narration_type,
            ranges: editingStudent.ranges,
            mistakes_count: editingStudent.mistakes_count,
            lahn_count: editingStudent.lahn_count,
            warnings_count: editingStudent.warnings_count,
            grade: editingStudent.grade,
            status: editingStudent.status,
            manual_entry: editingStudent.manual_entry,
            notes: editingStudent.notes,
          } : null}
          onSave={(data) => saveStudentAttempt(editingStudent.student_id, data)}
          saving={savingAttempt}
        />
      )}

      {/* Dialog إضافة طالب */}
      <Dialog open={showAddStudent} onOpenChange={(open) => { setShowAddStudent(open); if (!open) setSearchQuery(""); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <UserPlus className="w-4 h-4 text-primary" />
              إضافة طالب للجلسة
            </DialogTitle>
            <DialogDescription className="sr-only">
              ابحث عن طالب وأضفه إلى جلسة السرد الحالية
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث باسم الطالب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 text-right"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {allStudents.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">جارٍ التحميل...</p>
            ) : (() => {
              const filtered = allStudents.filter((s) => s.full_name.includes(searchQuery) || searchQuery === "");
              if (filtered.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">لا توجد نتائج</p>;
              return filtered.map((student) => {
                const alreadyAdded = rows.some((r) => r.student_id === student.id);
                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                      alreadyAdded ? "opacity-50 bg-muted border-border" : "bg-background border-border hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{student.full_name}</p>
                      {student.halaqat && <p className="text-xs text-muted-foreground">{student.halaqat.name}</p>}
                    </div>
                    {alreadyAdded ? (
                      <Badge variant="secondary" className="text-xs shrink-0 mr-2">مضاف</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 shrink-0 mr-2" onClick={() => addStudentManually(student)}>
                        إضافة
                      </Button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog تأكيد حذف */}
      <AlertDialog open={!!deleteStudentId} onOpenChange={(open) => { if (!open) setDeleteStudentId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إزالة هذا الطالب من جلسة السرد؟
              {rows.find(r => r.student_id === deleteStudentId)?.attempt_id && " سيتم حذف نتيجته المحفوظة نهائياً."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteStudentId && deleteStudent(deleteStudentId)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog سرد جماعي */}
      {settings && bulkNarrationOpen && selectedStudents.size > 0 && (
        <NarrationAttemptDialog
          open={bulkNarrationOpen}
          onClose={() => setBulkNarrationOpen(false)}
          student={{
            student_id: "bulk",
            student_name: `سرد جماعي (${selectedStudents.size} طالب)`,
          }}
          settings={settings}
          existing={null}
          onSave={saveBulkNarration}
          saving={bulkSaving}
        />
      )}
    </div>
  );
}
