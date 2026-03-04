import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, BarChart3, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

const DATE_FILTERS = [
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "semester", label: "هذا الفصل" },
  { value: "year", label: "هذه السنة" },
  { value: "all", label: "الكل" },
];

const DIFFICULTY_FILTERS = [
  { value: "all", label: "الكل" },
  { value: "easy", label: "سهل" },
  { value: "medium", label: "متوسط" },
  { value: "hard", label: "صعب" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

const getDateRange = (filter: string) => {
  const now = new Date();
  const d = new Date(now);
  if (filter === "week") { d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; }
  if (filter === "month") { d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; }
  if (filter === "semester") { d.setMonth(d.getMonth() - 4); return d.toISOString().split("T")[0]; }
  if (filter === "year") { d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; }
  return null;
};

const getGradeClass = (avg: number) => {
  if (avg >= 90) return "ممتاز";
  if (avg >= 75) return "جيد جداً";
  if (avg >= 60) return "جيد";
  return "يحتاج مراجعة";
};

const QuizComparison = () => {
  const [dateFilter, setDateFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  // Fetch all halaqat with teachers
  const { data: halaqat = [] } = useQuery({
    queryKey: ["qc-halaqat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("halaqat")
        .select("id, name, teacher_id, profiles:teacher_id(full_name)")
        .eq("active", true);
      return data || [];
    },
  });

  // Fetch all completed quizzes
  const { data: allQuizzes = [] } = useQuery({
    queryKey: ["qc-all-quizzes", dateFilter, difficultyFilter],
    queryFn: async () => {
      let q = supabase
        .from("student_quizzes")
        .select("id, student_id, halaqa_id, score, grade_label, quiz_date, difficulty")
        .eq("status", "completed");
      const dateFrom = getDateRange(dateFilter);
      if (dateFrom) q = q.gte("quiz_date", dateFrom);
      if (difficultyFilter !== "all") q = q.eq("difficulty", difficultyFilter);
      const { data } = await q;
      return data || [];
    },
  });

  // Compute comparison table
  const comparisonData = useMemo(() => {
    const map: Record<string, {
      halaqaId: string; name: string; teacher: string;
      scores: number[]; students: Set<string>;
    }> = {};

    halaqat.forEach((h: any) => {
      map[h.id] = {
        halaqaId: h.id,
        name: h.name,
        teacher: h.profiles?.full_name || "—",
        scores: [],
        students: new Set(),
      };
    });

    allQuizzes.forEach((q: any) => {
      if (q.halaqa_id && map[q.halaqa_id]) {
        map[q.halaqa_id].scores.push(Number(q.score));
        map[q.halaqa_id].students.add(q.student_id);
      }
    });

    return Object.values(map)
      .filter((h) => h.scores.length > 0)
      .map((h) => ({
        ...h,
        studentsCount: h.students.size,
        avg: Math.round(h.scores.reduce((a, b) => a + b, 0) / h.scores.length),
        passRate: Math.round((h.scores.filter((s) => s >= 60).length / h.scores.length) * 100),
        maxScore: Math.max(...h.scores),
        grade: getGradeClass(h.scores.reduce((a, b) => a + b, 0) / h.scores.length),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [halaqat, allQuizzes]);

  // Bar chart data
  const barData = useMemo(() => {
    return comparisonData.map((h) => ({
      name: h.name.length > 12 ? h.name.slice(0, 12) + "…" : h.name,
      متوسط: h.avg,
    }));
  }, [comparisonData]);

  // Monthly line chart data
  const monthlyData = useMemo(() => {
    const months: Record<string, Record<string, { total: number; count: number }>> = {};
    allQuizzes.forEach((q: any) => {
      if (!q.halaqa_id || !q.quiz_date) return;
      const month = q.quiz_date.slice(0, 7);
      if (!months[month]) months[month] = {};
      if (!months[month][q.halaqa_id]) months[month][q.halaqa_id] = { total: 0, count: 0 };
      months[month][q.halaqa_id].total += Number(q.score);
      months[month][q.halaqa_id].count += 1;
    });

    const sortedMonths = Object.keys(months).sort();
    return sortedMonths.map((m) => {
      const row: any = { month: m };
      comparisonData.forEach((h) => {
        const d = months[m][h.halaqaId];
        row[h.name] = d ? Math.round(d.total / d.count) : null;
      });
      return row;
    });
  }, [allQuizzes, comparisonData]);

  // Heatmap data (difficulty x halaqa)
  const heatmapData = useMemo(() => {
    const map: Record<string, Record<string, { total: number; count: number }>> = {};
    allQuizzes.forEach((q: any) => {
      if (!q.halaqa_id) return;
      if (!map[q.halaqa_id]) map[q.halaqa_id] = {};
      if (!map[q.halaqa_id][q.difficulty]) map[q.halaqa_id][q.difficulty] = { total: 0, count: 0 };
      map[q.halaqa_id][q.difficulty].total += Number(q.score);
      map[q.halaqa_id][q.difficulty].count += 1;
    });
    return comparisonData.map((h) => {
      const d = map[h.halaqaId] || {};
      return {
        name: h.name,
        easy: d.easy ? Math.round(d.easy.total / d.easy.count) : null,
        medium: d.medium ? Math.round(d.medium.total / d.medium.count) : null,
        hard: d.hard ? Math.round(d.hard.total / d.hard.count) : null,
      };
    });
  }, [allQuizzes, comparisonData]);

  const getHeatColor = (val: number | null) => {
    if (val === null) return "bg-muted text-muted-foreground";
    if (val >= 90) return "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300";
    if (val >= 75) return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
    if (val >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300";
    return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
  };

  // Line chart colors
  const LINE_COLORS = ["#16a34a", "#2563eb", "#eab308", "#dc2626", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("Quiz Comparison Report", 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["#", "Halaqa", "Teacher", "Students", "Avg", "Pass %", "Max", "Grade"]],
      body: comparisonData.map((h, i) => [
        i + 1, h.name, h.teacher, h.studentsCount, `${h.avg}%`, `${h.passRate}%`, h.maxScore, h.grade,
      ]),
    });

    doc.save("quiz-comparison.pdf");
  };

  // Export Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      comparisonData.map((h, i) => ({
        "#": i + 1,
        "الحلقة": h.name,
        "المعلم": h.teacher,
        "عدد الطلاب": h.studentsCount,
        "المتوسط": h.avg,
        "نسبة النجاح": `${h.passRate}%`,
        "أعلى درجة": h.maxScore,
        "التصنيف": h.grade,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المقارنة");
    XLSX.writeFile(wb, "quiz-comparison.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            مقارنة الحلقات
          </h1>
          <p className="text-muted-foreground text-sm">مقارنة شاملة لأداء الحلقات في الاختبار الذكي</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={comparisonData.length === 0}>
            <FileDown className="w-4 h-4 ml-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={comparisonData.length === 0}>
            <FileDown className="w-4 h-4 ml-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTY_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {comparisonData.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>لا توجد بيانات اختبارات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">جدول المقارنة</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">الحلقة</TableHead>
                    <TableHead className="text-right">المعلم</TableHead>
                    <TableHead className="text-right">المختبَرين</TableHead>
                    <TableHead className="text-right">المتوسط</TableHead>
                    <TableHead className="text-right">% الناجحين</TableHead>
                    <TableHead className="text-right">أعلى درجة</TableHead>
                    <TableHead className="text-right">التصنيف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((h, i) => (
                    <TableRow key={h.halaqaId}>
                      <TableCell className="font-medium">
                        {i < 3 ? MEDALS[i] : i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>{h.teacher}</TableCell>
                      <TableCell>{h.studentsCount}</TableCell>
                      <TableCell className="font-bold">{h.avg}%</TableCell>
                      <TableCell>{h.passRate}%</TableCell>
                      <TableCell>{h.maxScore}%</TableCell>
                      <TableCell>
                        <Badge variant="outline">{h.grade}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">متوسط الدرجات</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="متوسط" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Line Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">تطور الأداء الشهري</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {comparisonData.slice(0, 8).map((h, i) => (
                        <Line
                          key={h.halaqaId}
                          type="monotone"
                          dataKey={h.name}
                          stroke={LINE_COLORS[i % LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">بيانات شهر واحد فقط</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">خريطة الأداء حسب الصعوبة</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الحلقة</TableHead>
                    <TableHead className="text-center">سهل</TableHead>
                    <TableHead className="text-center">متوسط</TableHead>
                    <TableHead className="text-center">صعب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heatmapData.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      {(["easy", "medium", "hard"] as const).map((d) => (
                        <TableCell key={d} className="text-center p-1">
                          <span className={`inline-block px-3 py-1.5 rounded-md text-sm font-medium ${getHeatColor(row[d])}`}>
                            {row[d] !== null ? `${row[d]}%` : "—"}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default QuizComparison;
