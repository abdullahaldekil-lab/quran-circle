import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { PageDateHeader } from "@/components/PageDateHeader";
import { Scale, Users, Trophy, BookOpen, Eye, AlertCircle, Music, TrendingUp, Printer, FileDown, ChevronDown, RotateCcw, Crown } from "lucide-react";
import { getCurrentFullDateHeader } from "@/lib/hijri";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PERIOD_OPTIONS = [
  { value: "1", label: "آخر شهر" },
  { value: "3", label: "آخر 3 أشهر" },
  { value: "6", label: "آخر 6 أشهر" },
  { value: "12", label: "السنة كاملة" },
];

const COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];

const DEFAULT_WEIGHTS = {
  avgScore: 25,
  attendanceRate: 20,
  totalPages: 15,
  totalHizb: 15,
  avgMistakes: 10,
  avgRecitationScore: 15,
};

const CRITERIA = [
  { key: "avgScore", label: "درجة التميز", icon: Trophy, best: "max" as const },
  { key: "attendanceRate", label: "الحضور %", icon: Users, best: "max" as const },
  { key: "totalPages", label: "الأوجه المسرودة", icon: Eye, best: "max" as const },
  { key: "totalHizb", label: "الأحزاب المسرودة", icon: BookOpen, best: "max" as const },
  { key: "avgMistakes", label: "متوسط الأخطاء", icon: AlertCircle, best: "min" as const },
  { key: "avgRecitationScore", label: "درجة التسميع", icon: Music, best: "max" as const },
];

interface ComparisonData {
  studentId: string;
  studentName: string;
  avgScore: number;
  attendanceRate: number;
  totalPages: number;
  totalHizb: number;
  avgMistakes: number;
  avgRecitationScore: number;
}

interface MonthlyScore {
  month: string;
  [studentName: string]: number | string;
}

