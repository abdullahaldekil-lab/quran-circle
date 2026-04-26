import { useState, useEffect, useMemo } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowRight, Printer, Save, Star, Send, FileText, Users, BookOpen, BarChart3, Award } from "lucide-react";

import { formatHijriArabic, formatHijriStringArabic, formatGregorianArabic, formatDateSmart, toHijri, toMiladi, formatDateHijriOnly } from "@/lib/hijri";
import { sendNotification } from "@/utils/sendNotification";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const HIJRI_MONTHS = [
  "محرّم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان", "شوّال", "ذو القعدة", "ذو الحجة",
];

export default function ExcellenceReports() {
  const navigate = useNavigate();
  const { isManager } = useRole();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<any[]>([]);

  // Session report
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionReport, setSessionReport] = useState<any>(null);

  // Complex report (all students across all tracks)
  const [complexReport, setComplexReport] = useState<any>(null);

  // Monthly report — Hijri month/year
  const currentHijri = toHijri(new Date());
  const [hijriMonth, setHijriMonth] = useState(String(currentHijri.month));
  const [hijriYear, setHijriYear] = useState(String(currentHijri.year));
  const [monthlyReport, setMonthlyReport] = useState<any[]>([]);
  const [monthlyHalaqaReport, setMonthlyHalaqaReport] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [publishingMonthly, setPublishingMonthly] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyTrackFilter, setMonthlyTrackFilter] = useState<string>("all");
  const [monthlyHalaqaFilter, setMonthlyHalaqaFilter] = useState<string>("all");
  const [allHalaqat, setAllHalaqat] = useState<any[]>([]);

  // Track report
  const [excellenceTracks, setExcellenceTracks] = useState<any[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [trackReport, setTrackReport] = useState<any>(null);

  // Distinguished student report
  const [distinguishedStudents, setDistinguishedStudents] = useState<any[]>([]);
  const [selectedDistStudentId, setSelectedDistStudentId] = useState("");
  const [distStudentReport, setDistStudentReport] = useState<any>(null);

  useEffect(() => {
    fetchBase();
  }, []);

  const fetchBase = async () => {
    const [sessRes, tracksRes, distRes, halaqatRes] = await Promise.all([
      supabase.from("excellence_sessions").select("id, session_date, session_hijri_date, track_id, halaqa_id, halaqat(name), excellence_tracks:track_id(track_name)").order("session_date", { ascending: false }),
      supabase.from("excellence_tracks").select("id, track_name").eq("is_active", true).order("track_name"),
      supabase.from("distinguished_students").select("id, student_id, date_added, students:student_id(full_name), excellence_tracks:track_id(track_name)").order("date_added", { ascending: false }),
      supabase.from("halaqat").select("id, name").eq("active", true).order("name"),
    ]);
    setSessions(sessRes.data || []);
    setExcellenceTracks(tracksRes.data || []);
    setAllHalaqat(halaqatRes.data || []);
    setDistinguishedStudents((distRes.data || []).map((d: any) => ({
      ...d,
      student_name: d.students?.full_name || "—",
      track_name: d.excellence_tracks?.track_name || "—",
    })));
  };

  const getSessionDisplayName = (s: any) => {
    const trackName = s.excellence_tracks?.track_name;
    const halaqaName = s.halaqat?.name;
    const hijriPart = s.session_hijri_date ? formatHijriStringArabic(s.session_hijri_date) : formatHijriArabic(s.session_date);
    const gregPart = ` (${formatGregorianArabic(s.session_date)})`;
    return `${hijriPart}${gregPart} — ${trackName || halaqaName || ""}`;
  };

  // Session Report
  const loadSessionReport = async () => {
    if (!selectedSessionId) return;
    const [perfRes, attRes, sessRes] = await Promise.all([
      supabase.from("excellence_performance").select("*, students:student_id(full_name)").eq("session_id", selectedSessionId).order("rank_in_group"),
      supabase.from("excellence_attendance").select("*").eq("session_id", selectedSessionId),
      supabase.from("excellence_sessions").select("*, halaqat(name), excellence_tracks:track_id(track_name)").eq("id", selectedSessionId).single(),
    ]);
    setSessionReport({
      session: sessRes.data,
      performance: perfRes.data || [],
      attendance: attRes.data || [],
    });
  };

  // Complex Report — all students across the complex ranked together
  const loadComplexReport = async () => {
    const { data: perfs } = await supabase
      .from("excellence_performance")
      .select("*, students:student_id(full_name)");

    const studentMap: Record<string, { name: string; totalScore: number; count: number; totalHizb: number }> = {};

    (perfs || []).forEach((p: any) => {
      const sid = p.student_id;
      const sname = (p as any).students?.full_name || "—";
      if (!studentMap[sid]) studentMap[sid] = { name: sname, totalScore: 0, count: 0, totalHizb: 0 };
      studentMap[sid].totalScore += Number(p.total_score);
      studentMap[sid].totalHizb += Number(p.hizb_count);
      studentMap[sid].count += 1;
    });

    const top = Object.entries(studentMap)
      .map(([id, s]) => ({ id, ...s, avg: s.count > 0 ? s.totalScore / s.count : 0 }))
      .sort((a, b) => b.avg - a.avg);

    setComplexReport({ topStudents: top });
  };

  // Monthly Report — uses Hijri month/year to determine Gregorian date range
  const loadMonthlyReport = async () => {
    setMonthlyLoading(true);
    try {
      const hMonth = parseInt(hijriMonth);
      const hYear = parseInt(hijriYear);
      const startGreg = toMiladi(hYear, hMonth, 1);
      const endGreg = toMiladi(hMonth === 12 ? hYear + 1 : hYear, hMonth === 12 ? 1 : hMonth + 1, 1);
      endGreg.setDate(endGreg.getDate() - 1);
      const startDate = startGreg.toISOString().split("T")[0];
      const endDate = endGreg.toISOString().split("T")[0];

      let sessionsQuery = supabase
        .from("excellence_sessions")
        .select("id, halaqa_id, track_id")
        .gte("session_date", startDate)
        .lte("session_date", endDate);

      if (monthlyTrackFilter !== "all") sessionsQuery = sessionsQuery.eq("track_id", monthlyTrackFilter);
      if (monthlyHalaqaFilter !== "all") sessionsQuery = sessionsQuery.eq("halaqa_id", monthlyHalaqaFilter);

      const { data: sessionsInMonth } = await sessionsQuery;

      const sessionIds = (sessionsInMonth || []).map((s) => s.id);
      if (sessionIds.length === 0) {
        setMonthlyReport([]);
        setMonthlyHalaqaReport([]);
        setMonthlySummary(null);
        return;
      }

    const [perfRes, attRes] = await Promise.all([
      supabase.from("excellence_performance").select("*, students:student_id(full_name, halaqa_id, halaqat:halaqa_id(name))").in("session_id", sessionIds),
      supabase.from("excellence_attendance").select("*").in("session_id", sessionIds).eq("is_present", true),
    ]);

    const studentMap: Record<string, { name: string; halaqaName: string; totalScore: number; sessions: number; totalPages: number; totalHizb: number; attended: number }> = {};
    (perfRes.data || []).forEach((p: any) => {
      const sid = p.student_id;
      const sname = p.students?.full_name || "—";
      const hName = p.students?.halaqat?.name || "—";
      if (!studentMap[sid]) studentMap[sid] = { name: sname, halaqaName: hName, totalScore: 0, sessions: 0, totalPages: 0, totalHizb: 0, attended: 0 };
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

    // Summary
    const totalStudents = ranked.length;
    const totalPages = ranked.reduce((sum, s) => sum + s.totalPages, 0);
    const totalHizb = ranked.reduce((sum, s) => sum + s.totalHizb, 0);
    const avgScore = totalStudents > 0 ? ranked.reduce((sum, s) => sum + s.avg, 0) / totalStudents : 0;
    setMonthlySummary({ sessionCount: sessionIds.length, totalStudents, totalPages, totalHizb, avgScore });

    // Halaqa comparison
    const halaqaMap: Record<string, { name: string; students: number; totalAtt: number; totalSessions: number; totalScore: number; count: number }> = {};
    ranked.forEach((s) => {
      const hName = s.halaqaName;
      if (!halaqaMap[hName]) halaqaMap[hName] = { name: hName, students: 0, totalAtt: 0, totalSessions: 0, totalScore: 0, count: 0 };
      halaqaMap[hName].students += 1;
      halaqaMap[hName].totalAtt += s.attended;
      halaqaMap[hName].totalSessions += s.sessions;
      halaqaMap[hName].totalScore += s.avg;
      halaqaMap[hName].count += 1;
    });
    const halaqaList = Object.values(halaqaMap).map((h) => ({
      ...h,
      attendanceRate: h.totalSessions > 0 ? Math.round((h.totalAtt / h.totalSessions) * 100) : 0,
      avgScore: h.count > 0 ? h.totalScore / h.count : 0,
    })).sort((a, b) => b.avgScore - a.avgScore);
    setMonthlyHalaqaReport(halaqaList);
    } finally {
      setMonthlyLoading(false);
    }
  };

  const saveMonthlyReport = async () => {
    const year = parseInt(hijriYear);
    const month = parseInt(hijriMonth);
    for (const s of monthlyReport) {
      await supabase.from("excellence_monthly_report").upsert({
        month, year, student_id: s.id,
        total_attendance: s.attended, total_pages: s.totalPages,
        total_sessions: s.sessions, total_hizb: s.totalHizb,
        average_score: Math.round(s.avg * 100) / 100, final_rank: s.rank,
      }, { onConflict: "month,year,student_id" });
    }
    toast.success("تم حفظ التقرير الشهري");
  };

  const publishMonthlyReport = async () => {
    setPublishingMonthly(true);
    try {
      await saveMonthlyReport();
      const { data: teachers } = await supabase.from("profiles").select("id").in("role", ["teacher", "assistant_teacher"]);
      const teacherIds = (teachers || []).map((t: any) => t.id);
      if (teacherIds.length > 0) {
        const monthName = HIJRI_MONTHS[parseInt(hijriMonth) - 1];
        await sendNotification({
          templateCode: "general",
          recipientIds: teacherIds,
          variables: { title: `تقرير التميز الشهري — ${monthName} ${hijriYear} هـ`, body: `تم نشر تقرير التميز لشهر ${monthName}. يرجى الاطلاع.` },
        });
      }
      toast.success("تم نشر التقرير وإشعار المعلمين");
    } catch (err: any) {
      toast.error("خطأ أثناء النشر: " + err.message);
    } finally {
      setPublishingMonthly(false);
    }
  };

  const exportMonthlyPDF = () => {
    if (!monthlyReport.length) return;
    const monthName = HIJRI_MONTHS[parseInt(hijriMonth) - 1];
    const doc = new jsPDF({ orientation: "landscape", putOnlyUsedFonts: true });
    doc.setFontSize(16);
    doc.text("مجمع حلق جامع حويلان", 280, 15, { align: "right" });
    doc.setFontSize(13);
    doc.text(`تقرير التميز الشهري — ${monthName} ${hijriYear} هـ`, 280, 24, { align: "right" });
    doc.setFontSize(10);
    doc.text(`عدد الجلسات: ${monthlySummary?.sessionCount || 0} | الطلاب: ${monthlySummary?.totalStudents || 0} | متوسط الدرجة: ${(monthlySummary?.avgScore || 0).toFixed(1)}`, 280, 32, { align: "right" });
    const rows = monthlyReport.map((s) => [String(s.rank), s.name, s.halaqaName, String(s.attended), String(s.totalPages), String(s.totalHizb), s.avg.toFixed(1)]);
    autoTable(doc, { startY: 38, head: [["الترتيب", "الطالب", "الحلقة", "الحضور", "الأوجه", "الأحزاب", "متوسط الدرجة"]], body: rows, styles: { halign: "center", fontSize: 9 }, headStyles: { fillColor: [30, 58, 95] } });
    if (monthlyHalaqaReport.length > 0) {
      const halaqaY = (doc as any).lastAutoTable?.finalY + 12 || 120;
      doc.setFontSize(11);
      doc.text("مقارنة الحلقات", 280, halaqaY, { align: "right" });
      autoTable(doc, { startY: halaqaY + 4, head: [["الحلقة", "عدد الطلاب", "نسبة الحضور", "متوسط الدرجات"]], body: monthlyHalaqaReport.map((h: any) => [h.name, String(h.students), `${h.attendanceRate}%`, h.avgScore.toFixed(1)]), styles: { halign: "center", fontSize: 9 }, headStyles: { fillColor: [30, 58, 95] } });
    }
    doc.save(`تقرير_التميز_${monthName}_${hijriYear}.pdf`);
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="session">تقرير الجلسة</TabsTrigger>
          <TabsTrigger value="complex">تقرير المجمع</TabsTrigger>
          <TabsTrigger value="monthly">التقرير الشهري</TabsTrigger>
          <TabsTrigger value="track">تقرير المسار</TabsTrigger>
          <TabsTrigger value="distinguished">الطالب المميز</TabsTrigger>
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
                        {getSessionDisplayName(s)}
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
                  <div className="mb-3 text-sm text-muted-foreground">
                    {sessionReport.session?.session_hijri_date && (
                      <p>التاريخ الهجري: {formatHijriStringArabic(sessionReport.session.session_hijri_date)}</p>
                    )}
                    <p>المسار: {(sessionReport.session as any)?.excellence_tracks?.track_name || (sessionReport.session as any)?.halaqat?.name || "—"}</p>
                  </div>
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
                          <TableCell><StudentNameLink studentId={p.student_id} studentName={(p as any).students?.full_name || "—"} /></TableCell>
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

        {/* Complex Report — all students ranked across entire complex */}
        <TabsContent value="complex">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>تقرير المجمع — ترتيب عام</CardTitle>
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
                    <h3 className="font-bold mb-2">ترتيب جميع الطلاب المميزين على مستوى المجمع</h3>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-center">#</TableHead>
                        <TableHead className="text-right">الطالب</TableHead>
                        <TableHead className="text-center">متوسط الدرجة</TableHead>
                        <TableHead className="text-center">إجمالي الأحزاب</TableHead>
                        <TableHead className="text-center">عدد الجلسات</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {complexReport.topStudents.map((s: any, i: number) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-center font-bold">{i + 1}</TableCell>
                            <TableCell>{s.name}</TableCell>
                            <TableCell className="text-center font-bold">{s.avg.toFixed(1)}</TableCell>
                            <TableCell className="text-center">{s.totalHizb}</TableCell>
                            <TableCell className="text-center">{s.count}</TableCell>
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
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />التقرير الشهري النهائي</CardTitle>
                {monthlyReport.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {isManager && (
                      <Button onClick={publishMonthlyReport} disabled={publishingMonthly}>
                        <Send className="w-4 h-4 ml-1" />{publishingMonthly ? "جارٍ النشر..." : "نشر التقرير"}
                      </Button>
                    )}
                    <Button variant="outline" onClick={exportMonthlyPDF}>
                      <FileText className="w-4 h-4 ml-1" />تصدير PDF
                    </Button>
                    <Button variant="outline" onClick={() => handlePrint("monthly-report-print")}>
                      <Printer className="w-4 h-4 ml-1" />طباعة
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hijri Month/Year Selectors */}
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-sm font-medium mb-1 block">الشهر الهجري</label>
                  <Select value={hijriMonth} onValueChange={setHijriMonth}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HIJRI_MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">السنة الهجرية</label>
                  <Select value={hijriYear} onValueChange={setHijriYear}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => currentHijri.year - 2 + i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y} هـ</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadMonthlyReport} disabled={monthlyLoading}>
                  {monthlyLoading ? "جارٍ التحميل..." : "عرض التقرير"}
                </Button>
              </div>

              {monthlyLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!monthlyLoading && !monthlySummary && monthlyReport.length === 0 && (
                <p className="text-center text-muted-foreground py-8">لا توجد جلسات مسجلة في هذا الشهر</p>
              )}

              {/* KPI Summary Cards */}
              {!monthlyLoading && monthlySummary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{monthlySummary.sessionCount}</p>
                    <p className="text-xs text-muted-foreground">عدد الجلسات</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{monthlySummary.totalStudents}</p>
                    <p className="text-xs text-muted-foreground">الطلاب المشاركون</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{monthlySummary.totalPages}</p>
                    <p className="text-xs text-muted-foreground">إجمالي الأوجه</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{monthlySummary.totalHizb}</p>
                    <p className="text-xs text-muted-foreground">إجمالي الأحزاب</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{monthlySummary.avgScore.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">متوسط الدرجة</p>
                  </CardContent></Card>
                </div>
              )}

              {/* Student Ranking Table */}
              {!monthlyLoading && monthlyReport.length > 0 && (
                <div id="monthly-report-print" className="space-y-6">
                  <div>
                    <h3 className="font-bold text-base mb-2 flex items-center gap-2"><Award className="w-4 h-4" />ترتيب الطلاب — {HIJRI_MONTHS[parseInt(hijriMonth) - 1]} {hijriYear} هـ</h3>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-center">الترتيب</TableHead>
                        <TableHead className="text-right">الطالب</TableHead>
                        <TableHead className="text-right">الحلقة</TableHead>
                        <TableHead className="text-center">أيام الحضور</TableHead>
                        <TableHead className="text-center">الأوجه</TableHead>
                        <TableHead className="text-center">الأحزاب</TableHead>
                        <TableHead className="text-center">متوسط الدرجة</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {monthlyReport.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-center">
                              {s.rank <= 3 ? (
                                <Badge className={s.rank === 1 ? "bg-amber-500" : s.rank === 2 ? "bg-gray-400" : "bg-amber-700"}>{s.rank} 🏆</Badge>
                              ) : (
                                <span className="font-bold text-primary">{s.rank}</span>
                              )}
                            </TableCell>
                            <TableCell><StudentNameLink studentId={s.id} studentName={s.name} /></TableCell>
                            <TableCell className="text-muted-foreground text-sm">{s.halaqaName}</TableCell>
                            <TableCell className="text-center">{s.attended}</TableCell>
                            <TableCell className="text-center">{s.totalPages}</TableCell>
                            <TableCell className="text-center">{s.totalHizb}</TableCell>
                            <TableCell className="text-center font-bold">{s.avg.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Halaqa Comparison Table */}
                  {monthlyHalaqaReport.length > 0 && (
                    <div>
                      <h3 className="font-bold text-base mb-2 flex items-center gap-2"><Users className="w-4 h-4" />مقارنة الحلقات</h3>
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="text-right">الحلقة</TableHead>
                          <TableHead className="text-center">عدد الطلاب</TableHead>
                          <TableHead className="text-center">نسبة الحضور</TableHead>
                          <TableHead className="text-center">متوسط الدرجات</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {monthlyHalaqaReport.map((h: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{h.name}</TableCell>
                              <TableCell className="text-center">{h.students}</TableCell>
                              <TableCell className="text-center">{h.attendanceRate}%</TableCell>
                              <TableCell className="text-center font-bold">{h.avgScore.toFixed(1)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
              {!monthlySummary && monthlyReport.length === 0 && (
                <p className="text-center text-muted-foreground py-8">اختر الشهر والسنة الهجرية ثم اضغط «عرض التقرير»</p>
              )}
              {monthlySummary && monthlyReport.length === 0 && (
                <p className="text-center text-muted-foreground py-4">لا توجد بيانات لهذا الشهر</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Track Report */}
        <TabsContent value="track">
          <Card>
            <CardHeader><CardTitle>تقرير المسار</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                  <SelectContent>
                    {excellenceTracks.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={async () => {
                  if (!selectedTrackId) return;
                  const { data: distStudents } = await supabase
                    .from("distinguished_students")
                    .select("student_id, date_added, students:student_id(full_name)")
                    .eq("track_id", selectedTrackId);

                  const studentIds = (distStudents || []).map((d: any) => d.student_id);
                  let perfData: any[] = [];
                  if (studentIds.length > 0) {
                    const { data } = await supabase
                      .from("excellence_performance")
                      .select("student_id, total_score, hizb_count, pages_displayed")
                      .in("student_id", studentIds);
                    perfData = data || [];
                  }

                  const studentMap: Record<string, { name: string; totalScore: number; count: number; totalHizb: number }> = {};
                  (distStudents || []).forEach((d: any) => {
                    studentMap[d.student_id] = { name: d.students?.full_name || "—", totalScore: 0, count: 0, totalHizb: 0 };
                  });
                  perfData.forEach((p: any) => {
                    if (studentMap[p.student_id]) {
                      studentMap[p.student_id].totalScore += Number(p.total_score);
                      studentMap[p.student_id].totalHizb += Number(p.hizb_count);
                      studentMap[p.student_id].count += 1;
                    }
                  });

                  const ranked = Object.entries(studentMap)
                    .map(([id, s]) => ({ id, ...s, avg: s.count > 0 ? s.totalScore / s.count : 0 }))
                    .sort((a, b) => b.avg - a.avg);

                  setTrackReport({
                    totalStudents: studentIds.length,
                    avgPerformance: ranked.length > 0 ? ranked.reduce((s, r) => s + r.avg, 0) / ranked.length : 0,
                    students: ranked,
                  });
                }}>عرض</Button>
              </div>
              {trackReport && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{trackReport.totalStudents}</p><p className="text-xs text-muted-foreground">عدد الطلاب</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{trackReport.avgPerformance.toFixed(1)}</p><p className="text-xs text-muted-foreground">متوسط الأداء</p></CardContent></Card>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-center">#</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-center">متوسط الدرجة</TableHead>
                      <TableHead className="text-center">إجمالي الأحزاب</TableHead>
                      <TableHead className="text-center">عدد الجلسات</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {trackReport.students.map((s: any, i: number) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-center">{i + 1}</TableCell>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="text-center font-bold">{s.avg.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{s.totalHizb}</TableCell>
                          <TableCell className="text-center">{s.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distinguished Student Report */}
        <TabsContent value="distinguished">
          <Card>
            <CardHeader><CardTitle>تقرير الطالب المميز</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedDistStudentId} onValueChange={setSelectedDistStudentId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                  <SelectContent>
                    {distinguishedStudents.map((d: any) => (
                      <SelectItem key={d.id} value={d.student_id}>
                        {d.student_name} — {d.track_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={async () => {
                  if (!selectedDistStudentId) return;
                  const distInfo = distinguishedStudents.find((d: any) => d.student_id === selectedDistStudentId);
                  const { data: perfData } = await supabase
                    .from("excellence_performance")
                    .select("total_score, hizb_count, pages_displayed, session_id, excellence_sessions:session_id(session_date, session_hijri_date)")
                    .eq("student_id", selectedDistStudentId)
                    .order("created_at", { ascending: false });

                  const sessionsList = (perfData || []).map((p: any) => ({
                    date: p.excellence_sessions?.session_date || "—",
                    hijriDate: p.excellence_sessions?.session_hijri_date || null,
                    score: Number(p.total_score),
                    hizb: Number(p.hizb_count),
                    pages: Number(p.pages_displayed),
                  }));

                  const totalSessions = sessionsList.length;
                  const avgScore = totalSessions > 0 ? sessionsList.reduce((s: number, r: any) => s + r.score, 0) / totalSessions : 0;
                  const totalHizb = sessionsList.reduce((s: number, r: any) => s + r.hizb, 0);

                  setDistStudentReport({
                    studentName: distInfo?.student_name || "—",
                    trackName: distInfo?.track_name || "—",
                    dateAdded: distInfo?.date_added || "—",
                    totalSessions,
                    avgScore,
                    totalHizb,
                    sessions: sessionsList,
                  });
                }}>عرض</Button>
              </div>
              {distStudentReport && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span className="font-bold">{distStudentReport.studentName}</span>
                    <Badge variant="outline">{distStudentReport.trackName}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{distStudentReport.totalSessions}</p><p className="text-xs text-muted-foreground">عدد الجلسات</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{distStudentReport.avgScore.toFixed(1)}</p><p className="text-xs text-muted-foreground">متوسط الدرجة</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{distStudentReport.totalHizb}</p><p className="text-xs text-muted-foreground">إجمالي الأحزاب</p></CardContent></Card>
                  </div>
                  {distStudentReport.sessions.length > 0 && (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-center">التاريخ</TableHead>
                        <TableHead className="text-center">الدرجة</TableHead>
                        <TableHead className="text-center">الأحزاب</TableHead>
                        <TableHead className="text-center">الأوجه</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {distStudentReport.sessions.map((s: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-center">{s.hijriDate ? formatHijriArabic(s.hijriDate) : formatDateHijriOnly(s.date)}</TableCell>
                            <TableCell className="text-center font-bold">{s.score.toFixed(1)}</TableCell>
                            <TableCell className="text-center">{s.hizb}</TableCell>
                            <TableCell className="text-center">{s.pages}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
