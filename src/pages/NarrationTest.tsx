import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StudentNameLink from "@/components/StudentNameLink";
import { formatFullDateHeader, formatDualDate } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Printer, FileSpreadsheet, FileText, CalendarDays } from "lucide-react";
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
const ATTENDANCE_SCORE = 50;
const PASS_THRESHOLD = 60;

const NarrationTest = () => {
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [studentRows, setStudentRows] = useState<Record<string, StudentRow>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const fullDateHeader = formatFullDateHeader(today);
  const { hijri: hijriArabic, gregorian: gregorianArabic } = formatDualDate(today);

  // Fetch halaqat
  const { data: halaqat = [] } = useQuery({
    queryKey: ["halaqat_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("halaqat").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch students for selected halaqa
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

  // Initialize rows when students change
  useMemo(() => {
    const newRows: Record<string, StudentRow> = {};
    students.forEach((s: any) => {
      newRows[s.id] = studentRows[s.id] || {
        id: s.id,
        full_name: s.full_name,
        attempt: "",
        hizb: "",
        errors: 0,
        warnings: 0,
      };
    });
    if (JSON.stringify(Object.keys(newRows)) !== JSON.stringify(Object.keys(studentRows))) {
      setStudentRows(newRows);
    }
  }, [students]);

  const updateRow = (id: string, field: keyof StudentRow, value: any) => {
    setStudentRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const calcNarrationScore = (errors: number, warnings: number) => {
    return Math.max(0, 50 - errors * 2 - warnings * 0.5);
  };

  const calcTotal = (errors: number, warnings: number) => {
    return calcNarrationScore(errors, warnings) + ATTENDANCE_SCORE;
  };

  const getStatus = (errors: number, warnings: number) => {
    return calcTotal(errors, warnings) >= PASS_THRESHOLD;
  };

  const halaqaName = halaqat.find((h: any) => h.id === selectedHalaqaId)?.name || "";

  const getTableData = () =>
    Object.values(studentRows).map((row) => {
      const narrationScore = calcNarrationScore(row.errors, row.warnings);
      const total = narrationScore + ATTENDANCE_SCORE;
      const passed = total >= PASS_THRESHOLD;
      return { ...row, narrationScore, total, passed };
    });

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", putOnlyUsedFonts: true });
    doc.text(`ورقة اختبار السرد — ${halaqaName}`, 14, 15);
    doc.text(`${todayStr} | ${hijriArabic}`, 14, 23);
    const rows = getTableData().map((r, i) => [
      String(i + 1),
      r.full_name,
      r.attempt || "—",
      r.hizb || "—",
      String(r.errors),
      String(r.warnings),
      r.narrationScore.toFixed(1),
      r.total.toFixed(1),
      r.passed ? "ناجح" : "راسب",
    ]);
    autoTable(doc, {
      startY: 30,
      head: [["#", "الاسم", "المرة", "الحزب", "الأخطاء", "التنبيهات", "درجة السرد", "المجموع", "النتيجة"]],
      body: rows,
    });
    doc.save(`اختبار_السرد_${halaqaName}.pdf`);
  };

  // Export Excel
  const exportExcel = () => {
    const data = getTableData().map((r, i) => ({
      "#": i + 1,
      "الاسم": r.full_name,
      "المرة": r.attempt || "—",
      "الحزب": r.hizb || "—",
      "الأخطاء": r.errors,
      "التنبيهات": r.warnings,
      "درجة السرد": Number(r.narrationScore.toFixed(1)),
      "المجموع": Number(r.total.toFixed(1)),
      "النتيجة": r.passed ? "ناجح" : "راسب",
      "التاريخ الميلادي": todayStr,
      "التاريخ الهجري": hijriArabic,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "اختبار السرد");
    XLSX.writeFile(wb, `اختبار_السرد_${halaqaName}.xlsx`);
  };

  // Print
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
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
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

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ورقة اختبار السرد</h1>
          <p className="text-muted-foreground">
            {todayStr} — {hijriArabic}
          </p>
        </div>
        {selectedHalaqaId && Object.keys(studentRows).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 ml-1" />طباعة
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="w-4 h-4 ml-1" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="w-4 h-4 ml-1" />PDF
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">الفلاتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>الحلقة</Label>
              <Select
                value={selectedHalaqaId}
                onValueChange={(v) => {
                  setSelectedHalaqaId(v);
                  setStudentRows({});
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                <SelectContent>
                  {halaqat.map((h: any) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>عدد الطلاب</Label>
              <p className="text-lg font-semibold mt-1">{Object.keys(studentRows).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {selectedHalaqaId && Object.keys(studentRows).length > 0 && (
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
                        <TableCell>
                          <StudentNameLink studentId={row.id} studentName={row.full_name} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Select value={row.attempt} onValueChange={(v) => updateRow(row.id, "attempt", v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="اختر" />
                            </SelectTrigger>
                            <SelectContent>
                              {ATTEMPT_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select value={row.hizb} onValueChange={(v) => updateRow(row.id, "hizb", v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="#" />
                            </SelectTrigger>
                            <SelectContent>
                              {HIZB_OPTIONS.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            value={row.errors}
                            onChange={(e) => updateRow(row.id, "errors", Math.max(0, parseInt(e.target.value) || 0))}
                            className="h-8 text-center text-xs w-16 mx-auto"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            value={row.warnings}
                            onChange={(e) => updateRow(row.id, "warnings", Math.max(0, parseInt(e.target.value) || 0))}
                            className="h-8 text-center text-xs w-16 mx-auto"
                          />
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
      )}

      {selectedHalaqaId && Object.keys(studentRows).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            لا يوجد طلاب في هذه الحلقة
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NarrationTest;
