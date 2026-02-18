import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Printer, Save, ScrollText, CheckCircle2, XCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NarrationPrintTemplate from "@/components/NarrationPrintTemplate";

interface NarrationSettings {
  id: string;
  min_grade: number;
  max_grade: number;
  deduction_per_mistake: number;
  deduction_per_lahn: number;
  deduction_per_warning: number;
}

interface StudentResult {
  id?: string;
  student_id: string;
  student_name: string;
  hizb_from: number;
  hizb_to: number;
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

  const [rows, setRows] = useState<StudentResult[]>([]);
  const [isDirty, setIsDirty] = useState(false);

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
      return (data as unknown) as NarrationSettings;
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
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return (data as { id: string; full_name: string }[]) || [];
    },
    enabled: !!session?.halaqa_id,
  });

  // جلب النتائج الموجودة
  const { data: existingResults = [] } = useQuery({
    queryKey: ["narration-results", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_results" as any)
        .select("*")
        .eq("session_id", sessionId!);
      if (error) throw error;
      return (data as unknown) as (StudentResult & { id: string; session_id: string })[];
    },
    enabled: !!sessionId,
  });

  // بناء الصفوف عند تحميل الطلاب والنتائج
  useEffect(() => {
    if (students.length === 0) return;
    const resultMap = new Map(existingResults.map((r) => [r.student_id, r]));
    const maxGrade = settings?.max_grade ?? 100;
    const minGrade = settings?.min_grade ?? 70;

    setRows(
      students.map((s) => {
        const existing = resultMap.get(s.id);
        if (existing) {
          return {
            id: existing.id,
            student_id: s.id,
            student_name: s.full_name,
            hizb_from: existing.hizb_from,
            hizb_to: existing.hizb_to,
            mistakes_count: existing.mistakes_count,
            lahn_count: existing.lahn_count,
            warnings_count: existing.warnings_count,
            grade: existing.grade,
            status: existing.status as StudentResult["status"],
            notes: existing.notes || "",
            manual_entry: existing.manual_entry,
          };
        }
        return {
          student_id: s.id,
          student_name: s.full_name,
          hizb_from: 1,
          hizb_to: 1,
          mistakes_count: 0,
          lahn_count: 0,
          warnings_count: 0,
          grade: maxGrade,
          status: "pending",
          notes: "",
          manual_entry: false,
        };
      })
    );
  }, [students, existingResults, settings]);

  // حساب الدرجة تلقائياً
  const calcGrade = (row: StudentResult, s: NarrationSettings) => {
    if (row.manual_entry) return row.grade;
    const raw =
      s.max_grade -
      row.mistakes_count * s.deduction_per_mistake -
      row.lahn_count * s.deduction_per_lahn -
      row.warnings_count * s.deduction_per_warning;
    return Math.max(0, Math.min(s.max_grade, raw));
  };

  const updateRow = (
    index: number,
    field: keyof StudentResult,
    value: string | number | boolean
  ) => {
    setIsDirty(true);
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === "status" && value === "absent") {
        updated[index] = { ...row, status: "absent" };
        return updated;
      }

      if (settings && !row.manual_entry && field !== "manual_entry" && field !== "grade") {
        const newGrade = calcGrade(row as StudentResult, settings);
        const newStatus: StudentResult["status"] =
          row.status === "absent"
            ? "absent"
            : newGrade >= settings.min_grade
            ? "pass"
            : "fail";
        updated[index] = { ...row, grade: newGrade, status: newStatus };
      } else if (field === "manual_entry" && value === false && settings) {
        const newGrade = calcGrade(row as StudentResult, settings);
        const newStatus: StudentResult["status"] =
          newGrade >= settings.min_grade ? "pass" : "fail";
        updated[index] = { ...row, grade: newGrade, status: newStatus };
      } else if (field === "grade" && settings) {
        const newStatus: StudentResult["status"] =
          Number(value) >= settings.min_grade ? "pass" : "fail";
        updated[index] = { ...row, manual_entry: true, status: newStatus };
      } else {
        updated[index] = row;
      }
      return updated;
    });
  };

  // حفظ الكل
  const saveMutation = useMutation({
    mutationFn: async () => {
      const upsertData = rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        session_id: sessionId!,
        student_id: r.student_id,
        hizb_from: r.hizb_from,
        hizb_to: r.hizb_to,
        mistakes_count: r.mistakes_count,
        lahn_count: r.lahn_count,
        warnings_count: r.warnings_count,
        grade: r.grade,
        status: r.status,
        notes: r.notes || null,
        manual_entry: r.manual_entry,
      }));

      const { error } = await supabase
        .from("narration_results" as any)
        .upsert(upsertData, { onConflict: "session_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["narration-results", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["narration-results-all"] });
      setIsDirty(false);
      toast({ title: "تم حفظ النتائج بنجاح ✓" });
    },
    onError: (err: any) => {
      toast({ title: `حدث خطأ: ${err.message}`, variant: "destructive" });
    },
  });

  const handlePrint = () => {
    window.print();
  };

  // الإحصائيات السريعة
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
      ? (rows
          .filter((r) => r.status !== "absent" && r.status !== "pending")
          .reduce((s, r) => s + r.grade, 0) /
          stats.present
        ).toFixed(1)
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
          {canWrite && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !isDirty}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ الكل"}
            </Button>
          )}
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

      {/* جدول الإدخال */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            نتائج الطلاب
            {isDirty && (
              <Badge variant="outline" className="text-chart-4 border-chart-4/30 text-xs">
                يوجد تغييرات غير محفوظة
              </Badge>
            )}
          </CardTitle>
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
                  <TableHead className="text-right min-w-[140px]">اسم الطالب</TableHead>
                  <TableHead className="text-center w-20">من حزب</TableHead>
                  <TableHead className="text-center w-20">إلى حزب</TableHead>
                  <TableHead className="text-center w-20">أخطاء</TableHead>
                  <TableHead className="text-center w-20">لحون</TableHead>
                  <TableHead className="text-center w-20">تنبيهات</TableHead>
                  <TableHead className="text-center w-20">الدرجة</TableHead>
                  <TableHead className="text-center w-28">الحالة</TableHead>
                  <TableHead className="text-right min-w-[120px]">ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={row.student_id}
                    className={row.status === "absent" ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium text-sm">{row.student_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={row.hizb_from}
                        onChange={(e) => updateRow(i, "hizb_from", Number(e.target.value))}
                        disabled={!canWrite || row.status === "absent"}
                        className="w-16 text-center h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={row.hizb_to}
                        onChange={(e) => updateRow(i, "hizb_to", Number(e.target.value))}
                        disabled={!canWrite || row.status === "absent"}
                        className="w-16 text-center h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.mistakes_count}
                        onChange={(e) => updateRow(i, "mistakes_count", Number(e.target.value))}
                        disabled={!canWrite || row.status === "absent"}
                        className="w-16 text-center h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.lahn_count}
                        onChange={(e) => updateRow(i, "lahn_count", Number(e.target.value))}
                        disabled={!canWrite || row.status === "absent"}
                        className="w-16 text-center h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.warnings_count}
                        onChange={(e) => updateRow(i, "warnings_count", Number(e.target.value))}
                        disabled={!canWrite || row.status === "absent"}
                        className="w-16 text-center h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={settings?.max_grade ?? 100}
                        step="0.5"
                        value={row.grade}
                        onChange={(e) => updateRow(i, "grade", Number(e.target.value))}
                        disabled={!canWrite || row.status === "absent"}
                        className={`w-16 text-center h-8 text-sm font-semibold ${
                          row.status === "pass"
                            ? "text-chart-2"
                            : row.status === "fail"
                            ? "text-destructive"
                            : ""
                        }`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.status}
                        onValueChange={(v) => updateRow(i, "status", v)}
                        disabled={!canWrite}
                      >
                        <SelectTrigger className="h-8 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">معلّق</SelectItem>
                          <SelectItem value="pass">اجتاز ✓</SelectItem>
                          <SelectItem value="fail">راسب ✗</SelectItem>
                          <SelectItem value="absent">غائب</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="ملاحظة..."
                        value={row.notes}
                        onChange={(e) => updateRow(i, "notes", e.target.value)}
                        disabled={!canWrite}
                        className="h-8 text-xs min-w-[100px]"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* قالب الطباعة (مخفي في العرض العادي) */}
      {session && (
        <div className="hidden print:block" ref={printRef}>
          <NarrationPrintTemplate
            session={session}
            rows={rows}
            settings={settings}
          />
        </div>
      )}
    </div>
  );
}
