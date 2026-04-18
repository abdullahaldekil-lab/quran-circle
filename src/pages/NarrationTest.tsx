import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StudentNameLink from "@/components/StudentNameLink";
import { formatDualDate, formatDateHijriOnly } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, FileSpreadsheet, FileText, CalendarDays, Save, History, CheckCircle, XCircle, Users, UserCheck, UserX, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

interface StudentRow {
  id: string;
  full_name: string;
  hizb: string;
  errors: number;
  warnings: number;
}

const HIZB_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i + 1));
const ATTENDANCE_SCORE = 50;
const PASS_THRESHOLD = 60;
// New scoring: error = 5 points, warning = 1 point (out of 50 narration max)
const ERROR_DEDUCTION = 5;
const WARNING_DEDUCTION = 1;

const calcNarrationScore = (errors: number, warnings: number) =>
  Math.max(0, 50 - errors * ERROR_DEDUCTION - warnings * WARNING_DEDUCTION);

const attemptLabel = (n: number) => (n === 1 ? "الأولى" : n === 2 ? "الثانية" : n >= 3 ? "الثالثة+" : "—");

const attemptBadgeClass = (n: number) =>
  n === 1
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : n === 2
    ? "bg-amber-100 text-amber-800 border-amber-300"
    : n >= 3
    ? "bg-red-100 text-red-800 border-red-300"
    : "";

type ResultFilter = "all" | "passed" | "failed";

