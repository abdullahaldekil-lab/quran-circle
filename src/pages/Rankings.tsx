import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, CheckCircle, Medal, Award, Star } from "lucide-react";

const TOTAL_PAGES = 604;
const INITIAL_SHOW = 20;
const LOAD_MORE_SIZE = 20;

interface StudentRanking {
  id: string;
  full_name: string;
  halaqa_id: string | null;
  halaqa_name: string;
  join_date: string;
  total_memorized_pages: number;
  avg_score: number;
  avg_mistakes: number;
  attendance_rate: number;
  memorization_days: number | null;
}

const Rankings = () => {
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [filterHalaqa, setFilterHalaqa] = useState("all");
  const [rankings, setRankings] = useState<StudentRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCount, setShowCount] = useState(INITIAL_SHOW);

  useEffect(() => {
    supabase.from("halaqat").select("*").eq("active", true).then(({ data }) => setHalaqat(data || []));
  }, []);

  useEffect(() => {
    setShowCount(INITIAL_SHOW);
    fetchRankings();
  }, [filterHalaqa]);

  const fetchRankings = async () => {
    setLoading(true);

    let studentsQuery = supabase
      .from("students")
      .select("id, full_name, halaqa_id, join_date, total_memorized_pages, halaqat(name)")
      .eq("status", "active");

    if (filterHalaqa !== "all") {
      studentsQuery = studentsQuery.eq("halaqa_id", filterHalaqa);
    }

    const { data: students } = await studentsQuery;
    if (!students || students.length === 0) {
      setRankings([]);
      setLoading(false);
      return;
    }

    const studentIds = students.map((s) => s.id);

    const [recitationsRes, attendanceRes] = await Promise.all([
      supabase
        .from("recitation_records")
        .select("student_id, total_score, mistakes_count")
        .in("student_id", studentIds),
      supabase
        .from("attendance")
        .select("student_id, status")
        .in("student_id", studentIds),
    ]);

    const recitations = recitationsRes.data || [];
    const attendance = attendanceRes.data || [];

    const ranked: StudentRanking[] = students.map((s) => {
      const studentRecitations = recitations.filter((r) => r.student_id === s.id);
      const studentAttendance = attendance.filter((a) => a.student_id === s.id);

      const scores = studentRecitations.map((r) => Number(r.total_score)).filter(Boolean);
      const mistakes = studentRecitations.map((r) => Number(r.mistakes_count ?? 0));

      const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const avgMistakes = mistakes.length ? mistakes.reduce((a, b) => a + b, 0) / mistakes.length : 0;

      const totalAttendance = studentAttendance.length;
      const presentCount = studentAttendance.filter((a) => a.status === "present" || a.status === "late").length;
      const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

      const pages = s.total_memorized_pages || 0;
      const isComplete = pages >= TOTAL_PAGES;
      let memDays: number | null = null;
      if (isComplete) {
        const joinDate = new Date(s.join_date);
        const now = new Date();
        const totalDays = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        const absentDays = studentAttendance.filter((a) => a.status === "absent").length;
        memDays = totalDays - absentDays;
      }

      return {
        id: s.id,
        full_name: s.full_name,
        halaqa_id: s.halaqa_id,
        halaqa_name: (s.halaqat as any)?.name || "بدون حلقة",
        join_date: s.join_date,
        total_memorized_pages: pages,
        avg_score: Math.round(avgScore * 10) / 10,
        avg_mistakes: Math.round(avgMistakes * 10) / 10,
        attendance_rate: Math.round(attendanceRate),
        memorization_days: memDays,
      };
    });

    setRankings(ranked);
    setLoading(false);
  };

  const fastestMemorizers = [...rankings]
    .filter((r) => r.memorization_days !== null)
    .sort((a, b) => {
      if (a.memorization_days! !== b.memorization_days!) return a.memorization_days! - b.memorization_days!;
      if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
      return b.attendance_rate - a.attendance_rate;
    });

  const performanceRanking = [...rankings].sort((a, b) => {
    if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
    return a.avg_mistakes - b.avg_mistakes;
  });

  const attendanceRanking = [...rankings].sort((a, b) => b.attendance_rate - a.attendance_rate);

  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-[hsl(42,75%,55%)]" />;
    if (index === 1) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (index === 2) return <Award className="w-5 h-5 text-[hsl(25,60%,50%)]" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</span>;
  };

  const RankingList = ({
    data,
    renderValue,
    emptyMessage,
  }: {
    data: StudentRanking[];
    renderValue: (s: StudentRanking) => React.ReactNode;
    emptyMessage: string;
  }) => {
    const visibleData = data.slice(0, showCount);
    const hasMore = data.length > showCount;

    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {visibleData.map((student, index) => (
          <div
            key={student.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              index < 3 ? "bg-primary/5 border border-primary/10" : "bg-card border border-border"
            }`}
          >
            <div className="shrink-0">{getMedalIcon(index)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{student.full_name}</p>
              <p className="text-xs text-muted-foreground">{student.halaqa_name}</p>
            </div>
            <div className="text-left shrink-0">{renderValue(student)}</div>
          </div>
        ))}
        {hasMore && (
          <div className="text-center pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowCount(showCount + LOAD_MORE_SIZE)}>
              عرض المزيد ({data.length - showCount} متبقي)
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الترتيب والمنافسة</h1>
          <p className="text-muted-foreground text-sm">ترتيب الطلاب حسب الأداء والالتزام</p>
        </div>
        <Select value={filterHalaqa} onValueChange={setFilterHalaqa}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="كل الحلقات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحلقات</SelectItem>
            {halaqat.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="performance" dir="rtl">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="performance" className="text-xs sm:text-sm">
            <TrendingUp className="w-4 h-4 ml-1 hidden sm:inline" />
            الأداء
          </TabsTrigger>
          <TabsTrigger value="fastest" className="text-xs sm:text-sm">
            <Trophy className="w-4 h-4 ml-1 hidden sm:inline" />
            أسرع حافظ
          </TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs sm:text-sm">
            <CheckCircle className="w-4 h-4 ml-1 hidden sm:inline" />
            الالتزام
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                ترتيب الأداء
              </CardTitle>
              <p className="text-xs text-muted-foreground">بناءً على متوسط الدرجات وقلة الأخطاء</p>
            </CardHeader>
            <CardContent>
              <RankingList
                data={performanceRanking}
                emptyMessage="لا توجد بيانات كافية للترتيب"
                renderValue={(s) => (
                  <div className="text-left">
                    <span className={`text-sm font-bold ${s.avg_score >= 80 ? "text-success" : s.avg_score >= 60 ? "text-warning" : "text-destructive"}`}>
                      {s.avg_score}
                    </span>
                    <p className="text-xs text-muted-foreground">{s.avg_mistakes} أخطاء</p>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fastest">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[hsl(42,75%,55%)]" />
                أسرع حافظ
              </CardTitle>
              <p className="text-xs text-muted-foreground">من تاريخ الالتحاق حتى ختم القرآن الكريم</p>
            </CardHeader>
            <CardContent>
              <RankingList
                data={fastestMemorizers}
                emptyMessage="لا يوجد طلاب أتمّوا الحفظ بعد"
                renderValue={(s) => (
                  <div className="text-left">
                    <span className="text-sm font-bold text-primary">{s.memorization_days} يوم</span>
                  </div>
                )}
              />

              {rankings.filter((r) => r.memorization_days === null).length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground">تقدم الحفظ الحالي</h3>
                  <div className="space-y-3">
                    {[...rankings]
                      .filter((r) => r.memorization_days === null)
                      .sort((a, b) => b.total_memorized_pages - a.total_memorized_pages)
                      .slice(0, 10)
                      .map((student) => {
                        const progress = Math.round((student.total_memorized_pages / TOTAL_PAGES) * 100);
                        return (
                          <div key={student.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">{student.full_name}</span>
                              <span className="text-muted-foreground">{student.total_memorized_pages}/{TOTAL_PAGES} صفحة</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                ترتيب الالتزام
              </CardTitle>
              <p className="text-xs text-muted-foreground">بناءً على نسبة الحضور</p>
            </CardHeader>
            <CardContent>
              <RankingList
                data={attendanceRanking}
                emptyMessage="لا توجد بيانات حضور كافية"
                renderValue={(s) => (
                  <Badge
                    variant={s.attendance_rate >= 90 ? "default" : s.attendance_rate >= 70 ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {s.attendance_rate}%
                  </Badge>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Rankings;
