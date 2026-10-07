import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, CalendarDays, ChevronRight, ChevronLeft, Mic, Printer } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import { weekRange, summarizeWeek, rankByTotal, type WeekSummary } from "@/lib/weeklyResults";
import { paceLabel } from "@/lib/madarij-pace";

const STATUS_AR: Record<string, string> = {
  present: "حاضر", absent: "غائب", late: "متأخر", excused: "مستأذن", late_excused: "متأخر بعذر",
};
const STATUS_CLS: Record<string, string> = {
  present: "bg-primary/15 text-primary", absent: "bg-destructive/15 text-destructive",
  late: "bg-accent text-accent-foreground", excused: "bg-muted text-muted-foreground", late_excused: "bg-accent text-accent-foreground",
};

interface Props { studentId: string; showPrint?: boolean }

const StudentTrackView = ({ studentId, showPrint = true }: Props) => {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [isTalqeen, setIsTalqeen] = useState(false);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [recitations, setRecitations] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [tSessions, setTSessions] = useState<any[]>([]);
  const [tAtt, setTAtt] = useState<any[]>([]);
  const [peers, setPeers] = useState<{ id: string; full_name: string }[]>([]);
  const [peerData, setPeerData] = useState<{ att: any[]; rec: any[]; hw: any[] }>({ att: [], rec: [], hw: [] });
  const [offset, setOffset] = useState(0);
  const [month, setMonth] = useState(() => new Date());

  const week = useMemo(() => weekRange(new Date(), offset), [offset]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from("students").select("id, full_name, halaqa_id, halaqat(name, talqeen_curriculum_id)").eq("id", studentId).maybeSingle();
      if (!alive) return;
      setStudent(s);
      const talqeen = !!(s as any)?.halaqat?.talqeen_curriculum_id;
      setIsTalqeen(talqeen);
      const since = new Date(Date.now() - 120 * 86400000).toISOString().split("T")[0];
      const [en, rec, att] = await Promise.all([
        supabase.from("madarij_enrollments").select("*, madarij_tracks!madarij_enrollments_track_id_fkey(name)").eq("student_id", studentId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("recitation_records").select("*").eq("student_id", studentId).gte("record_date", since).order("record_date", { ascending: false }).limit(200),
        supabase.from("attendance").select("attendance_date, status, halaqa_id").eq("student_id", studentId).gte("attendance_date", since).order("attendance_date", { ascending: false }),
      ]);
      if (!alive) return;
      setEnrollment(en.data);
      setRecitations(rec.data || []);
      setAttendance(att.data || []);
      if (en.data?.id) {
        const { data: ex } = await supabase.from("madarij_hizb_exams").select("id, pass_date, final_grade, passed, attempt_number, exam_type, created_at").eq("enrollment_id", en.data.id).order("created_at", { ascending: false }).limit(10);
        if (alive) setExams(ex || []);
      }
      if (talqeen && s?.halaqa_id) {
        const { data: sess } = await supabase.from("talqeen_sessions").select("id, session_date, surah, from_ayah, to_ayah, homework, executed").eq("halaqa_id", s.halaqa_id).gte("session_date", since).order("session_date", { ascending: false }).limit(100);
        const ids = (sess || []).map((x) => x.id);
        const { data: ta } = ids.length ? await supabase.from("talqeen_session_attendance").select("session_id, status, homework_status").eq("student_id", studentId).in("session_id", ids) : { data: [] as any[] };
        if (alive) { setTSessions(sess || []); setTAtt(ta || []); }
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [studentId]);

  // Peers for ranking inside the halaqa for the selected week
  useEffect(() => {
    if (!student?.halaqa_id) return;
    (async () => {
      const { data: ps } = await supabase.from("students").select("id, full_name").eq("halaqa_id", student.halaqa_id).eq("status", "active");
      const ids = (ps || []).map((p) => p.id);
      if (!ids.length) return;
      const [att, rec] = await Promise.all([
        supabase.from("attendance").select("student_id, status").in("student_id", ids).gte("attendance_date", week.from).lte("attendance_date", week.to),
        supabase.from("recitation_records").select("student_id, total_score").in("student_id", ids).gte("record_date", week.from).lte("record_date", week.to),
      ]);
      let hw: any[] = [];
      if (isTalqeen) {
        const { data: sess } = await supabase.from("talqeen_sessions").select("id").eq("halaqa_id", student.halaqa_id).gte("session_date", week.from).lte("session_date", week.to);
        const sids = (sess || []).map((x) => x.id);
        if (sids.length) hw = (await supabase.from("talqeen_session_attendance").select("student_id, status, homework_status").in("session_id", sids)).data || [];
      }
      setPeers(ps || []);
      setPeerData({ att: att.data || [], rec: rec.data || [], hw });
    })();
  }, [student?.halaqa_id, week.from, week.to, isTalqeen]);

  const ranking = useMemo(() => {
    const rows = peers.map((p) => {
      const att = isTalqeen ? peerData.hw.filter((h) => h.student_id === p.id) : peerData.att.filter((a) => a.student_id === p.id);
      return {
        id: p.id, name: p.full_name,
        ...summarizeWeek({
          attendance: att,
          recitations: peerData.rec.filter((r) => r.student_id === p.id),
          homework: isTalqeen ? peerData.hw.filter((h) => h.student_id === p.id) : [],
        }),
      };
    });
    return rankByTotal(rows);
  }, [peers, peerData, isTalqeen]);

  const mine: (WeekSummary & { rank: number }) | undefined = ranking.find((r) => r.id === studentId);

  const monthDays = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth();
    const n = new Date(y, m + 1, 0).getDate();
    const map = new Map<string, string>();
    attendance.forEach((a) => map.set(a.attendance_date, a.status));
    if (isTalqeen) tSessions.forEach((s) => { const t = tAtt.find((x) => x.session_id === s.id); if (t) map.set(s.session_date, t.status); });
    return Array.from({ length: n }, (_, i) => {
      const d = `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return { d, day: i + 1, status: map.get(d) };
    });
  }, [month, attendance, tSessions, tAtt, isTalqeen]);

  if (loading) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</CardContent></Card>;
  if (!student) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">لم يتم العثور على الطالب</CardContent></Card>;

  return (
    <div className="space-y-4 print-area" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{student.full_name}</h2>
          <p className="text-xs text-muted-foreground">{student.halaqat?.name || "بدون حلقة"} — {isTalqeen ? "مسار التلقين" : "مسار مدارج"}</p>
        </div>
        {showPrint && <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}><Printer className="w-4 h-4 ml-1" />طباعة</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" />متابعة مدارج</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {enrollment ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">المسار: </span>{enrollment.madarij_tracks?.name || "—"}</div>
                  <div><span className="text-muted-foreground">الوتيرة: </span>{paceLabel(enrollment.daily_pace)}</div>
                  <div><span className="text-muted-foreground">الجزء: </span>{enrollment.part_number ?? "—"}</div>
                  <div><span className="text-muted-foreground">الحزب: </span>{enrollment.hizb_number ?? "—"}</div>
                </div>
                <p className="font-medium pt-2">آخر اختبارات الأحزاب</p>
                {exams.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد اختبارات بعد</p> : exams.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                    <span>{formatDateSmart(e.pass_date || e.created_at)} — محاولة {e.attempt_number ?? 1}</span>
                    <span className="flex items-center gap-2">{e.final_grade ?? "—"}<Badge variant={e.passed ? "default" : "destructive"}>{e.passed ? "ناجح" : "لم يجتز"}</Badge></span>
                  </div>
                ))}
              </>
            ) : <p className="text-xs text-muted-foreground">الطالب غير مسجل في مدارج حاليًا</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />مسار التلقين</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!isTalqeen ? <p className="text-xs text-muted-foreground">الطالب ليس في حلقة تلقين</p> : tSessions.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد دروس مسجلة</p> : (
              <>
                <div><span className="text-muted-foreground">الدرس الحالي: </span>{tSessions[0].surah} {tSessions[0].from_ayah ? `(${tSessions[0].from_ayah}-${tSessions[0].to_ayah})` : ""}</div>
                <div className="flex gap-3 text-xs">
                  <span>واجبات منفذة: <b>{tAtt.filter((t) => t.homework_status === "submitted").length}</b></span>
                  <span>غير منفذة: <b>{tAtt.filter((t) => t.homework_status === "not_submitted").length}</b></span>
                </div>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {tSessions.slice(0, 10).map((s) => {
                    const t = tAtt.find((x) => x.session_id === s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                        <span>{formatDateSmart(s.session_date)} — {s.surah}</span>
                        <span className="flex gap-1">
                          {t && <Badge variant="outline" className={STATUS_CLS[t.status]}>{STATUS_AR[t.status] || t.status}</Badge>}
                          {t?.homework_status && <Badge variant={t.homework_status === "submitted" ? "default" : "outline"}>{t.homework_status === "submitted" ? "أنجز الواجب" : "لم ينجز"}</Badge>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">النتائج الأسبوعية</CardTitle>
            <div className="flex items-center gap-1 print:hidden">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOffset((o) => o - 1)} aria-label="الأسبوع السابق"><ChevronRight className="w-4 h-4" /></Button>
              <span className="text-xs">{formatDateSmart(week.from)} – {formatDateSmart(week.to)}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} aria-label="الأسبوع التالي"><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mine ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
              {[
                ["الحضور", `${mine.attendancePct}%`], ["متوسط التسميع", mine.recitationAvg || "—"],
                ["الواجبات", isTalqeen ? `${mine.homeworkPct}%` : "—"], ["المجموع", mine.total],
                ["المركز", `${mine.rank} من ${ranking.length}`],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">{l}</p><p className="font-bold text-lg">{v}</p></div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground text-center">لا توجد بيانات لهذا الأسبوع</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Mic className="w-4 h-4 text-primary" />تفاصيل التسميع</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {recitations.length === 0 ? <p className="text-xs text-muted-foreground text-center py-3">لا توجد سجلات تسميع</p> : (
            <table className="w-full text-xs">
              <thead><tr className="text-muted-foreground border-b"><th className="p-1 text-right">التاريخ</th><th className="p-1 text-right">الحفظ</th><th className="p-1 text-right">المراجعة</th><th className="p-1">الدرجة</th><th className="p-1">جلي</th><th className="p-1">خفي</th><th className="p-1">تردد</th><th className="p-1">نسيان</th><th className="p-1 text-right">ملاحظات</th></tr></thead>
              <tbody>
                {recitations.slice(0, 30).map((r) => {
                  const m = r.mistakes_breakdown?.memorization || r.mistakes_breakdown || {};
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-1">{formatDateSmart(r.record_date)}</td>
                      <td className="p-1">{r.memorized_from ? `${r.memorized_from} ← ${r.memorized_to || ""}` : "—"}</td>
                      <td className="p-1">{r.review_from ? `${r.review_from} ← ${r.review_to || ""}` : "—"}</td>
                      <td className="p-1 text-center font-bold">{r.total_score ?? "—"}</td>
                      <td className="p-1 text-center">{m.jali ?? 0}</td><td className="p-1 text-center">{m.khafi ?? 0}</td>
                      <td className="p-1 text-center">{m.taraddod ?? 0}</td><td className="p-1 text-center">{m.nisyan ?? 0}</td>
                      <td className="p-1">{r.notes || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />تفاصيل الحضور</CardTitle>
            <div className="flex items-center gap-1 print:hidden">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="الشهر السابق"><ChevronRight className="w-4 h-4" /></Button>
              <span className="text-xs">{month.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { month: "long", year: "numeric" })}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="الشهر التالي"><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d) => (
              <div key={d.d} title={d.status ? STATUS_AR[d.status] : ""} className={`rounded text-center text-xs py-1.5 border ${d.status ? STATUS_CLS[d.status] : "text-muted-foreground"}`}>{d.day}</div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            {Object.entries(STATUS_AR).slice(0, 4).map(([k, v]) => <span key={k} className={`px-2 py-0.5 rounded ${STATUS_CLS[k]}`}>{v}: {Object.values(monthDays).filter((d) => d.status === k).length}</span>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentTrackView;
