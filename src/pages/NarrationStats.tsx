import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gregorianToHijri, formatHijriArabic } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileSpreadsheet, FileText, Users, BookOpen, CheckCircle, BarChart3 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

const NarrationStats = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const hijriStr = gregorianToHijri(today);
  const hijriArabic = hijriStr ? formatHijriArabic(hijriStr) : "";

  // Fetch halaqat
  const { data: halaqat = [] } = useQuery({
    queryKey: ["halaqat_active_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("halaqat").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's narration sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ["narration_sessions_today", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_sessions")
        .select("id, halaqa_id")
        .eq("session_date", todayStr);
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's attempts
  const { data: attempts = [] } = useQuery({
    queryKey: ["narration_attempts_today", todayStr],
    queryFn: async () => {
      const sessionIds = sessions.map((s: any) => s.id);
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("narration_attempts")
        .select("*, narration_sessions(halaqa_id)")
        .in("session_id", sessionIds);
      if (error) throw error;
      return data;
    },
    enabled: sessions.length > 0,
  });

  // Fetch attendance for today
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance_today_stats", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, halaqa_id, status")
        .eq("attendance_date", todayStr)
        .eq("status", "present");
      if (error) throw error;
      return data;
    },
  });

  // Fetch narration goals per halaqa
  const { data: goals = [] } = useQuery({
    queryKey: ["narration_goals_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_goals")
        .select("halaqa_id, target_hizb_count");
      if (error) throw error;
      return data;
    },
  });

  const halaqaStats = useMemo(() => {
    return halaqat.map((h: any) => {
      const halaqaAttendance = attendance.filter((a: any) => a.halaqa_id === h.id).length;
      const halaqaAttempts = attempts.filter((a: any) => a.narration_sessions?.halaqa_id === h.id);
      const totalHizbDisplayed = halaqaAttempts.reduce((sum: number, a: any) => sum + (a.total_hizb_count || 0), 0);
      const passedAttempts = halaqaAttempts.filter((a: any) => a.status === "passed");
      const failedAttempts = halaqaAttempts.filter((a: any) => a.status === "failed");
      const hizbPassed = passedAttempts.reduce((sum: number, a: any) => sum + (a.total_hizb_count || 0), 0);
      const hizbFailed = failedAttempts.reduce((sum: number, a: any) => sum + (a.total_hizb_count || 0), 0);

      const goal = goals.find((g: any) => g.halaqa_id === h.id);
      const hizbRequired = goal?.target_hizb_count || 0;
      const hizbRemaining = Math.max(0, hizbRequired - hizbPassed);

      const pctDisplayed = hizbRequired > 0 ? Math.round((totalHizbDisplayed / hizbRequired) * 100) : 0;
      const pctPassed = hizbRequired > 0 ? Math.round((hizbPassed / hizbRequired) * 100) : 0;
      const pctFailed = hizbRequired > 0 ? Math.round((hizbFailed / hizbRequired) * 100) : 0;
      const pctRemaining = hizbRequired > 0 ? Math.round((hizbRemaining / hizbRequired) * 100) : 0;
      const generalPct = hizbRequired > 0 ? Math.round((hizbPassed / hizbRequired) * 100) : 0;

      return {
        id: h.id,
        name: h.name,
        attendance: halaqaAttendance,
        hizbRequired,
        hizbDisplayed: totalHizbDisplayed,
        hizbPassed,
        hizbFailed,
        hizbRemaining,
        pctDisplayed,
        pctPassed,
        pctFailed,
        pctRemaining,
        generalPct,
      };
    });
  }, [halaqat, attempts, attendance, goals]);

  const totals = useMemo(() => {
    const t = {
      attendance: 0, hizbRequired: 0, hizbDisplayed: 0, hizbPassed: 0,
      hizbFailed: 0, hizbRemaining: 0,
    };
    halaqaStats.forEach((h) => {
      t.attendance += h.attendance;
      t.hizbRequired += h.hizbRequired;
      t.hizbDisplayed += h.hizbDisplayed;
      t.hizbPassed += h.hizbPassed;
      t.hizbFailed += h.hizbFailed;
      t.hizbRemaining += h.hizbRemaining;
    });
    return {
      ...t,
      pctDisplayed: t.hizbRequired > 0 ? Math.round((t.hizbDisplayed / t.hizbRequired) * 100) : 0,
      pctPassed: t.hizbRequired > 0 ? Math.round((t.hizbPassed / t.hizbRequired) * 100) : 0,
      pctFailed: t.hizbRequired > 0 ? Math.round((t.hizbFailed / t.hizbRequired) * 100) : 0,
      pctRemaining: t.hizbRequired > 0 ? Math.round((t.hizbRemaining / t.hizbRequired) * 100) : 0,
      generalPct: t.hizbRequired > 0 ? Math.round((t.hizbPassed / t.hizbRequired) * 100) : 0,
    };
  }, [halaqaStats]);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", putOnlyUsedFonts: true });
    doc.text("إحصائيات يوم السرد القرآني", 14, 15);
    doc.text(`${todayStr} | ${hijriArabic}`, 14, 23);
    const head = [["الحلقة", "الحضور", "مطلوب", "معروض", "مجتاز", "راسب", "متبقي", "معروض%", "اجتياز%", "رسوب%", "متبقي%", "عامة%"]];
    const rows = halaqaStats.map((h) => [
      h.name, h.attendance, h.hizbRequired, h.hizbDisplayed, h.hizbPassed, h.hizbFailed, h.hizbRemaining,
      `${h.pctDisplayed}%`, `${h.pctPassed}%`, `${h.pctFailed}%`, `${h.pctRemaining}%`, `${h.generalPct}%`,
    ]);
    rows.push(["إجمالي المجمع", totals.attendance, totals.hizbRequired, totals.hizbDisplayed, totals.hizbPassed,
      totals.hizbFailed, totals.hizbRemaining, `${totals.pctDisplayed}%`, `${totals.pctPassed}%`,
      `${totals.pctFailed}%`, `${totals.pctRemaining}%`, `${totals.generalPct}%`]);
    autoTable(doc, { startY: 30, head, body: rows });
    doc.save(`إحصائيات_السرد_${todayStr}.pdf`);
  };

  const exportExcel = () => {
    const data = [
      ...halaqaStats.map((h) => ({
        "الحلقة": h.name, "الحضور": h.attendance, "الأحزاب المطلوبة": h.hizbRequired,
        "المعروضة": h.hizbDisplayed, "المجتازة": h.hizbPassed, "الراسبة": h.hizbFailed,
        "المتبقية": h.hizbRemaining, "نسبة المعروض%": h.pctDisplayed,
        "نسبة الاجتياز%": h.pctPassed, "نسبة الرسوب%": h.pctFailed,
        "نسبة المتبقي%": h.pctRemaining, "النسبة العامة%": h.generalPct,
      })),
      {
        "الحلقة": "إجمالي المجمع", "الحضور": totals.attendance, "الأحزاب المطلوبة": totals.hizbRequired,
        "المعروضة": totals.hizbDisplayed, "المجتازة": totals.hizbPassed, "الراسبة": totals.hizbFailed,
        "المتبقية": totals.hizbRemaining, "نسبة المعروض%": totals.pctDisplayed,
        "نسبة الاجتياز%": totals.pctPassed, "نسبة الرسوب%": totals.pctFailed,
        "نسبة المتبقي%": totals.pctRemaining, "النسبة العامة%": totals.generalPct,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "إحصائيات السرد");
    XLSX.writeFile(wb, `إحصائيات_السرد_${todayStr}.xlsx`);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>إحصائيات يوم السرد</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 20px; }
        h2, h3 { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #333; padding: 6px 8px; text-align: center; font-size: 12px; }
        th { background: #f0f0f0; }
        tr:last-child { background: #333; color: #fff; font-weight: bold; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <h2>إحصائيات يوم السرد القرآني</h2>
      <h3>${todayStr} | ${hijriArabic}</h3>
      ${printContent.querySelector("table")?.outerHTML || ""}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const summaryCards = [
    { label: "إجمالي الحضور", value: totals.attendance, icon: Users, color: "text-primary" },
    { label: "الأحزاب المعروضة", value: totals.hizbDisplayed, icon: BookOpen, color: "text-emerald-600" },
    { label: "الأحزاب المجتازة", value: totals.hizbPassed, icon: CheckCircle, color: "text-emerald-600" },
    { label: "النسبة العامة", value: `${totals.generalPct}%`, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إحصائيات يوم السرد القرآني</h1>
          <p className="text-muted-foreground">{todayStr} — {hijriArabic}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 ml-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="w-4 h-4 ml-1" />PDF</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{card.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Table */}
      <Card>
        <CardContent className="p-0" ref={printRef}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الحلقة</TableHead>
                  <TableHead className="text-center">الحضور</TableHead>
                  <TableHead className="text-center">المطلوبة</TableHead>
                  <TableHead className="text-center">المعروضة</TableHead>
                  <TableHead className="text-center">المجتازة</TableHead>
                  <TableHead className="text-center">الراسبة</TableHead>
                  <TableHead className="text-center">المتبقية</TableHead>
                  <TableHead className="text-center">معروض%</TableHead>
                  <TableHead className="text-center">اجتياز%</TableHead>
                  <TableHead className="text-center">رسوب%</TableHead>
                  <TableHead className="text-center">متبقي%</TableHead>
                  <TableHead className="text-center">عامة%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {halaqaStats.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="text-center">{h.attendance}</TableCell>
                    <TableCell className="text-center">{h.hizbRequired}</TableCell>
                    <TableCell className="text-center">{h.hizbDisplayed}</TableCell>
                    <TableCell className="text-center text-emerald-600 font-semibold">{h.hizbPassed}</TableCell>
                    <TableCell className="text-center text-destructive font-semibold">{h.hizbFailed}</TableCell>
                    <TableCell className="text-center">{h.hizbRemaining}</TableCell>
                    <TableCell className="text-center">{h.pctDisplayed}%</TableCell>
                    <TableCell className="text-center">{h.pctPassed}%</TableCell>
                    <TableCell className="text-center">{h.pctFailed}%</TableCell>
                    <TableCell className="text-center">{h.pctRemaining}%</TableCell>
                    <TableCell className="text-center font-bold">{h.generalPct}%</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-foreground/90 text-background font-bold">
                  <TableCell className="font-bold">إجمالي المجمع</TableCell>
                  <TableCell className="text-center">{totals.attendance}</TableCell>
                  <TableCell className="text-center">{totals.hizbRequired}</TableCell>
                  <TableCell className="text-center">{totals.hizbDisplayed}</TableCell>
                  <TableCell className="text-center">{totals.hizbPassed}</TableCell>
                  <TableCell className="text-center">{totals.hizbFailed}</TableCell>
                  <TableCell className="text-center">{totals.hizbRemaining}</TableCell>
                  <TableCell className="text-center">{totals.pctDisplayed}%</TableCell>
                  <TableCell className="text-center">{totals.pctPassed}%</TableCell>
                  <TableCell className="text-center">{totals.pctFailed}%</TableCell>
                  <TableCell className="text-center">{totals.pctRemaining}%</TableCell>
                  <TableCell className="text-center">{totals.generalPct}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NarrationStats;
