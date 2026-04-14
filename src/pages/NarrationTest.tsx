import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StudentNameLink from "@/components/StudentNameLink";
import { formatFullDateHeader, formatDualDate, formatDateHijriOnly } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, FileSpreadsheet, FileText, CalendarDays, Save, History, CheckCircle, XCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

interface StudentRow {
  id: string;
  full_name: string;
  attempt: string;
  hizb: string;
  errors: number;
  warnings: number;
}

const HIZB_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i + 1));
const ATTEMPT_OPTIONS = ["الأولى", "الثانية", "الثالثة"];
const ATTEMPT_MAP: Record<string, number> = { "الأولى": 1, "الثانية": 2, "الثالثة": 3 };
const ATTENDANCE_SCORE = 50;
const PASS_THRESHOLD = 60;

const NarrationTest = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [studentRows, setStudentRows] = useState<Record<string, StudentRow>>({});
  const [editingAttempt, setEditingAttempt] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("test");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
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
      if (historyDateFilter) {
        query = query.eq("test_date", historyDateFilter);
      }
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHalaqaId && activeTab === "history",
  });

  // Fetch previous attempt counts for auto-detection
  const { data: attemptCounts = {} } = useQuery({
    queryKey: ["narration_attempt_counts", selectedHalaqaId, students.map((s: any) => s.id).join(",")],
    queryFn: async () => {
      if (!students.length) return {};
      const studentIds = students.map((s: any) => s.id);
      const { data, error } = await supabase
        .from("narration_test_results" as any)
        .select("student_id")
        .eq("halaqa_id", selectedHalaqaId)
        .eq("test_type", "narration")
        .in("student_id", studentIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[])?.forEach((r: any) => {
        counts[r.student_id] = (counts[r.student_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!selectedHalaqaId && students.length > 0,
  });

  const getAutoAttempt = (studentId: string): string => {
    const count = (attemptCounts as Record<string, number>)[studentId] || 0;
    if (count === 0) return "الأولى";
    if (count === 1) return "الثانية";
    return "الثالثة";
  };

  useMemo(() => {
    const newRows: Record<string, StudentRow> = {};
    students.forEach((s: any) => {
      newRows[s.id] = studentRows[s.id] || {
        id: s.id, full_name: s.full_name, attempt: "", hizb: "", errors: 0, warnings: 0,
      };
    });
    if (JSON.stringify(Object.keys(newRows)) !== JSON.stringify(Object.keys(studentRows))) {
      setStudentRows(newRows);
      setEditingAttempt({});
      setSaved(false);
    }
  }, [students]);

  // Auto-set attempts when attemptCounts loads
  useEffect(() => {
    if (Object.keys(attemptCounts).length === 0 && students.length === 0) return;
    setStudentRows((prev) => {
      const updated = { ...prev };
      let changed = false;
      Object.keys(updated).forEach((id) => {
        if (!updated[id].attempt) {
          updated[id] = { ...updated[id], attempt: getAutoAttempt(id) };
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [attemptCounts]);

  const updateRow = (id: string, field: keyof StudentRow, value: any) => {
    setStudentRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setSaved(false);
  };

  const calcNarrationScore = (errors: number, warnings: number) =>
    Math.max(0, 50 - errors * 2 - warnings * 0.5);

  const calcTotal = (errors: number, warnings: number) =>
    calcNarrationScore(errors, warnings) + ATTENDANCE_SCORE;

  const halaqaName = halaqat.find((h: any) => h.id === selectedHalaqaId)?.name || "";

  const getTableData = () =>
    Object.values(studentRows).map((row) => {
      const narrationScore = calcNarrationScore(row.errors, row.warnings);
      const total = narrationScore + ATTENDANCE_SCORE;
      return { ...row, narrationScore, total, passed: total >= PASS_THRESHOLD };
    });

  const handleSave = async () => {
    const rows = getTableData();
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const records = rows.map((r) => ({
        student_id: r.id,
        halaqa_id: selectedHalaqaId,
        test_type: "narration" as string,
        test_date: todayStr,
        attempt_number: ATTEMPT_MAP[r.attempt] || 1,
        hizb_number: r.hizb ? parseInt(r.hizb) : null,
        mistakes: r.errors,
        warnings: r.warnings,
        narration_score: Number(r.narrationScore.toFixed(1)),
        total_score: Number(r.total.toFixed(1)),
        passed: r.passed,
        created_by: user?.id || null,
      }));
      const { error } = await supabase.from("narration_test_results" as any).insert(records as any);
      if (error) throw error;
      setSaved(true);
      toast.success("تم حفظ النتائج بنجاح");
      queryClient.invalidateQueries({ queryKey: ["narration_test_history"] });
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
      String(i + 1), r.full_name, r.attempt || "—", r.hizb || "—",
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
      "#": i + 1, "الاسم": r.full_name, "المرة": r.attempt || "—", "الحزب": r.hizb || "—",
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
      "#": i + 1,
      "التاريخ": r.test_date,
      "الاسم": r.students?.full_name || "—",
      "الحزب": r.hizb_number || "—",
      "المرة": r.attempt_number,
      "الأخطاء": r.mistakes,
      "التنبيهات": r.warnings,
      "درجة السرد": r.narration_score,
      "المجموع": r.total_score,
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

  const hasData = selectedHalaqaId && Object.keys(studentRows).length > 0;

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
        {hasData && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handleSave} disabled={saving || saved}>
              <Save className="w-4 h-4 ml-1" />
              {saving ? "جارٍ الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ النتائج"}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
            <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 ml-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="w-4 h-4 ml-1" />PDF</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">الفلاتر</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>الحلقة</Label>
              <Select value={selectedHalaqaId} onValueChange={(v) => { setSelectedHalaqaId(v); setStudentRows({}); setSaved(false); }}>
                <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                <SelectContent>{halaqat.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>عدد الطلاب</Label>
              <p className="text-lg font-semibold mt-1">{Object.keys(studentRows).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedHalaqaId && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="test"><FileText className="w-4 h-4 ml-1" />الاختبار</TabsTrigger>
            <TabsTrigger value="history"><History className="w-4 h-4 ml-1" />السجل السابق</TabsTrigger>
          </TabsList>

          <TabsContent value="test">
            {hasData ? (
              <Card>
                <CardContent className="p-0" ref={printRef}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الاسم</TableHead>
                          <TableHead className="text-center w-28">عرض المرة</TableHead>
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
                          const total = calcTotal(row.errors, row.warnings);
                          const passed = total >= PASS_THRESHOLD;
                          return (
                            <TableRow key={row.id}>
                              <TableCell><StudentNameLink studentId={row.id} studentName={row.full_name} /></TableCell>
                              <TableCell className="text-center">
                                {editingAttempt[row.id] ? (
                                  <Select value={row.attempt} onValueChange={(v) => { updateRow(row.id, "attempt", v); setEditingAttempt((p) => ({ ...p, [row.id]: false })); }}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر" /></SelectTrigger>
                                    <SelectContent>{ATTEMPT_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <Badge variant="outline" className={
                                      row.attempt === "الأولى" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                      row.attempt === "الثانية" ? "bg-amber-100 text-amber-800 border-amber-300" :
                                      row.attempt === "الثالثة" ? "bg-red-100 text-red-800 border-red-300" :
                                      ""
                                    }>
                                      {row.attempt || "—"}
                                    </Badge>
                                    <button onClick={() => setEditingAttempt((p) => ({ ...p, [row.id]: true }))} className="text-muted-foreground hover:text-foreground transition-colors">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
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
              Object.keys(studentRows).length === 0 && (
                <Card><CardContent className="py-10 text-center text-muted-foreground">لا يوجد طلاب في هذه الحلقة</CardContent></Card>
              )
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">السجل السابق — اختبار السرد</CardTitle>
                  <div className="flex gap-2 items-center">
                    <Input type="date" value={historyDateFilter} onChange={(e) => setHistoryDateFilter(e.target.value)}
                      className="w-44 h-8 text-xs" placeholder="فلتر بالتاريخ" />
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
                            <TableCell>{formatDateHijriOnly(r.test_date)}</TableCell>
                            <TableCell>{r.students?.full_name || "—"}</TableCell>
                            <TableCell className="text-center">{r.hizb_number || "—"}</TableCell>
                            <TableCell className="text-center">{r.attempt_number}</TableCell>
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
