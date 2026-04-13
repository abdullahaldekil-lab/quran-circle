import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, BookOpen, ScrollText, Users, TrendingUp, CalendarDays } from "lucide-react";
import PageDateHeader from "@/components/PageDateHeader";

const ProgramsOverview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [excellence, setExcellence] = useState({ students: 0, avgScore: 0, lastSession: "" });
  const [madarij, setMadarij] = useState({ silver: 0, gold: 0, completedHizb: 0, passRate: 0 });
  const [narration, setNarration] = useState({ sessions: 0, totalHizb: 0, passRate: 0 });

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const [eliteRes, sessionsRes, perfRes, enrollRes, examsRes, narrSessionsRes, narrAttemptsRes] = await Promise.all([
        supabase.from("excellence_elite_students").select("id", { count: "exact", head: true }),
        supabase.from("excellence_sessions").select("session_date").order("session_date", { ascending: false }).limit(1),
        supabase.from("excellence_performance").select("total_score").gte("created_at", monthStart + "T00:00:00"),
        supabase.from("madarij_enrollments").select("id, track_id, status").eq("status", "active"),
        supabase.from("madarij_hizb_exams").select("passed").gte("created_at", monthStart + "T00:00:00"),
        supabase.from("narration_sessions" as any).select("id").gte("session_date", monthStart),
        supabase.from("narration_attempts").select("status, total_hizb_count").gte("created_at", monthStart + "T00:00:00"),
      ]);

      // Excellence
      const perfArr = perfRes.data || [];
      const avgScore = perfArr.length ? Math.round(perfArr.reduce((s, p) => s + Number(p.total_score || 0), 0) / perfArr.length) : 0;
      setExcellence({
        students: eliteRes.count || 0,
        avgScore,
        lastSession: sessionsRes.data?.[0]?.session_date || "—",
      });

      // Madarij
      const enrollments = enrollRes.data || [];
      const examsArr = examsRes.data || [];
      const passedExams = examsArr.filter((e: any) => e.passed).length;
      setMadarij({
        silver: enrollments.length,
        gold: 0,
        completedHizb: passedExams,
        passRate: examsArr.length ? Math.round((passedExams / examsArr.length) * 100) : 0,
      });

      // Narration
      const narrAttempts = narrAttemptsRes.data || [];
      const narrPassed = narrAttempts.filter((a: any) => a.status === "pass" || a.status === "passed").length;
      const totalHizb = narrAttempts.reduce((s: number, a: any) => s + (a.total_hizb_count || 0), 0);
      setNarration({
        sessions: (narrSessionsRes.data || []).length,
        totalHizb,
        passRate: narrAttempts.length ? Math.round((narrPassed / narrAttempts.length) * 100) : 0,
      });

      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageDateHeader />
      <div>
        <h1 className="text-2xl font-bold">إشراف البرامج</h1>
        <p className="text-muted-foreground text-sm">نظرة عامة على جميع البرامج الأكاديمية</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Excellence */}
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-600" />
              مسار التميّز
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{excellence.students}</p>
                <p className="text-xs text-muted-foreground">طالب متميز</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{excellence.avgScore}</p>
                <p className="text-xs text-muted-foreground">متوسط الدرجة</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="w-3 h-3" />
              آخر جلسة: {excellence.lastSession}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/excellence")}>
              عرض التفاصيل
            </Button>
          </CardContent>
        </Card>

        {/* Madarij */}
        <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              برنامج مدارج
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{madarij.silver}</p>
                <p className="text-xs text-muted-foreground">مسجّل نشط</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{madarij.completedHizb}</p>
                <p className="text-xs text-muted-foreground">أحزاب مكتملة</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              نسبة الاجتياز: {madarij.passRate}%
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/madarij")}>
              عرض التفاصيل
            </Button>
          </CardContent>
        </Card>

        {/* Narration */}
        <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-blue-600" />
              يوم السرد القرآني
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{narration.sessions}</p>
                <p className="text-xs text-muted-foreground">جلسة هذا الشهر</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{narration.totalHizb}</p>
                <p className="text-xs text-muted-foreground">إجمالي الأحزاب</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              نسبة الاجتياز: {narration.passRate}%
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/quran-narration")}>
              عرض التفاصيل
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProgramsOverview;
