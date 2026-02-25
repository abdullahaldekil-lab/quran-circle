import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowRight, Printer, Save } from "lucide-react";
import { format } from "date-fns";

export default function ExcellenceReports() {
  const navigate = useNavigate();
  const { isManager } = useRole();
  const { filterHalaqat } = useTeacherHalaqat();

  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Session report
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionReport, setSessionReport] = useState<any>(null);

  // Halaqa report
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [halaqaReport, setHalaqaReport] = useState<any>(null);

  // Complex report (all halaqat)
  const [complexReport, setComplexReport] = useState<any>(null);

  // Monthly report
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyReport, setMonthlyReport] = useState<any[]>([]);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBase();
  }, []);

  const fetchBase = async () => {
    const [halRes, sessRes] = await Promise.all([
      supabase.from("halaqat").select("id, name").eq("active", true),
      supabase.from("excellence_sessions").select("id, session_date, halaqa_id, halaqat(name)").order("session_date", { ascending: false }),
    ]);
    setHalaqat(filterHalaqat(halRes.data || []));
    setSessions(sessRes.data || []);
  };

  // Session Report
  const loadSessionReport = async () => {
    if (!selectedSessionId) return;
    const [perfRes, attRes, sessRes] = await Promise.all([
      supabase.from("excellence_performance").select("*, students:student_id(full_name)").eq("session_id", selectedSessionId).order("rank_in_group"),
      supabase.from("excellence_attendance").select("*").eq("session_id", selectedSessionId),
      supabase.from("excellence_sessions").select("*, halaqat(name)").eq("id", selectedSessionId).single(),
    ]);
    setSessionReport({
      session: sessRes.data,
      performance: perfRes.data || [],
      attendance: attRes.data || [],
    });
  };

  // Halaqa Report
  const loadHalaqaReport = async () => {
    if (!selectedHalaqaId) return;
    const { data: perfs } = await supabase
      .from("excellence_performance")
      .select("*, students:student_id(full_name), excellence_sessions!inner(halaqa_id)")
      .eq("excellence_sessions.halaqa_id", selectedHalaqaId);

    const { data: atts } = await supabase
      .from("excellence_attendance")
      .select("*, excellence_sessions!inner(halaqa_id)")
      .eq("excellence_sessions.halaqa_id", selectedHalaqaId);

    const studentMap: Record<string, { name: string; totalScore: number; count: number; totalHizb: number; attended: number }> = {};
    (perfs || []).forEach((p: any) => {
      const sid = p.student_id;
      if (!studentMap[sid]) studentMap[sid] = { name: (p as any).students?.full_name || "—", totalScore: 0, count: 0, totalHizb: 0, attended: 0 };
      studentMap[sid].totalScore += Number(p.total_score);
      studentMap[sid].totalHizb += Number(p.hizb_count);
      studentMap[sid].count += 1;
    });
    (atts || []).forEach((a: any) => {
      if (a.is_present && studentMap[a.student_id]) studentMap[a.student_id].attended += 1;
    });

    const ranked = Object.entries(studentMap)
      .map(([id, s]) => ({ id, ...s, avg: s.count > 0 ? s.totalScore / s.count : 0 }))
      .sort((a, b) => b.avg - a.avg);

    setHalaqaReport({ students: ranked, totalSessions: new Set((perfs || []).map((p: any) => p.session_id)).size });
  };

  // Complex Report
  const loadComplexReport = async () => {
    const { data: perfs } = await supabase
      .from("excellence_performance")
      .select("*, students:student_id(full_name, halaqa_id), excellence_sessions!inner(halaqa_id, halaqat(name))");

    const halaqaMap: Record<string, { name: string; totalScore: number; count: number; totalHizb: number }> = {};
    const studentMap: Record<string, { name: string; totalScore: number; count: number; totalHizb: number }> = {};

    (perfs || []).forEach((p: any) => {
      const hid = p.excellence_sessions?.halaqa_id;
      const hname = p.excellence_sessions?.halaqat?.name || "—";
      if (!halaqaMap[hid]) halaqaMap[hid] = { name: hname, totalScore: 0, count: 0, totalHizb: 0 };
      halaqaMap[hid].totalScore += Number(p.total_score);
      halaqaMap[hid].totalHizb += Number(p.hizb_count);
      halaqaMap[hid].count += 1;

      const sid = p.student_id;
      const sname = (p as any).students?.full_name || "—";
      if (!studentMap[sid]) studentMap[sid] = { name: sname, totalScore: 0, count: 0, totalHizb: 0 };
      studentMap[sid].totalScore += Number(p.total_score);
      studentMap[sid].totalHizb += Number(p.hizb_count);
      studentMap[sid].count += 1;
    });

    const halaqaRanked = Object.entries(halaqaMap)
      .map(([id, h]) => ({ id, ...h, avg: h.count > 0 ? h.totalScore / h.count : 0 }))
      .sort((a, b) => b.avg - a.avg);

    const top10 = Object.entries(studentMap)
      .map(([id, s]) => ({ id, ...s, avg: s.count > 0 ? s.totalScore / s.count : 0 }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);

    setComplexReport({ halaqat: halaqaRanked, topStudents: top10 });
  };

  // Monthly Report
  const loadMonthlyReport = async () => {
    const [yearStr, monthStr] = monthYear.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const startDate = `${yearStr}-${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const { data: sessionsInMonth } = await supabase
      .from("excellence_sessions")
      .select("id")
      .gte("session_date", startDate)
      .lte("session_date", endDate);

    const sessionIds = (sessionsInMonth || []).map((s) => s.id);
    if (sessionIds.length === 0) {
      setMonthlyReport([]);
      return;
    }

    const [perfRes, attRes] = await Promise.all([
      supabase.from("excellence_performance").select("*, students:student_id(full_name)").in("session_id", sessionIds),
      supabase.from("excellence_attendance").select("*").in("session_id", sessionIds).eq("is_present", true),
    ]);

    const studentMap: Record<string, { name: string; totalScore: number; sessions: number; totalPages: number; totalHizb: number; attended: number }> = {};
    (perfRes.data || []).forEach((p: any) => {
      const sid = p.student_id;
      if (!studentMap[sid]) studentMap[sid] = { name: (p as any).students?.full_name || "—", totalScore: 0, sessions: 0, totalPages: 0, totalHizb: 0, attended: 0 };
      studentMap[sid].totalScore += Number(p.total_score);
      studentMap[sid].totalPages += Number(p.pages_displayed);
      studentMap[sid].totalHizb += Number(p.hizb_count);
      studentMap[sid].sessions += 1;
    });
    (attRes.data || []).forEach((a: any) => {
      if (studentMap[a.student_id]) studentMap[a.student_id].attended += 1;
    });

    const ranked = Object.entries(studentMap)
      .map(([id, s]) => ({ id, ...s, avg: s.sessions > 0 ? s.totalScore / s.sessions : 0 }))
      .sort((a, b) => b.avg - a.avg)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    setMonthlyReport(ranked);
  };

  const saveMonthlyReport = async () => {
    const [yearStr, monthStr] = monthYear.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    for (const s of monthlyReport) {
      await supabase.from("excellence_monthly_report").upsert({
        month, year, student_id: s.id,
        total_attendance: s.attended,
        total_pages: s.totalPages,
        total_sessions: s.sessions,
        total_hizb: s.totalHizb,
        average_score: Math.round(s.avg * 100) / 100,
        final_rank: s.rank,
      }, { onConflict: "month,year,student_id" });
    }
    toast.success("تم حفظ التقرير الشهري");
  };

  const handlePrint = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="rtl"><head><title>تقرير</title>
      <style>body{font-family:Arial;padding:20px;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}th{background:#1e3a5f;color:#fff}@media print{body{padding:0}}</style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/excellence")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">تقارير التميّز</h1>
      </div>

      <Tabs defaultValue="session" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="session">تقرير الجلسة</TabsTrigger>
          <TabsTrigger value="halaqa">تقرير الحلقة</TabsTrigger>
          <TabsTrigger value="complex">تقرير المجمع</TabsTrigger>
          <TabsTrigger value="monthly">التقرير الشهري</TabsTrigger>
        </TabsList>

        {/* Session Report */}
        <TabsContent value="session">
          <Card>
            <CardHeader>
              <CardTitle>تقرير الجلسة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="اختر جلسة" /></SelectTrigger>
                  <SelectContent>
                    {sessions.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {format(new Date(s.session_date), "yyyy/MM/dd")} — {s.halaqat?.name || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={loadSessionReport}>عرض</Button>
                {sessionReport && <Button variant="outline" onClick={() => handlePrint("session-report-print")}>
                  <Printer className="w-4 h-4 ml-1" />طباعة
                </Button>}
              </div>
              {sessionReport && (
                <div id="session-report-print">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{sessionReport.attendance.filter((a: any) => a.is_present).length}</p><p className="text-xs text-muted-foreground">حاضرون</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{Number(sessionReport.session?.total_hizb_in_session || 0)}</p><p className="text-xs text-muted-foreground">أحزاب</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{Number(sessionReport.session?.total_pages_displayed || 0)}</p><p className="text-xs text-muted-foreground">أوجه</p></CardContent></Card>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-center">الترتيب</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-center">الأحزاب</TableHead>
                      <TableHead className="text-center">الأوجه</TableHead>
                      <TableHead className="text-center">الأخطاء</TableHead>
                      <TableHead className="text-center">اللحون</TableHead>
                      <TableHead className="text-center">التنبيهات</TableHead>
                      <TableHead className="text-center">الدرجة</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {sessionReport.performance.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-center font-bold">{p.rank_in_group || "—"}</TableCell>
                          <TableCell>{(p as any).students?.full_name || "—"}</TableCell>
                          <TableCell className="text-center">{Number(p.hizb_count)}</TableCell>
                          <TableCell className="text-center">{Number(p.pages_displayed)}</TableCell>
                          <TableCell className="text-center">{p.mistakes_count}</TableCell>
                          <TableCell className="text-center">{p.lahon_count}</TableCell>
                          <TableCell className="text-center">{p.warnings_count}</TableCell>
                          <TableCell className="text-center font-bold">{Number(p.total_score).toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Halaqa Report */}
        <TabsContent value="halaqa">
          <Card>
            <CardHeader><CardTitle>تقرير الحلقة</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedHalaqaId} onValueChange={setSelectedHalaqaId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="اختر حلقة" /></SelectTrigger>
                  <SelectContent>
                    {halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={loadHalaqaReport}>عرض</Button>
                {halaqaReport && <Button variant="outline" onClick={() => handlePrint("halaqa-report-print")}>
                  <Printer className="w-4 h-4 ml-1" />طباعة
                </Button>}
              </div>
              {halaqaReport && (
                <div id="halaqa-report-print">
                  <p className="text-sm text-muted-foreground mb-2">عدد الجلسات: {halaqaReport.totalSessions}</p>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-center">#</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-center">متوسط الدرجة</TableHead>
                      <TableHead className="text-center">إجمالي الأحزاب</TableHead>
                      <TableHead className="text-center">عدد الحضور</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {halaqaReport.students.map((s: any, i: number) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-center">{i + 1}</TableCell>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="text-center font-bold">{s.avg.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{s.totalHizb}</TableCell>
                          <TableCell className="text-center">{s.attended}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complex Report */}
        <TabsContent value="complex">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>تقرير المجمع</CardTitle>
              <div className="flex gap-2">
                <Button onClick={loadComplexReport}>تحميل التقرير</Button>
                {complexReport && <Button variant="outline" onClick={() => handlePrint("complex-report-print")}>
                  <Printer className="w-4 h-4 ml-1" />طباعة
                </Button>}
              </div>
            </CardHeader>
            <CardContent>
              {complexReport && (
                <div id="complex-report-print" className="space-y-6">
                  <div>
                    <h3 className="font-bold mb-2">مقارنة الحلقات</h3>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-right">الحلقة</TableHead>
                        <TableHead className="text-center">متوسط الدرجة</TableHead>
                        <TableHead className="text-center">إجمالي الأحزاب</TableHead>
                        <TableHead className="text-center">عدد المشاركات</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {complexReport.halaqat.map((h: any) => (
                          <TableRow key={h.id}>
                            <TableCell>{h.name}</TableCell>
                            <TableCell className="text-center font-bold">{h.avg.toFixed(1)}</TableCell>
                            <TableCell className="text-center">{h.totalHizb}</TableCell>
                            <TableCell className="text-center">{h.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">أفضل 10 طلاب</h3>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-center">#</TableHead>
                        <TableHead className="text-right">الطالب</TableHead>
                        <TableHead className="text-center">متوسط الدرجة</TableHead>
                        <TableHead className="text-center">إجمالي الأحزاب</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {complexReport.topStudents.map((s: any, i: number) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-center font-bold">{i + 1}</TableCell>
                            <TableCell>{s.name}</TableCell>
                            <TableCell className="text-center font-bold">{s.avg.toFixed(1)}</TableCell>
                            <TableCell className="text-center">{s.totalHizb}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Report */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader><CardTitle>التقرير الشهري</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} className="w-48" />
                <Button onClick={loadMonthlyReport}>عرض</Button>
                {monthlyReport.length > 0 && (
                  <>
                    {isManager && (
                      <Button variant="secondary" onClick={saveMonthlyReport}>
                        <Save className="w-4 h-4 ml-1" />حفظ
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => handlePrint("monthly-report-print")}>
                      <Printer className="w-4 h-4 ml-1" />طباعة
                    </Button>
                  </>
                )}
              </div>
              {monthlyReport.length > 0 && (
                <div id="monthly-report-print">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-center">الترتيب</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-center">الحضور</TableHead>
                      <TableHead className="text-center">الجلسات</TableHead>
                      <TableHead className="text-center">الأوجه</TableHead>
                      <TableHead className="text-center">الأحزاب</TableHead>
                      <TableHead className="text-center">متوسط الدرجة</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {monthlyReport.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-center font-bold text-primary">{s.rank}</TableCell>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="text-center">{s.attended}</TableCell>
                          <TableCell className="text-center">{s.sessions}</TableCell>
                          <TableCell className="text-center">{s.totalPages}</TableCell>
                          <TableCell className="text-center">{s.totalHizb}</TableCell>
                          <TableCell className="text-center font-bold">{s.avg.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {monthlyReport.length === 0 && selectedSessionId && (
                <p className="text-center text-muted-foreground py-4">لا توجد بيانات لهذا الشهر</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
