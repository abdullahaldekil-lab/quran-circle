import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, BarChart3, Trophy, BookOpen, Printer, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NarrationCertificate from "@/components/narration/NarrationCertificate";
import {
  LineChart, Line, PieChart, Pie, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend,
} from "recharts";

export default function NarrationReports() {
  const navigate = useNavigate();
  const { role } = useRole();
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [certStudent, setCertStudent] = useState<any>(null);
  const certRef = useRef<HTMLDivElement>(null);

  // Fetch sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ["narration-sessions-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_sessions" as any)
        .select("id, session_date, title, halaqa_id, halaqat(name)")
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch attempts for selected session
  const { data: attempts = [] } = useQuery({
    queryKey: ["narration-attempts-report", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      const { data, error } = await supabase
        .from("narration_attempts" as any)
        .select("*, students(full_name, halaqa_id, halaqat(name))")
        .eq("session_id", selectedSession)
        .order("grade", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedSession,
  });

  // Fetch all attempts for overall stats
  const { data: allAttempts = [] } = useQuery({
    queryKey: ["narration-attempts-all-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_attempts" as any)
        .select("session_id, student_id, total_hizb_count, grade, status, students(full_name, halaqa_id, halaqat(name))");
      if (error) throw error;
      return data as any[];
    },
  });

  // Settings
  const { data: settings } = useQuery({
    queryKey: ["narration-settings-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_settings" as any)
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const selectedSessionData = sessions.find((s: any) => s.id === selectedSession);

  // Session stats
  const presented = attempts.filter((a: any) => a.status !== "absent" && a.status !== "pending");
  const passed = attempts.filter((a: any) => a.status === "pass");
  const failed = attempts.filter((a: any) => a.status === "fail");
  const totalHizb = presented.reduce((s: number, a: any) => s + Number(a.total_hizb_count || 0), 0);
  const passedHizb = passed.reduce((s: number, a: any) => s + Number(a.total_hizb_count || 0), 0);
  const avgGrade = presented.length > 0
    ? (presented.reduce((s: number, a: any) => s + Number(a.grade || 0), 0) / presented.length).toFixed(1)
    : "—";

  // Rankings
  const ranked = [...presented].sort((a: any, b: any) => Number(b.grade) - Number(a.grade));

  // Overall halaqat stats
  const halaqatMap = new Map<string, { name: string; attempts: any[] }>();
  allAttempts.forEach((a: any) => {
    const hName = a.students?.halaqat?.name || "غير محدد";
    const hId = a.students?.halaqa_id || "unknown";
    if (!halaqatMap.has(hId)) halaqatMap.set(hId, { name: hName, attempts: [] });
    halaqatMap.get(hId)!.attempts.push(a);
  });
  const halaqatStats = Array.from(halaqatMap.entries()).map(([id, data]) => {
    const p = data.attempts.filter((a: any) => a.status === "pass");
    const total = data.attempts.filter((a: any) => a.status !== "absent" && a.status !== "pending");
    return {
      id,
      name: data.name,
      totalStudents: total.length,
      passed: p.length,
      totalHizb: total.reduce((s: number, a: any) => s + Number(a.total_hizb_count || 0), 0),
      avgGrade: total.length > 0
        ? (total.reduce((s: number, a: any) => s + Number(a.grade || 0), 0) / total.length).toFixed(1)
        : "0",
      passRate: total.length > 0 ? Math.round((p.length / total.length) * 100) : 0,
    };
  }).sort((a, b) => b.passRate - a.passRate);

  // --- Chart data ---
  const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)", "hsl(45, 93%, 47%)", "hsl(215, 20%, 65%)"];

  const passRateOverTime = useMemo(() => {
    return sessions.map((s: any) => {
      const sa = allAttempts.filter((a: any) => a.session_id === s.id);
      const presented = sa.filter((a: any) => a.status !== "absent" && a.status !== "pending");
      const passed = sa.filter((a: any) => a.status === "pass");
      const rate = presented.length > 0 ? Math.round((passed.length / presented.length) * 100) : 0;
      return {
        date: new Date(s.session_date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }),
        rate,
      };
    }).reverse();
  }, [sessions, allAttempts]);

  const statusDistribution = useMemo(() => {
    const counts = { pass: 0, fail: 0, absent: 0, pending: 0 };
    allAttempts.forEach((a: any) => {
      if (a.status in counts) counts[a.status as keyof typeof counts]++;
    });
    return [
      { name: "ناجح", value: counts.pass },
      { name: "راسب", value: counts.fail },
      { name: "غائب", value: counts.absent },
      { name: "معلق", value: counts.pending },
    ].filter(d => d.value > 0);
  }, [allAttempts]);

  const printCert = () => {
    if (certRef.current) {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<html dir="rtl"><head><title>شهادة</title></head><body>${certRef.current.innerHTML}</body></html>`);
        w.document.close();
        w.print();
      }
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quran-narration")}>
          <ArrowRight className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">تقارير يوم السرد القرآني</h1>
        </div>
      </div>

      <Tabs defaultValue="session" dir="rtl">
        <TabsList>
          <TabsTrigger value="dashboard">لوحة المؤشرات</TabsTrigger>
          <TabsTrigger value="session">تقارير الجلسة</TabsTrigger>
          <TabsTrigger value="overall">تقارير المجمع</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* Pass Rate Over Time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                تطور نسب الاجتياز عبر الجلسات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={passRateOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "نسبة الاجتياز"]} />
                  <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie + Bar side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie Chart - Status Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  توزيع حالات الطلاب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar Chart - Halaqat Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  مقارنة أداء الحلقات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={halaqatStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, "نسبة الاجتياز"]} />
                    <Bar dataKey="passRate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="session" className="space-y-4 mt-4">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="اختر الجلسة" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {new Date(s.session_date).toLocaleDateString("ar-SA")} — {s.halaqat?.name || s.title || "جلسة"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSession && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">الحضور</p><p className="text-2xl font-bold">{presented.length}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">مج. الأحزاب</p><p className="text-2xl font-bold">{totalHizb}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">أحزاب النجاح</p><p className="text-2xl font-bold text-chart-2">{passedHizb}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">متوسط الدرجة</p><p className="text-2xl font-bold">{avgGrade}</p></CardContent></Card>
              </div>

              {/* Ranked Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-chart-4" />
                    ترتيب الطلاب
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-12">#</TableHead>
                        <TableHead className="text-right">الطالب</TableHead>
                        <TableHead className="text-right">الحلقة</TableHead>
                        <TableHead className="text-center">الأحزاب</TableHead>
                        <TableHead className="text-center">الدرجة</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">شهادة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranked.map((a: any, i: number) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-center font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{a.students?.full_name}</TableCell>
                          <TableCell>{a.students?.halaqat?.name || "—"}</TableCell>
                          <TableCell className="text-center">{Number(a.total_hizb_count)}</TableCell>
                          <TableCell className="text-center font-bold">{Number(a.grade)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={a.status === "pass" ? "default" : "destructive"}>
                              {a.status === "pass" ? "ناجح" : "راسب"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setCertStudent({
                                  studentName: a.students?.full_name,
                                  halaqaName: a.students?.halaqat?.name || selectedSessionData?.halaqat?.name || "—",
                                  totalHizb: Number(a.total_hizb_count),
                                  grade: Number(a.grade),
                                  maxGrade: settings?.max_grade || 100,
                                  status: a.status,
                                  halaqaRank: i + 1,
                                  overallRank: 0,
                                  sessionDate: selectedSessionData?.session_date || "",
                                });
                                setTimeout(printCert, 200);
                              }}
                            >
                              <Printer className="w-3 h-3 ml-1" />
                              طباعة
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="overall" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                ترتيب الحلقات حسب الأداء
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-12">#</TableHead>
                    <TableHead className="text-right">الحلقة</TableHead>
                    <TableHead className="text-center">عدد الطلاب</TableHead>
                    <TableHead className="text-center">مج. الأحزاب</TableHead>
                    <TableHead className="text-center">المجتازون</TableHead>
                    <TableHead className="text-center">متوسط الدرجة</TableHead>
                    <TableHead className="text-center">نسبة الاجتياز</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {halaqatStats.map((h, i) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-center font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell className="text-center">{h.totalStudents}</TableCell>
                      <TableCell className="text-center">{h.totalHizb}</TableCell>
                      <TableCell className="text-center text-chart-2 font-bold">{h.passed}</TableCell>
                      <TableCell className="text-center">{h.avgGrade}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={h.passRate >= 70 ? "default" : "destructive"}>
                          {h.passRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden certificate for printing */}
      <div ref={certRef} className="hidden print:block">
        {certStudent && <NarrationCertificate {...certStudent} />}
      </div>
    </div>
  );
}
