import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Users, Award } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const GRADE_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: "ممتاز", color: "hsl(145, 60%, 40%)" },
  very_good: { label: "جيد جداً", color: "hsl(210, 70%, 50%)" },
  good: { label: "جيد", color: "hsl(42, 75%, 55%)" },
  needs_review: { label: "يحتاج مراجعة", color: "hsl(0, 72%, 51%)" },
};

const GRADE_COLORS = [
  "hsl(145, 60%, 40%)",
  "hsl(210, 70%, 50%)",
  "hsl(42, 75%, 55%)",
  "hsl(0, 72%, 51%)",
];

interface QuizStats {
  totalQuizzes: number;
  avgScore: number;
  gradeDistribution: { name: string; value: number; color: string }[];
  recentQuizzes: any[];
  topStudents: { name: string; score: number }[];
}

const QuizAnalytics = () => {
  const { user } = useAuth();
  const { allowedHalaqatIds, loading: accessLoading } = useTeacherHalaqat();
  const [stats, setStats] = useState<QuizStats>({
    totalQuizzes: 0,
    avgScore: 0,
    gradeDistribution: [],
    recentQuizzes: [],
    topStudents: [],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || accessLoading) return;

    const fetch = async () => {
      try {
        // Get last 30 days of quizzes
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

        let query = supabase
          .from("student_quizzes")
          .select("id, score, grade_label, quiz_date, difficulty, student_id, students(full_name), halaqat(name)")
          .eq("status", "completed")
          .gte("quiz_date", dateStr)
          .order("quiz_date", { ascending: false });

        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          query = query.in("halaqa_id", allowedHalaqatIds);
        } else if (allowedHalaqatIds !== null && allowedHalaqatIds.length === 0) {
          setLoaded(true);
          return;
        }

        const { data: quizzes } = await query;
        if (!quizzes || quizzes.length === 0) {
          setLoaded(true);
          return;
        }

        // Average score
        const avg = Math.round(quizzes.reduce((s, q) => s + (q.score || 0), 0) / quizzes.length);

        // Grade distribution
        const gradeCounts: Record<string, number> = { excellent: 0, very_good: 0, good: 0, needs_review: 0 };
        quizzes.forEach((q) => {
          if (q.grade_label && gradeCounts[q.grade_label] !== undefined) {
            gradeCounts[q.grade_label]++;
          }
        });
        const gradeDistribution = Object.entries(gradeCounts)
          .filter(([, v]) => v > 0)
          .map(([key, value], i) => ({
            name: GRADE_LABELS[key]?.label || key,
            value,
            color: GRADE_COLORS[i] || GRADE_COLORS[0],
          }));

        // Top 5 students by avg score
        const studentScores: Record<string, { name: string; total: number; count: number }> = {};
        quizzes.forEach((q) => {
          const sid = q.student_id;
          const name = (q.students as any)?.full_name || "—";
          if (!studentScores[sid]) studentScores[sid] = { name, total: 0, count: 0 };
          studentScores[sid].total += q.score || 0;
          studentScores[sid].count++;
        });
        const topStudents = Object.values(studentScores)
          .map((s) => ({ name: s.name, score: Math.round(s.total / s.count) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        setStats({
          totalQuizzes: quizzes.length,
          avgScore: avg,
          gradeDistribution,
          recentQuizzes: quizzes.slice(0, 5),
          topStudents,
        });
      } catch (e) {
        console.error("Quiz analytics error:", e);
      } finally {
        setLoaded(true);
      }
    };
    fetch();
  }, [user, accessLoading, allowedHalaqatIds]);

  if (!loaded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (stats.totalQuizzes === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            إحصائيات الاختبارات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">لا توجد اختبارات في آخر 30 يوماً</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        إحصائيات الاختبارات الذكية
        <Badge variant="outline" className="text-xs">آخر 30 يوم</Badge>
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Brain className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
            <p className="text-xs text-muted-foreground">إجمالي الاختبارات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.avgScore}%</p>
            <p className="text-xs text-muted-foreground">متوسط الدرجات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {stats.gradeDistribution.find(g => g.name === "ممتاز")?.value || 0}
            </p>
            <p className="text-xs text-muted-foreground">طلاب ممتازين</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.topStudents.length}</p>
            <p className="text-xs text-muted-foreground">طلاب مختبَرين</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Grade Distribution Donut */}
        {stats.gradeDistribution.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">توزيع التصنيفات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.gradeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {stats.gradeDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Students Bar Chart */}
        {stats.topStudents.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">أفضل الطلاب</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topStudents} layout="vertical" margin={{ right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, "المتوسط"]} />
                    <Bar dataKey="score" fill="hsl(155, 55%, 28%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Quizzes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">أحدث الاختبارات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.recentQuizzes.map((q: any) => {
              const gl = GRADE_LABELS[q.grade_label];
              return (
                <div key={q.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{(q.students as any)?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(q.halaqat as any)?.name} — {q.quiz_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{q.score}%</span>
                    {gl && (
                      <Badge variant="outline" className="text-xs">
                        {gl.label}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizAnalytics;
