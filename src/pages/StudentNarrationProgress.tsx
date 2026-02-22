import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, BookOpen, Trophy, TrendingUp, BarChart3, Hash } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

interface AttemptRow {
  id: string;
  session_id: string;
  grade: number;
  mistakes_count: number;
  lahn_count: number;
  warnings_count: number;
  total_hizb_count: number;
  status: string;
  narration_type: string;
  notes: string | null;
  created_at: string;
  session: {
    session_date: string;
    title: string | null;
  } | null;
}

const StudentNarrationProgress = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [studentRes, attRes] = await Promise.all([
        supabase.from("students").select("full_name, halaqat(name)").eq("id", id).maybeSingle(),
        supabase
          .from("narration_attempts")
          .select("id, session_id, grade, mistakes_count, lahn_count, warnings_count, total_hizb_count, status, narration_type, notes, created_at, session:narration_sessions(session_date, title)")
          .eq("student_id", id)
          .order("created_at", { ascending: true }),
      ]);
      setStudent(studentRes.data);
      setAttempts((attRes.data as any) || []);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const stats = useMemo(() => {
    if (!attempts.length) return { count: 0, totalHizb: 0, best: 0, avg: 0 };
    const grades = attempts.map((a) => Number(a.grade));
    return {
      count: attempts.length,
      totalHizb: attempts.reduce((s, a) => s + Number(a.total_hizb_count), 0),
      best: Math.max(...grades),
      avg: Math.round(grades.reduce((s, g) => s + g, 0) / grades.length),
    };
  }, [attempts]);

  const gradeChartData = useMemo(
    () =>
      attempts.map((a) => ({
        date: a.session?.session_date || a.created_at.slice(0, 10),
        grade: Number(a.grade),
      })),
    [attempts]
  );

  const hizbChartData = useMemo(
    () =>
      attempts.map((a) => ({
        date: a.session?.session_date || a.created_at.slice(0, 10),
        hizb: Number(a.total_hizb_count),
      })),
    [attempts]
  );

  const gradeChartConfig = {
    grade: { label: "الدرجة", color: "hsl(var(--primary))" },
  };

  const hizbChartConfig = {
    hizb: { label: "الأحزاب", color: "hsl(var(--chart-2, 142 76% 36%))" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto" dir="rtl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowRight className="w-4 h-4 ml-1" />
        رجوع
      </Button>

      <div>
        <h1 className="text-xl font-bold">تقدم السرد القرآني</h1>
        <p className="text-sm text-muted-foreground">
          {student?.full_name} — {(student as any)?.halaqat?.name || "بدون حلقة"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Hash className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold text-primary">{stats.count}</p>
            <p className="text-xs text-muted-foreground">عدد الجلسات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold text-primary">{stats.totalHizb}</p>
            <p className="text-xs text-muted-foreground">مجموع الأحزاب</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold text-success">{stats.best}</p>
            <p className="text-xs text-muted-foreground">أفضل درجة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.avg}</p>
            <p className="text-xs text-muted-foreground">متوسط الدرجات</p>
          </CardContent>
        </Card>
      </div>

      {/* Grade Line Chart */}
      {gradeChartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              تطور الدرجة عبر الجلسات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={gradeChartConfig} className="h-[250px] w-full">
              <LineChart data={gradeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="grade"
                  stroke="var(--color-grade)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Hizb Bar Chart */}
      {hizbChartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              مقارنة الأحزاب المسرودة بين الجلسات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hizbChartConfig} className="h-[250px] w-full">
              <BarChart data={hizbChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hizb" fill="var(--color-hizb)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">سجل الجلسات</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              لا توجد جلسات سرد لهذا الطالب
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead className="text-center">الأحزاب</TableHead>
                    <TableHead className="text-center">الأخطاء</TableHead>
                    <TableHead className="text-center">اللحون</TableHead>
                    <TableHead className="text-center">التنبيهات</TableHead>
                    <TableHead className="text-center">الدرجة</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...attempts].reverse().map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        {a.session?.session_date || a.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.session?.title || "—"}
                      </TableCell>
                      <TableCell className="text-center">{a.total_hizb_count}</TableCell>
                      <TableCell className="text-center">{a.mistakes_count}</TableCell>
                      <TableCell className="text-center">{a.lahn_count}</TableCell>
                      <TableCell className="text-center">{a.warnings_count}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-bold ${
                            Number(a.grade) >= 80
                              ? "text-success"
                              : Number(a.grade) >= 60
                              ? "text-warning"
                              : "text-destructive"
                          }`}
                        >
                          {a.grade}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={a.status === "passed" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {a.status === "passed" ? "ناجح" : a.status === "failed" ? "راسب" : "قيد المراجعة"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentNarrationProgress;