const NarrationTest = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [studentRows, setStudentRows] = useState<Record<string, StudentRow>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("select");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const printRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const { hijri: hijriArabic, gregorian: gregorianArabic } = formatDualDate(today);

  const { data: halaqat = [] } = useQuery({
    queryKey: ["halaqat_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("halaqat").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students_halaqa", selectedHalaqaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("halaqa_id", selectedHalaqaId)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHalaqaId,
  });

  const studentIds = useMemo(() => students.map((s: any) => s.id), [students]);

  // Fetch ALL prior results for these students (used for: attempt counts, last-result classification, current hizb fallback)
  const { data: priorResults = [] } = useQuery({
    queryKey: ["narration_prior_results", selectedHalaqaId, studentIds.join(",")],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data, error } = await supabase
        .from("narration_test_results")
        .select("student_id, hizb_number, passed, attempt_number, test_date, created_at, narration_score, total_score")
        .eq("test_type", "narration")
        .in("student_id", studentIds)
        .order("test_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHalaqaId && studentIds.length > 0,
  });

  // Fetch active madarij enrollment to know each student's CURRENT hizb (the one they're working on)
  const { data: enrollments = [] } = useQuery({
    queryKey: ["madarij_active_enrollments", studentIds.join(",")],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data, error } = await supabase
        .from("madarij_enrollments")
        .select("student_id, hizb_number, status, updated_at")
        .in("student_id", studentIds)
        .eq("status", "active")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHalaqaId && studentIds.length > 0,
  });

  // History (separate query for the history tab with date filter)
  const { data: historyData = [] } = useQuery({
    queryKey: ["narration_test_history", selectedHalaqaId, historyDateFilter],
    queryFn: async () => {
      let query = supabase
        .from("narration_test_results")
        .select("*, students(full_name)")
        .eq("halaqa_id", selectedHalaqaId)
        .eq("test_type", "narration")
        .order("test_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (historyDateFilter) query = query.eq("test_date", historyDateFilter);
      const { data, error } = await query.limit(300);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHalaqaId && activeTab === "history",
  });

  // Build per-student summary: attempt count, last result, current hizb (from enrollment, fallback to last hizb)
  const studentSummary = useMemo(() => {
    const map: Record<string, {
      attemptCount: number;
      lastResult: { passed: boolean; date: string; hizb: number | null; score: number } | null;
      currentHizb: string;
    }> = {};
    const enrollmentByStudent: Record<string, number | null> = {};
    enrollments.forEach((e: any) => {
      if (!(e.student_id in enrollmentByStudent)) {
        enrollmentByStudent[e.student_id] = e.hizb_number ?? null;
      }
    });

    students.forEach((s: any) => {
      const prior = priorResults.filter((r: any) => r.student_id === s.id);
      const last = prior[0];
      const enrollHizb = enrollmentByStudent[s.id];
      const currentHizb = enrollHizb ? String(enrollHizb) : last?.hizb_number ? String(last.hizb_number) : "";
      map[s.id] = {
        attemptCount: prior.length,
        lastResult: last
          ? { passed: last.passed, date: last.test_date, hizb: last.hizb_number, score: last.total_score }
          : null,
        currentHizb,
      };
    });
    return map;
  }, [students, priorResults, enrollments]);

  // Categorize students
  const categorized = useMemo(() => {
    const notTested: any[] = [];
    const passed: any[] = [];
    const failed: any[] = [];
    students.forEach((s: any) => {
      const summary = studentSummary[s.id];
      if (!summary?.lastResult) notTested.push(s);
      else if (summary.lastResult.passed) passed.push(s);
      else failed.push(s);
    });
    return { notTested, passed, failed };
  }, [students, studentSummary]);

  // Sync student rows when selection changes
  useEffect(() => {
    setStudentRows((prev) => {
      const updated: Record<string, StudentRow> = {};
      selectedIds.forEach((id) => {
        const student = students.find((s: any) => s.id === id);
        if (!student) return;
        updated[id] = prev[id] || {
          id,
          full_name: student.full_name,
          hizb: studentSummary[id]?.currentHizb || "",
          errors: 0,
          warnings: 0,
        };
      });
      return updated;
    });
  }, [selectedIds, students, studentSummary]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllNotTested = () => {
    const allIds = categorized.notTested.map((s) => s.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const updateRow = (id: string, field: keyof StudentRow, value: any) => {
    setStudentRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const halaqaName = halaqat.find((h: any) => h.id === selectedHalaqaId)?.name || "";

  const getTableData = () =>
    Object.values(studentRows).map((row) => {
      const narrationScore = calcNarrationScore(row.errors, row.warnings);
      const total = narrationScore + ATTENDANCE_SCORE;
      const attemptNumber = (studentSummary[row.id]?.attemptCount || 0) + 1;
      return { ...row, narrationScore, total, passed: total >= PASS_THRESHOLD, attemptNumber };
    });

  const handleSave = async () => {
    const rows = getTableData();
    if (rows.length === 0) {
      toast.error("اختر طالباً واحداً على الأقل");
      return;
    }
    const missingHizb = rows.filter((r) => !r.hizb);
    if (missingHizb.length > 0) {
      toast.error(`يجب تحديد الحزب لجميع الطلاب (${missingHizb.length} متبقي)`);
      return;
    }
    setSaving(true);
    try {
      const records = rows.map((r) => ({
        student_id: r.id,
        halaqa_id: selectedHalaqaId,
        test_type: "narration" as string,
        test_date: todayStr,
        attempt_number: r.attemptNumber,
        hizb_number: parseInt(r.hizb),
        mistakes: r.errors,
        warnings: r.warnings,
        narration_score: Number(r.narrationScore.toFixed(1)),
        total_score: Number(r.total.toFixed(1)),
        passed: r.passed,
        created_by: user?.id || null,
      }));
      const { error } = await supabase.from("narration_test_results" as any).insert(records as any);
      if (error) throw error;
      toast.success(`تم حفظ نتائج ${records.length} طالب`);
      setSelectedIds(new Set());
      setStudentRows({});
      queryClient.invalidateQueries({ queryKey: ["narration_test_history"] });
      queryClient.invalidateQueries({ queryKey: ["narration_prior_results"] });
      setActiveTab("results");
    } catch (err: any) {
      toast.error("فشل حفظ النتائج: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", putOnlyUsedFonts: true });
    doc.text(`ورقة اختبار السرد — ${halaqaName}`, 14, 15);
    doc.text(`${todayStr} | ${hijriArabic}`, 14, 23);
    const rows = getTableData().map((r, i) => [
      String(i + 1), r.full_name, attemptLabel(r.attemptNumber), r.hizb || "—",
      String(r.errors), String(r.warnings), r.narrationScore.toFixed(1),
      r.total.toFixed(1), r.passed ? "ناجح" : "راسب",
    ]);
    autoTable(doc, {
      startY: 30,
      head: [["#", "الاسم", "المرة", "الحزب", "الأخطاء", "التنبيهات", "درجة السرد", "المجموع", "النتيجة"]],
      body: rows,
    });
    doc.save(`اختبار_السرد_${halaqaName}.pdf`);
  };

  const exportExcel = () => {
    const data = getTableData().map((r, i) => ({
      "#": i + 1, "الاسم": r.full_name, "المرة": attemptLabel(r.attemptNumber), "الحزب": r.hizb || "—",
      "الأخطاء": r.errors, "التنبيهات": r.warnings,
      "درجة السرد": Number(r.narrationScore.toFixed(1)), "المجموع": Number(r.total.toFixed(1)),
      "النتيجة": r.passed ? "ناجح" : "راسب", "التاريخ الميلادي": todayStr, "التاريخ الهجري": hijriArabic,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "اختبار السرد");
    XLSX.writeFile(wb, `اختبار_السرد_${halaqaName}.xlsx`);
  };

  const exportHistoryExcel = () => {
    if (!historyData.length) return;
    const data = historyData.map((r: any, i: number) => ({
      "#": i + 1, "التاريخ": r.test_date, "الاسم": r.students?.full_name || "—",
      "الحزب": r.hizb_number || "—", "المرة": r.attempt_number,
      "الأخطاء": r.mistakes, "التنبيهات": r.warnings,
      "درجة السرد": r.narration_score, "المجموع": r.total_score,
      "النتيجة": r.passed ? "ناجح" : "راسب",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل السرد");
    XLSX.writeFile(wb, `سجل_اختبار_السرد_${halaqaName}.xlsx`);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>ورقة اختبار السرد</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 20px; }
        h2, h3 { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #333; padding: 6px 10px; text-align: center; font-size: 13px; }
        th { background: #f0f0f0; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <h2>ورقة اختبار السرد — ${halaqaName}</h2>
      <h3>${todayStr} | ${hijriArabic}</h3>
      ${printContent.querySelector("table")?.outerHTML || ""}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const hasSelection = Object.keys(studentRows).length > 0;

  // Filter results lists by resultFilter (only relevant for "results" tab)
  const filteredPassed = resultFilter === "failed" ? [] : categorized.passed;
  const filteredFailed = resultFilter === "passed" ? [] : categorized.failed;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ورقة اختبار السرد</h1>
          <div className="flex items-center gap-2 text-sm mt-1">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{hijriArabic}</span>
            <span className="text-muted-foreground text-xs">، {gregorianArabic}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">الفلاتر</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>الحلقة</Label>
              <Select value={selectedHalaqaId} onValueChange={(v) => { setSelectedHalaqaId(v); setSelectedIds(new Set()); setStudentRows({}); }}>
                <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                <SelectContent>{halaqat.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>إجمالي الطلاب</Label>
              <p className="text-lg font-semibold mt-1">{students.length}</p>
            </div>
            <div>
              <Label>المختار للاختبار</Label>
              <p className="text-lg font-semibold mt-1 text-primary">{selectedIds.size}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedHalaqaId && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="select"><Users className="w-4 h-4 ml-1" />الطلاب ({categorized.notTested.length})</TabsTrigger>
            <TabsTrigger value="test" disabled={!hasSelection}><ClipboardList className="w-4 h-4 ml-1" />الاختبار ({selectedIds.size})</TabsTrigger>
            <TabsTrigger value="results"><UserCheck className="w-4 h-4 ml-1" />النتائج ({categorized.passed.length + categorized.failed.length})</TabsTrigger>
            <TabsTrigger value="history"><History className="w-4 h-4 ml-1" />السجل</TabsTrigger>
          </TabsList>

          {/* === SELECT TAB === */}
          <TabsContent value="select" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">الطلاب الذين لم يُختبروا بعد</CardTitle>
                  {categorized.notTested.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={toggleAllNotTested}>
                        {categorized.notTested.every((s) => selectedIds.has(s.id)) ? "إلغاء تحديد الكل" : "تحديد الكل"}
                      </Button>
                      <Button size="sm" onClick={() => setActiveTab("test")} disabled={selectedIds.size === 0}>
                        المتابعة للاختبار ({selectedIds.size})
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {categorized.notTested.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">جميع الطلاب تم اختبارهم — راجع تبويب النتائج</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categorized.notTested.map((s: any) => {
                      const summary = studentSummary[s.id];
                      const isSelected = selectedIds.has(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleStudent(s.id)}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleStudent(s.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{s.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              الحزب الحالي: <span className="font-semibold">{summary?.currentHizb || "—"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TEST TAB === */}
          <TabsContent value="test" className="mt-4">
            {hasSelection ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">إدخال نتائج الاختبار</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        <Save className="w-4 h-4 ml-1" />
                        {saving ? "جارٍ الحفظ..." : "حفظ النتائج"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
                      <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 ml-1" />Excel</Button>
                      <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="w-4 h-4 ml-1" />PDF</Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    احتساب الدرجات: خطأ = {ERROR_DEDUCTION} درجات، تنبيه = {WARNING_DEDUCTION} درجة. (من 50 + 50 حضور = 100)
                  </p>
                </CardHeader>
                <CardContent className="p-0" ref={printRef}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الاسم</TableHead>
                          <TableHead className="text-center w-28">المرة</TableHead>
                          <TableHead className="text-center w-24">الحزب</TableHead>
                          <TableHead className="text-center w-20">الأخطاء</TableHead>
                          <TableHead className="text-center w-20">التنبيهات</TableHead>
                          <TableHead className="text-center w-24">درجة السرد</TableHead>
                          <TableHead className="text-center w-20">المجموع</TableHead>
                          <TableHead className="text-center w-24">النتيجة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.values(studentRows).map((row) => {
                          const narrationScore = calcNarrationScore(row.errors, row.warnings);
                          const total = narrationScore + ATTENDANCE_SCORE;
                          const passed = total >= PASS_THRESHOLD;
                          const attemptNumber = (studentSummary[row.id]?.attemptCount || 0) + 1;
                          return (
                            <TableRow key={row.id}>
                              <TableCell><StudentNameLink studentId={row.id} studentName={row.full_name} /></TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={attemptBadgeClass(attemptNumber)}>
                                  {attemptLabel(attemptNumber)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Select value={row.hizb} onValueChange={(v) => updateRow(row.id, "hizb", v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="#" /></SelectTrigger>
                                  <SelectContent>{HIZB_OPTIONS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" min={0} value={row.errors}
                                  onChange={(e) => updateRow(row.id, "errors", Math.max(0, parseInt(e.target.value) || 0))}
                                  className="h-8 text-center text-xs w-16 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" min={0} value={row.warnings}
                                  onChange={(e) => updateRow(row.id, "warnings", Math.max(0, parseInt(e.target.value) || 0))}
                                  className="h-8 text-center text-xs w-16 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center font-semibold">{narrationScore.toFixed(1)}</TableCell>
                              <TableCell className="text-center font-bold">{total.toFixed(1)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={passed ? "default" : "destructive"} className={passed ? "bg-emerald-600" : ""}>
                                  {passed ? "ناجح" : "راسب"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-10 text-center text-muted-foreground">اختر طلاباً من تبويب "الطلاب" للبدء</CardContent></Card>
            )}
          </TabsContent>

          {/* === RESULTS TAB === */}
          <TabsContent value="results" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">نتائج آخر اختبار</CardTitle>
                  <Select value={resultFilter} onValueChange={(v: ResultFilter) => setResultFilter(v)}>
                    <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="passed">الناجحون فقط</SelectItem>
                      <SelectItem value="failed">الراسبون فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            </Card>

            {/* Passed */}
            {filteredPassed.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                    <UserCheck className="w-5 h-5" /> الناجحون ({filteredPassed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-center">المرة</TableHead>
                        <TableHead className="text-center">الحزب</TableHead>
                        <TableHead className="text-center">المجموع</TableHead>
                        <TableHead className="text-center">تاريخ الاختبار</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPassed.map((s: any) => {
                        const last = studentSummary[s.id]?.lastResult;
                        const attemptNumber = studentSummary[s.id]?.attemptCount || 0;
                        return (
                          <TableRow key={s.id}>
                            <TableCell><StudentNameLink studentId={s.id} studentName={s.full_name} /></TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={attemptBadgeClass(attemptNumber)}>
                                {attemptLabel(attemptNumber)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{last?.hizb || "—"}</TableCell>
                            <TableCell className="text-center font-bold text-emerald-700">{last?.score}</TableCell>
                            <TableCell className="text-center text-xs">{last && formatDateHijriOnly(last.date)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Failed */}
            {filteredFailed.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <UserX className="w-5 h-5" /> الراسبون ({filteredFailed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-center">المرة</TableHead>
                        <TableHead className="text-center">الحزب</TableHead>
                        <TableHead className="text-center">المجموع</TableHead>
                        <TableHead className="text-center">تاريخ الاختبار</TableHead>
                        <TableHead className="text-center">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFailed.map((s: any) => {
                        const last = studentSummary[s.id]?.lastResult;
                        const attemptNumber = studentSummary[s.id]?.attemptCount || 0;
                        return (
                          <TableRow key={s.id}>
                            <TableCell><StudentNameLink studentId={s.id} studentName={s.full_name} /></TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={attemptBadgeClass(attemptNumber)}>
                                {attemptLabel(attemptNumber)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{last?.hizb || "—"}</TableCell>
                            <TableCell className="text-center font-bold text-destructive">{last?.score}</TableCell>
                            <TableCell className="text-center text-xs">{last && formatDateHijriOnly(last.date)}</TableCell>
                            <TableCell className="text-center">
                              <Button size="sm" variant="outline" onClick={() => {
                                setSelectedIds((prev) => new Set([...prev, s.id]));
                                setActiveTab("test");
                              }}>إعادة الاختبار</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {filteredPassed.length === 0 && filteredFailed.length === 0 && (
              <Card><CardContent className="py-10 text-center text-muted-foreground">لا توجد نتائج بعد</CardContent></Card>
            )}
          </TabsContent>

          {/* === HISTORY TAB === */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">السجل الكامل — اختبار السرد</CardTitle>
                  <div className="flex gap-2 items-center">
                    <Input type="date" value={historyDateFilter} onChange={(e) => setHistoryDateFilter(e.target.value)}
                      className="w-44 h-8 text-xs" />
                    {historyDateFilter && (
                      <Button variant="ghost" size="sm" onClick={() => setHistoryDateFilter("")}>مسح</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={exportHistoryExcel} disabled={!historyData.length}>
                      <FileSpreadsheet className="w-4 h-4 ml-1" />تصدير
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-center">الحزب</TableHead>
                        <TableHead className="text-center">المرة</TableHead>
                        <TableHead className="text-center">الأخطاء</TableHead>
                        <TableHead className="text-center">التنبيهات</TableHead>
                        <TableHead className="text-center">درجة السرد</TableHead>
                        <TableHead className="text-center">المجموع</TableHead>
                        <TableHead className="text-center">النتيجة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد نتائج سابقة</TableCell></TableRow>
                      ) : (
                        historyData.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs">{formatDateHijriOnly(r.test_date)}</TableCell>
                            <TableCell>{r.students?.full_name || "—"}</TableCell>
                            <TableCell className="text-center">{r.hizb_number || "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={attemptBadgeClass(r.attempt_number)}>
                                {attemptLabel(r.attempt_number)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{r.mistakes}</TableCell>
                            <TableCell className="text-center">{r.warnings}</TableCell>
                            <TableCell className="text-center">{r.narration_score}</TableCell>
                            <TableCell className="text-center font-bold">{r.total_score}</TableCell>
                            <TableCell className="text-center">
                              {r.passed ? (
                                <span className="text-emerald-600 font-bold flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" />ناجح</span>
                              ) : (
                                <span className="text-destructive font-bold flex items-center justify-center gap-1"><XCircle className="w-4 h-4" />راسب</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default NarrationTest;
