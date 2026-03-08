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
import { Label } from "@/components/ui/label";
import { Printer, FileSpreadsheet, FileText, CalendarDays } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

interface StudentRow {
  id: string;
  full_name: string;
  attempt: string;
  seg1: number;
  seg2: number;
  seg3: number;
  seg4: number;
  seg5: number;
}

const ATTEMPT_OPTIONS = ["الأولى", "الثانية", "الثالثة"];
const PASS_THRESHOLD = 60;

const ReviewTest = () => {
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [studentRows, setStudentRows] = useState<Record<string, StudentRow>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const fullDateHeader = formatFullDateHeader(today);
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
    queryKey: ["students_halaqa_review", selectedHalaqaId],
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

  useMemo(() => {
    const newRows: Record<string, StudentRow> = {};
    students.forEach((s: any) => {
      newRows[s.id] = studentRows[s.id] || {
        id: s.id,
        full_name: s.full_name,
        attempt: "",
        seg1: 0, seg2: 0, seg3: 0, seg4: 0, seg5: 0,
      };
    });
    if (JSON.stringify(Object.keys(newRows)) !== JSON.stringify(Object.keys(studentRows))) {
      setStudentRows(newRows);
    }
  }, [students]);

  const updateRow = (id: string, field: keyof StudentRow, value: any) => {
    setStudentRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const calcTotal = (row: StudentRow) => row.seg1 + row.seg2 + row.seg3 + row.seg4 + row.seg5;

  const halaqaName = halaqat.find((h: any) => h.id === selectedHalaqaId)?.name || "";

  const getTableData = () =>
    Object.values(studentRows).map((row) => ({ ...row, total: calcTotal(row) }));

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", putOnlyUsedFonts: true });
    doc.text(`ورقة اختبار المراجعة — ${halaqaName}`, 14, 15);
    doc.text(`${todayStr} | ${hijriArabic}`, 14, 23);
    const rows = getTableData().map((r, i) => [
      String(i + 1), r.full_name, r.attempt || "—",
      String(r.seg1), String(r.seg2), String(r.seg3), String(r.seg4), String(r.seg5),
      String(r.total),
    ]);
    autoTable(doc, {
      startY: 30,
      head: [["#", "الاسم", "المرة", "مقطع 1", "مقطع 2", "مقطع 3", "مقطع 4", "مقطع 5", "الإجمالي"]],
      body: rows,
    });
    doc.save(`اختبار_المراجعة_${halaqaName}.pdf`);
  };

  const exportExcel = () => {
    const data = getTableData().map((r, i) => ({
      "#": i + 1,
      "الاسم": r.full_name,
      "المرة": r.attempt || "—",
      "المقطع الأول": r.seg1,
      "المقطع الثاني": r.seg2,
      "المقطع الثالث": r.seg3,
      "المقطع الرابع": r.seg4,
      "المقطع الخامس": r.seg5,
      "الإجمالي": r.total,
      "التاريخ الميلادي": todayStr,
      "التاريخ الهجري": hijriArabic,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "اختبار المراجعة");
    XLSX.writeFile(wb, `اختبار_المراجعة_${halaqaName}.xlsx`);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>ورقة اختبار المراجعة</title>
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
      <h2>ورقة اختبار المراجعة — ${halaqaName}</h2>
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
          <h1 className="text-2xl font-bold text-foreground">ورقة اختبار المراجعة</h1>
          <div className="flex items-center gap-2 text-sm mt-1">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{hijriArabic}</span>
            <span className="text-muted-foreground text-xs">، {gregorianArabic}</span>
          </div>
        </div>
        {hasData && (
          <div className="flex gap-2 flex-wrap">
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
              <Select value={selectedHalaqaId} onValueChange={(v) => { setSelectedHalaqaId(v); setStudentRows({}); }}>
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

      {hasData && (
        <Card>
          <CardContent className="p-0" ref={printRef}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-center w-28">عرض المرة</TableHead>
                    <TableHead className="text-center w-20">المقطع الأول</TableHead>
                    <TableHead className="text-center w-20">المقطع الثاني</TableHead>
                    <TableHead className="text-center w-20">المقطع الثالث</TableHead>
                    <TableHead className="text-center w-20">المقطع الرابع</TableHead>
                    <TableHead className="text-center w-20">المقطع الخامس</TableHead>
                    <TableHead className="text-center w-24">الدرجة الإجمالية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(studentRows).map((row) => {
                    const total = calcTotal(row);
                    const passed = total >= PASS_THRESHOLD;
                    return (
                      <TableRow key={row.id}>
                        <TableCell><StudentNameLink studentId={row.id} studentName={row.full_name} /></TableCell>
                        <TableCell className="text-center">
                          <Select value={row.attempt} onValueChange={(v) => updateRow(row.id, "attempt", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر" /></SelectTrigger>
                            <SelectContent>{ATTEMPT_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        {(["seg1", "seg2", "seg3", "seg4", "seg5"] as const).map((seg) => (
                          <TableCell key={seg} className="text-center">
                            <Input
                              type="number"
                              min={0}
                              value={row[seg]}
                              onChange={(e) => updateRow(row.id, seg, Math.max(0, parseInt(e.target.value) || 0))}
                              className="h-8 text-center text-xs w-16 mx-auto"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <span className={`font-bold text-lg ${passed ? "text-emerald-600" : "text-destructive"}`}>
                            {total}
                          </span>
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
        <Card><CardContent className="py-10 text-center text-muted-foreground">لا يوجد طلاب في هذه الحلقة</CardContent></Card>
      )}
    </div>
  );
};

export default ReviewTest;