const ExcellenceComparison = () => {
  const [trackId, setTrackId] = useState<string>("");
  const [period, setPeriod] = useState<string>("3");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyScore[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [weightsOpen, setWeightsOpen] = useState(false);

  const { data: tracks } = useQuery({
    queryKey: ["excellence-tracks"],
    queryFn: async () => {
      const { data } = await supabase.from("excellence_tracks").select("id, track_name").eq("is_active", true);
      return data || [];
    },
  });

  const { data: eliteStudents } = useQuery({
    queryKey: ["elite-students-for-comparison", trackId],
    queryFn: async () => {
      if (!trackId) return [];
      const { data } = await supabase
        .from("excellence_elite_students")
        .select("student_id, students:student_id(id, full_name, halaqa_id)")
        .eq("halaqa_id", trackId);
      if (!data || data.length === 0) {
        const { data: allElite } = await supabase
          .from("excellence_elite_students")
          .select("student_id, students:student_id(id, full_name, halaqa_id)");
        return allElite || [];
      }
      return data || [];
    },
    enabled: !!trackId,
  });

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) => {
      if (prev.includes(studentId)) return prev.filter((id) => id !== studentId);
      if (prev.length >= 6) {
        toast({ title: "الحد الأقصى 6 طلاب", variant: "destructive" });
        return prev;
      }
      return [...prev, studentId];
    });
  };

  // Compute weighted total score for a student
  const computeWeightedScore = useCallback((d: ComparisonData, allData: ComparisonData[]) => {
    const maxPages = Math.max(...allData.map((s) => s.totalPages), 1);
    const maxHizb = Math.max(...allData.map((s) => s.totalHizb), 1);
    const maxMistakes = Math.max(...allData.map((s) => s.avgMistakes), 1);

    const normalized = {
      avgScore: d.avgScore,
      attendanceRate: d.attendanceRate,
      totalPages: (d.totalPages / maxPages) * 100,
      totalHizb: (d.totalHizb / maxHizb) * 100,
      avgMistakes: maxMistakes > 0 ? ((maxMistakes - d.avgMistakes) / maxMistakes) * 100 : 100,
      avgRecitationScore: d.avgRecitationScore,
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    let score = 0;
    for (const key of Object.keys(weights) as (keyof typeof weights)[]) {
      score += (normalized[key] * weights[key]) / totalWeight;
    }
    return Math.round(score * 10) / 10;
  }, [weights]);

  // Sorted data by weighted score
  const sortedData = useMemo(() => {
    if (comparisonData.length === 0) return [];
    return [...comparisonData].sort((a, b) => computeWeightedScore(b, comparisonData) - computeWeightedScore(a, comparisonData));
  }, [comparisonData, computeWeightedScore]);

  const winner = sortedData[0] || null;

  // Find winner's best strength
  const winnerStrength = useMemo(() => {
    if (!winner || comparisonData.length < 2) return "";
    let bestKey = "";
    let bestDiff = -Infinity;
    for (const c of CRITERIA) {
      const vals = comparisonData.map((d) => (d as any)[c.key] as number);
      const winnerVal = (winner as any)[c.key] as number;
      const otherMax = Math.max(...vals.filter((_, i) => comparisonData[i].studentId !== winner.studentId));
      const diff = c.best === "max" ? winnerVal - otherMax : otherMax - winnerVal;
      if (diff > bestDiff) { bestDiff = diff; bestKey = c.label; }
    }
    return bestKey;
  }, [winner, comparisonData]);

  const handleCompare = async () => {
    if (selectedStudents.length < 2) {
      toast({ title: "يرجى اختيار طالبين على الأقل", variant: "destructive" });
      return;
    }
    setIsComparing(true);
    const monthsCount = parseInt(period);
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - monthsCount);
    const startDate = monthsAgo.toISOString().split("T")[0];

    try {
      const results: ComparisonData[] = [];
      const { data: sessions } = await supabase.from("excellence_sessions").select("id, session_date").gte("session_date", startDate);
      const sessionIds = new Set(sessions?.map((s) => s.id) || []);
      const sessionDateMap = new Map(sessions?.map((s) => [s.id, s.session_date]) || []);

      const monthLabels: string[] = [];
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const monthlyMap: Record<string, Record<string, { sum: number; count: number }>> = {};
      monthLabels.forEach((m) => (monthlyMap[m] = {}));

      for (const studentId of selectedStudents) {
        const student = eliteStudents?.find((e: any) => (e.students as any)?.id === studentId);
        const studentName = (student?.students as any)?.full_name || "غير معروف";

        const { data: perfData } = await supabase.from("excellence_performance").select("total_score, pages_displayed, hizb_count, mistakes_count, session_id").eq("student_id", studentId);
        const filteredPerf = perfData?.filter((p) => sessionIds.has(p.session_id)) || [];

        const avgScore = filteredPerf.length > 0 ? filteredPerf.reduce((sum, p) => sum + (Number(p.total_score) || 0), 0) / filteredPerf.length : 0;
        const totalPages = filteredPerf.reduce((sum, p) => sum + (Number(p.pages_displayed) || 0), 0);
        const totalHizb = filteredPerf.reduce((sum, p) => sum + (Number(p.hizb_count) || 0), 0);
        const avgMistakes = filteredPerf.length > 0 ? filteredPerf.reduce((sum, p) => sum + (Number(p.mistakes_count) || 0), 0) / filteredPerf.length : 0;

        filteredPerf.forEach((p) => {
          const sDate = sessionDateMap.get(p.session_id);
          if (!sDate) return;
          const monthKey = sDate.substring(0, 7);
          if (monthlyMap[monthKey]) {
            if (!monthlyMap[monthKey][studentName]) monthlyMap[monthKey][studentName] = { sum: 0, count: 0 };
            monthlyMap[monthKey][studentName].sum += Number(p.total_score) || 0;
            monthlyMap[monthKey][studentName].count += 1;
          }
        });

        const { data: attendanceData } = await supabase.from("excellence_attendance").select("is_present, session_id").eq("student_id", studentId);
        const filteredAtt = attendanceData?.filter((a) => sessionIds.has(a.session_id)) || [];
        const attendanceRate = filteredAtt.length > 0 ? (filteredAtt.filter((a) => a.is_present).length / filteredAtt.length) * 100 : 0;

        const { data: recitationData } = await supabase.from("recitation_records" as any).select("total_score").eq("student_id", studentId).gte("record_date", startDate);
        const recArr = (recitationData as any[]) || [];
        const avgRecitationScore = recArr.length > 0 ? recArr.reduce((sum: number, r: any) => sum + (Number(r.total_score) || 0), 0) / recArr.length : 0;

        results.push({
          studentId, studentName,
          avgScore: Math.round(avgScore * 10) / 10,
          attendanceRate: Math.round(attendanceRate * 10) / 10,
          totalPages: Math.round(totalPages * 10) / 10,
          totalHizb: Math.round(totalHizb * 10) / 10,
          avgMistakes: Math.round(avgMistakes * 10) / 10,
          avgRecitationScore: Math.round(avgRecitationScore * 10) / 10,
        });
      }

      const studentNames = results.map((r) => r.studentName);
      const lineData: MonthlyScore[] = monthLabels.map((m) => {
        const point: MonthlyScore = { month: m };
        studentNames.forEach((name) => {
          const entry = monthlyMap[m]?.[name];
          point[name] = entry && entry.count > 0 ? Math.round((entry.sum / entry.count) * 10) / 10 : 0;
        });
        return point;
      });

      setComparisonData(results);
      setMonthlyData(lineData);
    } catch (error) {
      console.error(error);
      toast({ title: "حدث خطأ أثناء المقارنة", variant: "destructive" });
    } finally {
      setIsComparing(false);
    }
  };

  // Radar data
  const radarData = useMemo(() => {
    if (comparisonData.length === 0) return [];
    const maxPages = Math.max(...comparisonData.map((d) => d.totalPages), 1);
    const maxHizb = Math.max(...comparisonData.map((d) => d.totalHizb), 1);
    const maxMistakes = Math.max(...comparisonData.map((d) => d.avgMistakes), 1);
    return CRITERIA.map((c) => {
      const point: any = { axis: c.label };
      comparisonData.forEach((d) => {
        let val = 0;
        switch (c.key) {
          case "avgScore": val = d.avgScore; break;
          case "attendanceRate": val = d.attendanceRate; break;
          case "totalPages": val = (d.totalPages / maxPages) * 100; break;
          case "totalHizb": val = (d.totalHizb / maxHizb) * 100; break;
          case "avgMistakes": val = maxMistakes > 0 ? ((maxMistakes - d.avgMistakes) / maxMistakes) * 100 : 100; break;
          case "avgRecitationScore": val = d.avgRecitationScore; break;
        }
        point[d.studentName] = Math.round(val * 10) / 10;
      });
      return point;
    });
  }, [comparisonData]);

  // Grouped bar data
  const groupedBarData = useMemo(() => {
    if (comparisonData.length === 0) return [];
    const maxPages = Math.max(...comparisonData.map((d) => d.totalPages), 1);
    const maxHizb = Math.max(...comparisonData.map((d) => d.totalHizb), 1);
    const maxMistakes = Math.max(...comparisonData.map((d) => d.avgMistakes), 1);
    const getters: Record<string, (d: ComparisonData) => number> = {
      avgScore: (d) => d.avgScore,
      attendanceRate: (d) => d.attendanceRate,
      totalPages: (d) => (d.totalPages / maxPages) * 100,
      totalHizb: (d) => (d.totalHizb / maxHizb) * 100,
      avgMistakes: (d) => maxMistakes > 0 ? ((maxMistakes - d.avgMistakes) / maxMistakes) * 100 : 100,
      avgRecitationScore: (d) => d.avgRecitationScore,
    };
    const rawGetters: Record<string, (d: ComparisonData) => string> = {
      avgScore: (d) => `${d.avgScore} درجة`,
      attendanceRate: (d) => `${d.attendanceRate}%`,
      totalPages: (d) => `${d.totalPages} وجه`,
      totalHizb: (d) => `${d.totalHizb} حزب`,
      avgMistakes: (d) => `${d.avgMistakes} خطأ`,
      avgRecitationScore: (d) => `${d.avgRecitationScore} درجة`,
    };
    return CRITERIA.map((c) => {
      const point: any = { criteria: c.label, _key: c.key };
      comparisonData.forEach((d) => {
        point[d.studentName] = Math.round(getters[c.key](d) * 10) / 10;
        point[`_raw_${d.studentName}`] = rawGetters[c.key](d);
      });
      return point;
    });
  }, [comparisonData]);

  // Weight update handler
  const updateWeight = (key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };
  const totalWeights = Object.values(weights).reduce((a, b) => a + b, 0);

  // Get track name
  const currentTrackName = tracks?.find((t) => t.id === trackId)?.track_name || "";
  const currentPeriodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label || "";

  // Print handler
  const handlePrint = () => {
    const printContent = document.getElementById("comparison-print-area");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl"><head><title>تقرير مقارنة الطلاب المتميزين</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 20px; margin: 8px 0; }
        .header p { color: #666; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        .best { background: #dcfce7; color: #166534; font-weight: bold; }
        .winner { background: #fef3c7; padding: 12px; border-radius: 8px; text-align: center; margin: 16px 0; }
        .winner h2 { margin: 4px 0; }
        .meta { display: flex; justify-content: space-between; font-size: 12px; color: #888; margin-bottom: 12px; }
      </style></head><body>
      <div class="header">
        <h1>تقرير مقارنة الطلاب المتميزين</h1>
        <p>${getCurrentFullDateHeader()}</p>
        <div class="meta"><span>المسار: ${currentTrackName}</span><span>الفترة: ${currentPeriodLabel}</span></div>
      </div>
      ${winner ? `<div class="winner"><h2>🏆 الفائز: ${winner.studentName}</h2><p>الدرجة الكلية: ${computeWeightedScore(winner, comparisonData)}</p></div>` : ""}
      ${printContent.innerHTML}
      <div style="margin-top:20px;">
        <h3>ترتيب الطلاب:</h3>
        <ol>${sortedData.map((d) => `<li>${d.studentName} — ${computeWeightedScore(d, comparisonData)}</li>`).join("")}</ol>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // PDF export
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Excellence Comparison Report", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Track: ${currentTrackName} | Period: ${currentPeriodLabel}`, pageWidth / 2, 28, { align: "center" });

    if (winner) {
      doc.setFontSize(12);
      doc.text(`Winner: ${winner.studentName} (${computeWeightedScore(winner, comparisonData)})`, pageWidth / 2, 38, { align: "center" });
    }

    // Table
    const headers = ["Criteria", ...sortedData.map((d) => d.studentName)];
    const rows = CRITERIA.map((c) => {
      const row = [c.label];
      sortedData.forEach((d) => row.push(String((d as any)[c.key])));
      return row;
    });
    rows.push(["الدرجة الكلية", ...sortedData.map((d) => String(computeWeightedScore(d, comparisonData)))]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 45,
      styles: { halign: "center", fontSize: 9 },
      headStyles: { fillColor: [139, 92, 246] },
    });

    doc.save("excellence-comparison.pdf");
    toast({ title: "تم تصدير التقرير بنجاح" });
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">مقارنة المتميزين</h1>
          <PageDateHeader />
        </div>
        {comparisonData.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 ml-1" /> طباعة</Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="h-4 w-4 ml-1" /> تصدير PDF</Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Scale className="h-5 w-5" /> فلاتر المقارنة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>المسار</Label>
              <Select value={trackId} onValueChange={(v) => { setTrackId(v); setSelectedStudents([]); setComparisonData([]); }}>
                <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                <SelectContent>
                  {tracks?.map((t) => (<SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفترة الزمنية</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCompare} disabled={isComparing || selectedStudents.length < 2} className="w-full">
                {isComparing ? "جارٍ المقارنة..." : "مقارنة"}
              </Button>
            </div>
          </div>
          {trackId && (
            <div className="space-y-2">
              <Label>اختر الطلاب للمقارنة (2 - 6)</Label>
              <div className="flex flex-wrap gap-3 p-3 border rounded-lg bg-muted/30 max-h-48 overflow-y-auto">
                {eliteStudents && eliteStudents.length > 0 ? eliteStudents.map((e: any) => {
                  const student = e.students as any;
                  if (!student) return null;
                  return (
                    <div key={student.id} className="flex items-center gap-2">
                      <Checkbox checked={selectedStudents.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} id={`student-${student.id}`} />
                      <label htmlFor={`student-${student.id}`} className="text-sm cursor-pointer">{student.full_name}</label>
                    </div>
                  );
                }) : <p className="text-sm text-muted-foreground">لا يوجد طلاب مميزون في هذا المسار</p>}
              </div>
              {selectedStudents.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedStudents.map((id, i) => {
                    const student = eliteStudents?.find((e: any) => (e.students as any)?.id === id);
                    return <Badge key={id} variant="secondary" style={{ borderColor: COLORS[i] }} className="border-2">{(student?.students as any)?.full_name}</Badge>;
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {comparisonData.length > 0 && (
        <>
          {/* بطاقة الفائز */}
          {winner && (
            <Card className="border-2 border-yellow-400 bg-gradient-to-l from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
              <CardContent className="py-6">
                <div className="flex items-center justify-center gap-4">
                  <Crown className="h-10 w-10 text-yellow-500" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">🏆 الطالب الأعلى أداءً</p>
                    <h2 className="text-2xl font-bold">{winner.studentName}</h2>
                    <div className="flex gap-4 justify-center mt-2">
                      <Badge variant="secondary" className="text-base px-3 py-1">الدرجة الكلية: {computeWeightedScore(winner, comparisonData)}</Badge>
                      {winnerStrength && <Badge variant="outline" className="text-base px-3 py-1">أبرز نقطة قوة: {winnerStrength}</Badge>}
                    </div>
                  </div>
                  <Crown className="h-10 w-10 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ضبط الأوزان */}
          <Collapsible open={weightsOpen} onOpenChange={setWeightsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span className="flex items-center gap-2"><Scale className="h-5 w-5" /> ضبط الأوزان</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={totalWeights === 100 ? "default" : "destructive"} className="text-xs">المجموع: {totalWeights}%</Badge>
                      <ChevronDown className={`h-4 w-4 transition-transform ${weightsOpen ? "rotate-180" : ""}`} />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {CRITERIA.map((c) => (
                    <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                      <Label className="text-sm">{c.label}</Label>
                      <Slider
                        value={[weights[c.key as keyof typeof weights]]}
                        onValueChange={([v]) => updateWeight(c.key, v)}
                        min={0} max={100} step={5}
                        className="w-48"
                      />
                      <span className="text-sm font-mono w-10 text-left">{weights[c.key as keyof typeof weights]}%</span>
                    </div>
                  ))}
                  {totalWeights !== 100 && <p className="text-sm text-destructive">⚠️ مجموع الأوزان يجب أن يساوي 100% (الحالي: {totalWeights}%)</p>}
                  <Button variant="ghost" size="sm" onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}>
                    <RotateCcw className="h-4 w-4 ml-1" /> إعادة ضبط
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-5 w-5" /> مخطط العنكبوت — المقارنة الشاملة</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <RadarChart data={radarData} outerRadius="80%">
                  <PolarGrid gridType="polygon" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 11 }} />
                  {comparisonData.map((d, i) => (
                    <Radar key={d.studentId} name={d.studentName} dataKey={d.studentName} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.12} strokeWidth={2} dot={{ r: 4, fill: COLORS[i] }} />
                  ))}
                  <Legend wrapperStyle={{ paddingTop: 16 }} />
                  <Tooltip contentStyle={{ textAlign: "right", direction: "rtl" }} formatter={(value: number, name: string) => [`${value}%`, name]} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Grouped Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Scale className="h-5 w-5" /> المقارنة المباشرة — المعايير الستة</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={groupedBarData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="criteria" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ textAlign: "right", direction: "rtl", borderRadius: 8 }} labelFormatter={(l) => `المعيار: ${l}`} />
                  <Legend />
                  {comparisonData.map((d, i) => (
                    <Bar key={d.studentId} dataKey={d.studentName} fill={COLORS[i]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5" /> التطور الزمني — درجة التميز الشهرية</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickFormatter={(m) => {
                    const [y, mo] = m.split("-");
                    const mn = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
                    return `${mn[parseInt(mo) - 1]} ${y}`;
                  }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ textAlign: "right", direction: "rtl", borderRadius: 8 }} labelFormatter={(m) => {
                    const [y, mo] = (m as string).split("-");
                    const mn = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
                    return `${mn[parseInt(mo) - 1]} ${y}`;
                  }} />
                  <Legend />
                  {comparisonData.map((d, i) => (
                    <Line key={d.studentId} type="monotone" dataKey={d.studentName} stroke={COLORS[i]} strokeWidth={2.5} dot={{ r: 5, fill: COLORS[i], strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* جدول المقارنة التفصيلي */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">جدول المقارنة التفصيلي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto" id="comparison-print-area">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المحور</TableHead>
                      <TableHead className="text-center text-xs text-muted-foreground">الوزن</TableHead>
                      {sortedData.map((d, i) => (
                        <TableHead key={d.studentId} className="text-center" style={{ color: COLORS[comparisonData.indexOf(d)] }}>
                          {d.studentName}
                          {i === 0 && " 🏆"}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CRITERIA.map((row) => {
                      const values = sortedData.map((d) => (d as any)[row.key] as number);
                      const bestVal = row.best === "max" ? Math.max(...values) : Math.min(...values);
                      return (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium text-right">
                            <row.icon className="h-4 w-4 inline ml-1" /> {row.label}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{weights[row.key as keyof typeof weights]}%</TableCell>
                          {sortedData.map((d) => {
                            const val = (d as any)[row.key] as number;
                            const isBest = val === bestVal && sortedData.length > 1;
                            return (
                              <TableCell key={d.studentId} className={`text-center font-semibold ${isBest ? "text-green-600 bg-green-50 dark:bg-green-950/30" : ""}`}>
                                {val}{isBest && " ⭐"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell className="text-right font-bold">الدرجة الكلية</TableCell>
                      <TableCell className="text-center text-xs">{totalWeights}%</TableCell>
                      {sortedData.map((d, i) => (
                        <TableCell key={d.studentId} className={`text-center text-lg ${i === 0 ? "text-yellow-600 font-extrabold" : ""}`}>
                          {computeWeightedScore(d, comparisonData)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ExcellenceComparison;
