import { useState, useMemo } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, User, Users, TrendingUp, CalendarDays } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { formatDualDate } from "@/lib/hijri";

const GRADE_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: "ممتاز", color: "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300" },
  very_good: { label: "جيد جداً", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300" },
  good: { label: "جيد", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300" },
  needs_review: { label: "يحتاج مراجعة", color: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300" },
};

const DONUT_COLORS = ["#16a34a", "#2563eb", "#eab308", "#dc2626"];

const DATE_FILTERS = [
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "semester", label: "هذا الفصل" },
  { value: "all", label: "الكل" },
];

const DIFFICULTY_FILTERS = [
  { value: "all", label: "الكل" },
  { value: "easy", label: "سهل" },
  { value: "medium", label: "متوسط" },
  { value: "hard", label: "صعب" },
];

const getDateRange = (filter: string) => {
  const now = new Date();
  if (filter === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  }
  if (filter === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  }
  if (filter === "semester") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 4);
    return d.toISOString().split("T")[0];
  }
  return null;
};

const QuizResults = () => {
  const { user } = useAuth();
  const { isTeacher } = useRole();
  const { filterHalaqat, loading: accessLoading } = useTeacherHalaqat();

  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  // Fetch halaqat
  const { data: halaqat = [] } = useQuery({
    queryKey: ["qr-halaqat", user?.id, isTeacher],
    queryFn: async () => {
      if (isTeacher && user) {
        const { data } = await supabase
          .from("halaqat").select("id, name, teacher_id")
          .eq("active", true)
          .or(`teacher_id.eq.${user.id},assistant_teacher_id.eq.${user.id}`);
        return data || [];
      }
      const { data } = await supabase.from("halaqat").select("id, name, teacher_id").eq("active", true);
      return filterHalaqat(data || []);
    },
    enabled: !accessLoading,
  });

  // Fetch students for selected halaqa
  const { data: students = [] } = useQuery({
    queryKey: ["qr-students", selectedHalaqa],
    queryFn: async () => {
      const { data } = await supabase
        .from("students").select("id, full_name")
        .eq("halaqa_id", selectedHalaqa).eq("status", "active")
        .order("full_name");
      return data || [];
    },
    enabled: !!selectedHalaqa,
  });

  // Fetch all quizzes for the halaqa (with filters)
  const { data: halaqaQuizzes = [] } = useQuery({
    queryKey: ["qr-halaqa-quizzes", selectedHalaqa, dateFilter, difficultyFilter],
    queryFn: async () => {
      let q = supabase
        .from("student_quizzes")
        .select("*, students!inner(full_name), profiles:teacher_id(full_name)")
        .eq("halaqa_id", selectedHalaqa)
        .eq("status", "completed");

      const dateFrom = getDateRange(dateFilter);
      if (dateFrom) q = q.gte("quiz_date", dateFrom);
      if (difficultyFilter !== "all") q = q.eq("difficulty", difficultyFilter);

      const { data } = await q.order("score", { ascending: false });
      return data || [];
    },
    enabled: !!selectedHalaqa,
  });

  // Fetch all quizzes globally for overall average
  const { data: globalAvg } = useQuery({
    queryKey: ["qr-global-avg"],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_quizzes")
        .select("score")
        .eq("status", "completed");
      if (!data || data.length === 0) return 0;
      return Math.round(data.reduce((s, r) => s + Number(r.score), 0) / data.length);
    },
  });

  // Fetch student's quiz history
  const { data: studentHistory = [] } = useQuery({
    queryKey: ["qr-student-history", selectedStudent],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_quizzes")
        .select("id, quiz_date, score, grade_label, difficulty, memorized_content, profiles:teacher_id(full_name)")
        .eq("student_id", selectedStudent)
        .eq("status", "completed")
        .order("quiz_date", { ascending: true });
      return data || [];
    },
    enabled: !!selectedStudent,
  });

  // Computed: student rank in halaqa
  const studentRank = useMemo(() => {
    if (!selectedStudent || halaqaQuizzes.length === 0) return null;
    // Compute avg per student
    const avgMap: Record<string, { total: number; count: number; name: string }> = {};
    halaqaQuizzes.forEach((q: any) => {
      if (!avgMap[q.student_id]) avgMap[q.student_id] = { total: 0, count: 0, name: q.students?.full_name || "" };
      avgMap[q.student_id].total += Number(q.score);
      avgMap[q.student_id].count += 1;
    });
    const sorted = Object.entries(avgMap)
      .map(([id, d]) => ({ id, avg: d.total / d.count }))
      .sort((a, b) => b.avg - a.avg);
    const rank = sorted.findIndex((s) => s.id === selectedStudent) + 1;
    return { rank, total: sorted.length };
  }, [selectedStudent, halaqaQuizzes]);

  // Computed: latest quiz for selected student
  const latestStudentQuiz = useMemo(() => {
    if (studentHistory.length === 0) return null;
    return studentHistory[studentHistory.length - 1];
  }, [studentHistory]);

  // Computed: halaqa average
  const halaqaAvg = useMemo(() => {
    if (halaqaQuizzes.length === 0) return 0;
    return Math.round(halaqaQuizzes.reduce((s: number, q: any) => s + Number(q.score), 0) / halaqaQuizzes.length);
  }, [halaqaQuizzes]);

  // Computed: grade distribution for donut chart
  const gradeDistribution = useMemo(() => {
    const dist = { excellent: 0, very_good: 0, good: 0, needs_review: 0 };
    halaqaQuizzes.forEach((q: any) => {
      if (q.grade_label && dist[q.grade_label as keyof typeof dist] !== undefined) {
        dist[q.grade_label as keyof typeof dist]++;
      }
    });
    return [
      { name: "ممتاز", value: dist.excellent },
      { name: "جيد جداً", value: dist.very_good },
      { name: "جيد", value: dist.good },
      { name: "يحتاج مراجعة", value: dist.needs_review },
    ].filter((d) => d.value > 0);
  }, [halaqaQuizzes]);

  // Gauge chart data (half pie)
  const gaugeData = useMemo(() => {
    const score = latestStudentQuiz ? Number(latestStudentQuiz.score) : 0;
    return [
      { name: "score", value: score },
      { name: "remaining", value: 100 - score },
    ];
  }, [latestStudentQuiz]);

  // Line chart data for student progress
  const lineData = useMemo(() => {
    return studentHistory.map((q: any) => ({
      date: q.quiz_date,
      score: Number(q.score),
    }));
  }, [studentHistory]);

  // Sorted halaqa table
  const halaqaTable = useMemo(() => {
    const avgMap: Record<string, { name: string; totalScore: number; count: number; lastDate: string; lastGrade: string }> = {};
    halaqaQuizzes.forEach((q: any) => {
      const sid = q.student_id;
      if (!avgMap[sid]) avgMap[sid] = { name: q.students?.full_name || "", totalScore: 0, count: 0, lastDate: q.quiz_date, lastGrade: q.grade_label };
      avgMap[sid].totalScore += Number(q.score);
      avgMap[sid].count += 1;
      if (q.quiz_date > avgMap[sid].lastDate) {
        avgMap[sid].lastDate = q.quiz_date;
        avgMap[sid].lastGrade = q.grade_label;
      }
    });
    return Object.entries(avgMap)
      .map(([id, d]) => ({ id, name: d.name, avg: Math.round(d.totalScore / d.count), count: d.count, lastDate: d.lastDate, lastGrade: d.lastGrade }))
      .sort((a, b) => b.avg - a.avg);
  }, [halaqaQuizzes]);

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          نتائج الاختبار الذكي
        </h1>
        <p className="text-muted-foreground text-sm">عرض وتحليل نتائج اختبارات الطلاب</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={selectedHalaqa} onValueChange={(v) => { setSelectedHalaqa(v); setSelectedStudent(""); }}>
              <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
              <SelectContent>
                {halaqat.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            {selectedHalaqa && (
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="اختر طالب (اختياري)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">جميع الطلاب</SelectItem>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedHalaqa && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>اختر حلقة لعرض النتائج</p>
          </CardContent>
        </Card>
      )}

      {selectedHalaqa && (
        <Tabs defaultValue={selectedStudent && selectedStudent !== "__none" ? "student" : "halaqa"} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="halaqa" className="flex items-center gap-1">
              <Users className="w-4 h-4" /> نتائج الحلقة
            </TabsTrigger>
            <TabsTrigger value="student" className="flex items-center gap-1" disabled={!selectedStudent || selectedStudent === "__none"}>
              <User className="w-4 h-4" /> نتائج الطالب
            </TabsTrigger>
          </TabsList>

          {/* === Halaqa Results Tab === */}
          <TabsContent value="halaqa" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">متوسط الحلقة</p>
                  <p className="text-3xl font-bold text-primary">{halaqaAvg}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">المتوسط العام</p>
                  <p className="text-3xl font-bold text-muted-foreground">{globalAvg || 0}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">مقارنة</p>
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className={`w-5 h-5 ${halaqaAvg >= (globalAvg || 0) ? "text-green-600" : "text-red-500"}`} />
                    <span className={`text-lg font-bold ${halaqaAvg >= (globalAvg || 0) ? "text-green-600" : "text-red-500"}`}>
                      {halaqaAvg - (globalAvg || 0) > 0 ? "+" : ""}{halaqaAvg - (globalAvg || 0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Donut Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">توزيع التصنيفات</CardTitle>
                </CardHeader>
                <CardContent>
                  {gradeDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={gradeDistribution}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={90}
                          dataKey="value" nameKey="name"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {gradeDistribution.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                  )}
                </CardContent>
              </Card>

              {/* Students Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ترتيب الطلاب</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">الطالب</TableHead>
                          <TableHead className="text-right">المتوسط</TableHead>
                          <TableHead className="text-right">التصنيف</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {halaqaTable.map((row, i) => {
                          const gl = GRADE_LABELS[row.lastGrade];
                          return (
                            <TableRow
                              key={row.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedStudent(row.id)}
                            >
                              <TableCell className="font-medium">{i + 1}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="font-bold">{row.avg}%</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={gl?.color || ""}>
                                  {gl?.label || row.lastGrade}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {halaqaTable.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                              لا توجد نتائج
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === Student Results Tab === */}
          <TabsContent value="student" className="space-y-4">
            {selectedStudent && selectedStudent !== "__none" && (
              <>
                {/* Student Card */}
                <Card className="border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Info */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">
                            {(() => { const s = students.find((s: any) => s.id === selectedStudent); return s ? <StudentNameLink studentId={s.id} studentName={s.full_name} /> : "—"; })()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {halaqat.find((h: any) => h.id === selectedHalaqa)?.name}
                          </p>
                          {latestStudentQuiz && (
                            <p className="text-xs text-muted-foreground">
                              المصحح: {(latestStudentQuiz as any).profiles?.full_name || "—"} | التاريخ: {(latestStudentQuiz as any).quiz_date}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rank */}
                      {studentRank && (
                        <div className="text-center bg-muted/50 rounded-lg px-4 py-2">
                          <p className="text-xs text-muted-foreground">الترتيب</p>
                          <p className="text-2xl font-bold text-primary">{studentRank.rank}</p>
                          <p className="text-xs text-muted-foreground">من {studentRank.total}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Gauge Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">آخر درجة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestStudentQuiz ? (
                        <div className="relative">
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={gaugeData}
                                cx="50%" cy="90%"
                                startAngle={180} endAngle={0}
                                innerRadius={70} outerRadius={100}
                                dataKey="value"
                              >
                                <Cell fill="hsl(var(--primary))" />
                                <Cell fill="hsl(var(--muted))" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                            <p className="text-3xl font-bold">{Number(latestStudentQuiz.score)}%</p>
                            <Badge className={GRADE_LABELS[latestStudentQuiz.grade_label || ""]?.color || ""}>
                              {GRADE_LABELS[latestStudentQuiz.grade_label || ""]?.label || ""}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">لا توجد اختبارات</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Line Chart - Progress */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">تطور الدرجات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {lineData.length > 1 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={lineData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Line
                              type="monotone" dataKey="score" name="الدرجة"
                              stroke="hsl(var(--primary))" strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          {lineData.length === 1 ? "اختبار واحد فقط — يحتاج المزيد للمقارنة" : "لا توجد بيانات"}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Student History Table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">سجل الاختبارات</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الدرجة</TableHead>
                          <TableHead className="text-right">التصنيف</TableHead>
                          <TableHead className="text-right">الصعوبة</TableHead>
                          <TableHead className="text-right">المصحح</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentHistory.map((q: any) => {
                          const gl = GRADE_LABELS[q.grade_label];
                          return (
                            <TableRow key={q.id}>
                              <TableCell>{q.quiz_date}</TableCell>
                              <TableCell className="font-bold">{Number(q.score)}%</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={gl?.color || ""}>{gl?.label || q.grade_label}</Badge>
                              </TableCell>
                              <TableCell>
                                {q.difficulty === "easy" ? "سهل" : q.difficulty === "hard" ? "صعب" : "متوسط"}
                              </TableCell>
                              <TableCell>{q.profiles?.full_name || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {studentHistory.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                              لا توجد اختبارات سابقة
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default QuizResults;
