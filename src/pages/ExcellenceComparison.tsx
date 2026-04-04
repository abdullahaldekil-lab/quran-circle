import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { PageDateHeader } from "@/components/PageDateHeader";
import { Scale, Users, Trophy, BookOpen, Eye, AlertCircle, Music, TrendingUp } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: "1", label: "آخر شهر" },
  { value: "3", label: "آخر 3 أشهر" },
  { value: "6", label: "آخر 6 أشهر" },
  { value: "12", label: "السنة كاملة" },
];

const COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];

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
  month: string; // "2026-01"
  [studentName: string]: number | string;
}

const ExcellenceComparison = () => {
  const [trackId, setTrackId] = useState<string>("");
  const [period, setPeriod] = useState<string>("3");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyScore[]>([]);
  const [isComparing, setIsComparing] = useState(false);

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

      // Pre-fetch sessions once
      const { data: sessions } = await supabase
        .from("excellence_sessions")
        .select("id, session_date")
        .gte("session_date", startDate);
      const sessionIds = new Set(sessions?.map((s) => s.id) || []);
      const sessionDateMap = new Map(sessions?.map((s) => [s.id, s.session_date]) || []);

      // Build month labels
      const monthLabels: string[] = [];
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      // Monthly scores map: month -> studentName -> avgScore
      const monthlyMap: Record<string, Record<string, { sum: number; count: number }>> = {};
      monthLabels.forEach((m) => (monthlyMap[m] = {}));

      for (const studentId of selectedStudents) {
        const student = eliteStudents?.find((e: any) => (e.students as any)?.id === studentId);
        const studentName = (student?.students as any)?.full_name || "غير معروف";

        // Performance data
        const { data: perfData } = await supabase
          .from("excellence_performance")
          .select("total_score, pages_displayed, hizb_count, mistakes_count, session_id")
          .eq("student_id", studentId);

        const filteredPerf = perfData?.filter((p) => sessionIds.has(p.session_id)) || [];

        const avgScore = filteredPerf.length > 0
          ? filteredPerf.reduce((sum, p) => sum + (Number(p.total_score) || 0), 0) / filteredPerf.length : 0;
        const totalPages = filteredPerf.reduce((sum, p) => sum + (Number(p.pages_displayed) || 0), 0);
        const totalHizb = filteredPerf.reduce((sum, p) => sum + (Number(p.hizb_count) || 0), 0);
        const avgMistakes = filteredPerf.length > 0
          ? filteredPerf.reduce((sum, p) => sum + (Number(p.mistakes_count) || 0), 0) / filteredPerf.length : 0;

        // Monthly breakdown for line chart
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

        // Attendance
        const { data: attendanceData } = await supabase
          .from("excellence_attendance")
          .select("is_present, session_id")
          .eq("student_id", studentId);

        const filteredAtt = attendanceData?.filter((a) => sessionIds.has(a.session_id)) || [];
        const attendanceRate = filteredAtt.length > 0
          ? (filteredAtt.filter((a) => a.is_present).length / filteredAtt.length) * 100 : 0;

        // Recitation
        const { data: recitationData } = await supabase
          .from("recitation_records" as any)
          .select("total_score")
          .eq("student_id", studentId)
          .gte("record_date", startDate);

        const recArr = (recitationData as any[]) || [];
        const avgRecitationScore = recArr.length > 0
          ? recArr.reduce((sum: number, r: any) => sum + (Number(r.total_score) || 0), 0) / recArr.length : 0;

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

      // Build monthly line chart data
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

  // Radar chart data (normalized 0-100)
  const radarData = useMemo(() => {
    if (comparisonData.length === 0) return [];
    const maxPages = Math.max(...comparisonData.map((d) => d.totalPages), 1);
    const maxHizb = Math.max(...comparisonData.map((d) => d.totalHizb), 1);
    const maxMistakes = Math.max(...comparisonData.map((d) => d.avgMistakes), 1);

    const axes = [
      { axis: "درجة التميز", key: "avgScore" },
      { axis: "الحضور %", key: "attendanceRate" },
      { axis: "الأوجه", key: "totalPages" },
      { axis: "الأحزاب", key: "totalHizb" },
      { axis: "قلة الأخطاء", key: "mistakes" },
      { axis: "درجة التسميع", key: "avgRecitationScore" },
    ];

    return axes.map((a) => {
      const point: any = { axis: a.axis };
      comparisonData.forEach((d) => {
        let val = 0;
        switch (a.key) {
          case "avgScore": val = d.avgScore; break;
          case "attendanceRate": val = d.attendanceRate; break;
          case "totalPages": val = (d.totalPages / maxPages) * 100; break;
          case "totalHizb": val = (d.totalHizb / maxHizb) * 100; break;
          case "mistakes": val = maxMistakes > 0 ? ((maxMistakes - d.avgMistakes) / maxMistakes) * 100 : 100; break;
          case "avgRecitationScore": val = d.avgRecitationScore; break;
        }
        point[d.studentName] = Math.round(val * 10) / 10;
      });
      return point;
    });
  }, [comparisonData]);

  // Grouped bar chart data: each criteria is a group, each student is a bar
  const groupedBarData = useMemo(() => {
    if (comparisonData.length === 0) return [];
    const maxPages = Math.max(...comparisonData.map((d) => d.totalPages), 1);
    const maxHizb = Math.max(...comparisonData.map((d) => d.totalHizb), 1);
    const maxMistakes = Math.max(...comparisonData.map((d) => d.avgMistakes), 1);

    const criteria = [
      { label: "درجة التميز", getValue: (d: ComparisonData) => d.avgScore },
      { label: "الحضور %", getValue: (d: ComparisonData) => d.attendanceRate },
      { label: "الأوجه", getValue: (d: ComparisonData) => (d.totalPages / maxPages) * 100 },
      { label: "الأحزاب", getValue: (d: ComparisonData) => (d.totalHizb / maxHizb) * 100 },
      { label: "قلة الأخطاء", getValue: (d: ComparisonData) => maxMistakes > 0 ? ((maxMistakes - d.avgMistakes) / maxMistakes) * 100 : 100 },
      { label: "درجة التسميع", getValue: (d: ComparisonData) => d.avgRecitationScore },
    ];

    return criteria.map((c) => {
      const point: any = { criteria: c.label };
      comparisonData.forEach((d) => {
        point[d.studentName] = Math.round(c.getValue(d) * 10) / 10;
      });
      return point;
    });
  }, [comparisonData]);

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">مقارنة المتميزين</h1>
      <PageDateHeader />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5" />
            فلاتر المقارنة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>المسار</Label>
              <Select value={trackId} onValueChange={(v) => { setTrackId(v); setSelectedStudents([]); setComparisonData([]); }}>
                <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                <SelectContent>
                  {tracks?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفترة الزمنية</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
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
                {eliteStudents && eliteStudents.length > 0 ? (
                  eliteStudents.map((e: any) => {
                    const student = e.students as any;
                    if (!student) return null;
                    const isSelected = selectedStudents.includes(student.id);
                    return (
                      <div key={student.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleStudent(student.id)}
                          id={`student-${student.id}`}
                        />
                        <label htmlFor={`student-${student.id}`} className="text-sm cursor-pointer">
                          {student.full_name}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">لا يوجد طلاب مميزون في هذا المسار</p>
                )}
              </div>
              {selectedStudents.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedStudents.map((id, i) => {
                    const student = eliteStudents?.find((e: any) => (e.students as any)?.id === id);
                    return (
                      <Badge key={id} variant="secondary" style={{ borderColor: COLORS[i] }} className="border-2">
                        {(student?.students as any)?.full_name}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {comparisonData.length > 0 && (
        <>
          {/* رسم 1 — Radar Chart كبير */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5" />
                مخطط العنكبوت — المقارنة الشاملة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <RadarChart data={radarData} outerRadius="80%">
                  <PolarGrid gridType="polygon" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 11 }} />
                  {comparisonData.map((d, i) => (
                    <Radar
                      key={d.studentId}
                      name={d.studentName}
                      dataKey={d.studentName}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                      dot={{ r: 4, fill: COLORS[i] }}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ paddingTop: 16 }}
                    formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                  />
                  <Tooltip
                    contentStyle={{ textAlign: "right", direction: "rtl" }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* رسم 2 — Grouped Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scale className="h-5 w-5" />
                المقارنة المباشرة — المعايير الستة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={groupedBarData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="criteria" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ textAlign: "right", direction: "rtl", borderRadius: 8 }}
                    formatter={(value: number, name: string) => [`${value}`, name]}
                    labelFormatter={(label) => `المعيار: ${label}`}
                  />
                  <Legend formatter={(value) => <span className="text-sm">{value}</span>} />
                  {comparisonData.map((d, i) => (
                    <Bar
                      key={d.studentId}
                      dataKey={d.studentName}
                      fill={COLORS[i]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* رسم 3 — Line Chart التطور الزمني */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                التطور الزمني — درجة التميز الشهرية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(m) => {
                      const [y, mo] = m.split("-");
                      const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
                      return `${monthNames[parseInt(mo) - 1]} ${y}`;
                    }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ textAlign: "right", direction: "rtl", borderRadius: 8 }}
                    labelFormatter={(m) => {
                      const [y, mo] = (m as string).split("-");
                      const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
                      return `${monthNames[parseInt(mo) - 1]} ${y}`;
                    }}
                    formatter={(value: number, name: string) => [`${value}`, name]}
                  />
                  <Legend formatter={(value) => <span className="text-sm">{value}</span>} />
                  {comparisonData.map((d, i) => (
                    <Line
                      key={d.studentId}
                      type="monotone"
                      dataKey={d.studentName}
                      stroke={COLORS[i]}
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: COLORS[i], strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 7 }}
                    />
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المحور</TableHead>
                      {comparisonData.map((d, i) => (
                        <TableHead key={d.studentId} className="text-center" style={{ color: COLORS[i] }}>
                          {d.studentName}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "درجة التميز", key: "avgScore", icon: <Trophy className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "الحضور %", key: "attendanceRate", icon: <Users className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "الأوجه المسرودة", key: "totalPages", icon: <Eye className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "الأحزاب المسرودة", key: "totalHizb", icon: <BookOpen className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "متوسط الأخطاء", key: "avgMistakes", icon: <AlertCircle className="h-4 w-4 inline ml-1" />, best: "min" },
                      { label: "درجة التسميع", key: "avgRecitationScore", icon: <Music className="h-4 w-4 inline ml-1" />, best: "max" },
                    ].map((row) => {
                      const values = comparisonData.map((d) => (d as any)[row.key] as number);
                      const bestVal = row.best === "max" ? Math.max(...values) : Math.min(...values);
                      return (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium text-right">
                            {row.icon} {row.label}
                          </TableCell>
                          {comparisonData.map((d) => {
                            const val = (d as any)[row.key] as number;
                            const isBest = val === bestVal && comparisonData.length > 1;
                            return (
                              <TableCell key={d.studentId} className={`text-center font-semibold ${isBest ? "text-green-600 bg-green-50" : ""}`}>
                                {val}
                                {isBest && <span className="mr-1">⭐</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
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
