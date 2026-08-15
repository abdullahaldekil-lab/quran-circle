import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatDateSmart } from "@/lib/hijri";
import { openTarbawiReportPrint } from "@/lib/tarbawi-report-print";
import {
  ATTENDANCE_LABELS, averageCommitment, gradeLabel, recordCommitment,
  scaleAverage, scorePercentage, sumAxes, weekStart,
} from "@/lib/tarbawi";

/** Monthly = last 4 weeks, quarterly = last 13 weeks, both anchored on the current week. */
const PERIODS = { monthly: { label: "شهري", weeks: 4 }, quarterly: { label: "فصلي", weeks: 13 } };

export default function TarbawiReports() {
  const [period, setPeriod] = useState<keyof typeof PERIODS>("monthly");
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [halaqaId, setHalaqaId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [examScores, setExamScores] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const from = useMemo(() => {
    const w = weekStart(new Date());
    const d = new Date(w + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (PERIODS[period].weeks - 1) * 7);
    return d.toISOString().split("T")[0];
  }, [period]);
  const to = useMemo(() => weekStart(new Date()), []);

  useEffect(() => {
    supabase.from("halaqat").select("id, name").eq("active", true).order("name")
      .then(({ data }) => {
        setHalaqat(data || []);
        setHalaqaId((prev) => prev || data?.[0]?.id || "");
      });
  }, []);

  const load = useCallback(async () => {
    if (!halaqaId) return;
    setLoading(true);
    const { data: studs } = await supabase
      .from("students").select("id, full_name").eq("halaqa_id", halaqaId).eq("status", "active").order("full_name");
    setStudents(studs || []);
    const ids = (studs || []).map((s: any) => s.id);

    const { data: recs } = ids.length
      ? await (supabase as any).from("tarbawi_weekly_records").select("*")
          .in("student_id", ids).gte("week_start", from).lte("week_start", to)
      : { data: [] };
    setRecords(recs || []);

    const { data: ex } = await (supabase as any)
      .from("tarbawi_exams").select("id, title, max_score, exam_date")
      .eq("halaqa_id", halaqaId).gte("exam_date", from).lte("exam_date", to);
    setExams(ex || []);
    const examIds = (ex || []).map((e: any) => e.id);
    const { data: sc } = examIds.length
      ? await (supabase as any).from("tarbawi_exam_scores").select("*").in("exam_id", examIds)
      : { data: [] };
    setExamScores(sc || []);
    setLoading(false);
  }, [halaqaId, from, to]);

  useEffect(() => { load(); }, [load]);

  const rows = students.map((s) => {
    const recs = records.filter((r) => r.student_id === s.id);
    const totals = sumAxes(recs);
    const commitment = averageCommitment(recs);
    const scores = examScores.filter((x) => x.student_id === s.id);
    const examAvg = scaleAverage(
      scores.map((x) => scorePercentage(x.score, exams.find((e) => e.id === x.exam_id)?.max_score)),
    );
    const present = recs.filter((r) => r.session_attendance === "present").length;
    const absent = recs.filter((r) => r.session_attendance === "absent").length;
    const excused = recs.filter((r) => r.session_attendance === "excused").length;
    return { s, recs, totals, commitment, examAvg, present, absent, excused };
  });

  const halaqaName = halaqat.find((h) => h.id === halaqaId)?.name || "";

  const exportPdf = () => {
    const ok = openTarbawiReportPrint(
      { periodLabel: PERIODS[period].label, halaqaName, from, to, weeks: PERIODS[period].weeks },
      rows.map(({ s, recs, totals, commitment, examAvg, present, absent, excused }) => ({
        studentName: s.full_name,
        weeks: recs.length,
        present, absent, excused, commitment, examAvg,
        memorization: totals.memorization,
        listening: totals.listening,
        reading: totals.reading,
        notes: recs.filter((r: any) => r.notes).map((r: any) => ({ week: r.week_start, text: r.notes })),
      })),
    );
    if (!ok) toast.error("تعذّر فتح نافذة التصدير — يرجى السماح بالنوافذ المنبثقة");
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl" dir="rtl">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> التقارير التربوية الدورية
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf} aria-label="تصدير التقرير PDF">
            <FileDown className="w-4 h-4 ml-1" /> تصدير PDF
          </Button>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4 ml-1" /> طباعة</Button>
        </div>
      </div>


      <div className="flex flex-wrap gap-3 mb-5 print:hidden">
        <div>
          <Label className="text-xs">الحلقة</Label>
          <Select value={halaqaId} onValueChange={setHalaqaId}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="اختر حلقة" /></SelectTrigger>
            <SelectContent>
              {halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">نوع التقرير</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as keyof typeof PERIODS)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 text-center">
        <h2 className="font-bold">تقرير تربوي {PERIODS[period].label} — {halaqaName}</h2>
        <p className="text-xs text-muted-foreground">
          الفترة: {formatDateSmart(from)} إلى {formatDateSmart(to)} ({PERIODS[period].weeks} أسابيع)
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}

      <div className="space-y-3">
        {rows.map(({ s, recs, totals, commitment, examAvg, present, absent, excused }) => (
          <Card key={s.id} className="border-2 break-inside-avoid">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{s.full_name}</CardTitle>
                <Badge variant={commitment >= 80 ? "default" : "outline"}>
                  الالتزام {commitment}% — {gradeLabel(commitment)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">حضور الجلسات</p>
                  <p className="font-bold">{present} / {recs.length}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ATTENDANCE_LABELS.absent} {absent} · {ATTENDANCE_LABELS.excused} {excused}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">الحفظ</p>
                  <p className="font-bold">{totals.memorization} أسبوع مُنجز</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">السماع</p>
                  <p className="font-bold">{totals.listening} دقيقة</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">القراءة</p>
                  <p className="font-bold">{totals.reading} صفحة</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">متوسط الاختبارات: {examAvg}%</Badge>
                <Badge variant="outline">عدد الأسابيع المُسجَّلة: {recs.length}</Badge>
              </div>
              {recs.some((r) => r.notes) && (
                <div className="mt-2 rounded-lg border p-2 text-xs">
                  <p className="font-medium mb-1">ملاحظات المعلم</p>
                  <ul className="list-disc pr-4 space-y-0.5 text-muted-foreground">
                    {recs.filter((r) => r.notes).map((r) => (
                      <li key={r.id}>{formatDateSmart(r.week_start)}: {r.notes}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">لا يوجد طلاب في الحلقة المختارة</p>
        )}
      </div>
    </div>
  );
}
