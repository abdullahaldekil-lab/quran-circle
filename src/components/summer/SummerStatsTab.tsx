import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BarChart3, CalendarDays, Download, Users } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  dailyStats,
  perMaqraStats,
  perSourceHalaqaStats,
  perStudentStats,
  programmeStats,
  weeklyStats,
  type StatAttendance,
  type StatHalaqa,
  type StatMaqra,
  type StatRecord,
  type StatStudent,
} from "@/lib/summer-stats";
import type { HolidayRange } from "@/lib/summer-scoring";

interface Props {
  students: StatStudent[];
  records: StatRecord[];
  attendance: StatAttendance[];
  maqare: StatMaqra[];
  halaqat: StatHalaqa[];
  halaqaSizes: Record<string, number>;
  holidays: HolidayRange[];
  studentNames: Record<string, string>;
}

type View = "daily" | "weekly" | "overall";

const VIEWS: { key: View; label: string }[] = [
  { key: "daily", label: "يومي" },
  { key: "weekly", label: "أسبوعي" },
  { key: "overall", label: "البرنامج كامل" },
];

const statusBadge = (status: string) =>
  status === "ahead" ? <Badge className="bg-emerald-600">متقدم</Badge>
    : status === "on_track" ? <Badge variant="secondary">منتظم</Badge>
    : <Badge variant="destructive">متأخر</Badge>;

const SummerStatsTab = ({
  students,
  records,
  attendance,
  maqare,
  halaqat,
  halaqaSizes,
  holidays,
  studentNames,
}: Props) => {
  const [view, setView] = useState<View>("overall");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const perStudent = useMemo(
    () => perStudentStats(students, records, attendance, holidays, today),
    [students, records, attendance, holidays, today],
  );
  const overall = useMemo(() => programmeStats(perStudent), [perStudent]);
  const byMaqra = useMemo(() => perMaqraStats(maqare, perStudent), [maqare, perStudent]);
  const byHalaqa = useMemo(
    () => perSourceHalaqaStats(halaqat, perStudent, halaqaSizes),
    [halaqat, perStudent, halaqaSizes],
  );
  const daily = useMemo(
    () => dailyStats(students, records, attendance, date),
    [students, records, attendance, date],
  );
  const weekly = useMemo(
    () => weeklyStats(records, attendance, today, 6, holidays),
    [records, attendance, today, holidays],
  );

  const nameOf = (s: StatStudent) => studentNames[s.student_id || ""] || "—";

  const rankedStudents = useMemo(() => {
    const term = search.trim();
    const rows = term
      ? perStudent.filter((r) => nameOf(r.student).includes(term))
      : perStudent;
    return [...rows].sort((a, b) => b.progressPct - a.progressPct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perStudent, search, studentNames]);

  const exportExcel = () => {
    import("xlsx-js-style").then((XLSX) => {
      const rows = rankedStudents.map((r) => ({
        "الطالب": nameOf(r.student),
        "المقرأة": maqare.find((m) => m.id === r.student.maqra_id)?.name || "",
        "المسار": r.student.plan_type === "hifz" ? "حفظ" : "إتقان",
        "الهدف": r.target,
        "المنجَز": r.covered,
        "نسبة الإنجاز %": r.progressPct,
        "أيام الحضور": r.attendedDays,
        "أيام متوقعة": r.expectedDays,
        "نسبة الحضور %": r.attendancePct,
        "متوسط الدرجة": r.avgScore,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      // xlsx-js-style types do not model the RTL sheet view
      (ws as Record<string, unknown>)["!views"] = [{ RTL: true }];
      const range = XLSX.utils.decode_range(ws["!ref"]!);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
          ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F5D3A" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        }
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "إحصائيات البرنامج");
      XLSX.writeFile(wb, `summer-stats-${today}.xlsx`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {VIEWS.map((v) => (
            <Button key={v.key} size="sm" variant={view === v.key ? "default" : "outline"}
              onClick={() => setView(v.key)}>
              {v.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={exportExcel}>
          <Download className="w-4 h-4 ml-1" />تصدير Excel
        </Button>
      </div>

      {view === "daily" && (
        <>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">المسجَّلون اليوم</p><p className="text-2xl font-bold">{daily.recorded} / {daily.enrolled}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">نسبة المشاركة</p><p className="text-2xl font-bold text-primary">{daily.participationPct}%</p><Progress value={daily.participationPct} className="h-1.5 mt-2" /></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">نسبة الحضور</p><p className="text-2xl font-bold text-emerald-600">{daily.attendancePct}%</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">الأوجه المنجزة</p><p className="text-2xl font-bold">{daily.pagesCovered}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">متوسط الدرجة</p><p className="text-2xl font-bold">{daily.avgScore} / 40</p></CardContent></Card>
          </div>
          {daily.recorded === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">لا توجد سجلات في هذا اليوم.</p>
          )}
        </>
      )}

      {view === "weekly" && (
        <Card>
          <CardHeader><CardTitle className="text-base">آخر ٦ أسابيع</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="pagesCovered" name="الأوجه المنجزة" fill="hsl(var(--primary))" />
                  <Line yAxisId="right" type="monotone" dataKey="attendancePct" name="نسبة الحضور %" stroke="#10b981" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="avgScore" name="متوسط الدرجة" stroke="#f59e0b" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-right">الأسبوع</th>
                    <th className="p-2 text-right">أيام العمل</th>
                    <th className="p-2 text-right">سجلات</th>
                    <th className="p-2 text-right">الأوجه</th>
                    <th className="p-2 text-right">متوسط الدرجة</th>
                    <th className="p-2 text-right">نسبة الحضور</th>
                  </tr>
                </thead>
                <tbody>
                  {weekly.map((w) => (
                    <tr key={w.weekStart} className="border-t">
                      <td className="p-2">{w.label}</td>
                      <td className="p-2">{w.workingDays}</td>
                      <td className="p-2">{w.recorded}</td>
                      <td className="p-2">{w.pagesCovered}</td>
                      <td className="p-2">{w.avgScore}</td>
                      <td className="p-2">{w.attendancePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "overall" && (
        <>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">إجمالي الطلاب</p><p className="text-2xl font-bold">{overall.totalStudents}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">طلاب الحفظ</p><p className="text-2xl font-bold text-rose-600">{overall.hifzStudents}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">طلاب الإتقان</p><p className="text-2xl font-bold text-amber-600">{overall.taahudStudents}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">التقدم الكلي</p><p className="text-2xl font-bold text-primary">{overall.progressPct}%</p><Progress value={overall.progressPct} className="h-1.5 mt-2" /><p className="text-xs text-muted-foreground mt-1">{overall.covered} / {overall.target} وجه</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">نسبة الحضور</p><p className="text-2xl font-bold text-emerald-600">{overall.attendancePct}%</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">على المسار</p><p className="text-2xl font-bold">{overall.onTrackPct}%</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />تقدم المقارئ</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-right">المقرأة</th>
                      <th className="p-2 text-right">التصنيف</th>
                      <th className="p-2 text-right">الطلاب</th>
                      <th className="p-2 text-right">الهدف</th>
                      <th className="p-2 text-right">المُنجَز</th>
                      <th className="p-2 text-right">التقدم</th>
                      <th className="p-2 text-right">الحضور</th>
                      <th className="p-2 text-right">على المسار</th>
                      <th className="p-2 text-right">متوسط الأداء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMaqra.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="p-2 font-medium">{m.name}</td>
                        <td className="p-2">
                          {m.category === "hifz" ? <Badge className="bg-rose-600">حفظ</Badge>
                            : m.category === "taahud" ? <Badge className="bg-amber-600">إتقان</Badge>
                            : <Badge variant="secondary">—</Badge>}
                        </td>
                        <td className="p-2">{m.students}</td>
                        <td className="p-2">{m.target}</td>
                        <td className="p-2">{m.covered}</td>
                        <td className="p-2 w-40"><div className="flex items-center gap-2"><Progress value={m.progressPct} className="flex-1 h-1.5" /><span className="text-xs">{m.progressPct}%</span></div></td>
                        <td className="p-2">{m.attendancePct}%</td>
                        <td className="p-2">{m.onTrackPct}%</td>
                        <td className="p-2 font-semibold">{m.avgScore} / 40</td>
                      </tr>
                    ))}
                    {!byMaqra.length && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">لا توجد مقارئ.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />مشاركة الحلقات المصدر</CardTitle>
              <p className="text-xs text-muted-foreground">
                نسبة المشاركة = طلاب الحلقة في البرنامج ÷ إجمالي طلابها النشطين.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-right">الحلقة</th>
                      <th className="p-2 text-right">مشاركون</th>
                      <th className="p-2 text-right">إجمالي الحلقة</th>
                      <th className="p-2 text-right">نسبة المشاركة</th>
                      <th className="p-2 text-right">التقدم</th>
                      <th className="p-2 text-right">الحضور</th>
                      <th className="p-2 text-right">متوسط الأداء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byHalaqa.map((h) => (
                      <tr key={h.id} className="border-t">
                        <td className="p-2 font-medium">{h.name}</td>
                        <td className="p-2">{h.students}</td>
                        <td className="p-2">{h.halaqaSize || "—"}</td>
                        <td className="p-2 w-40"><div className="flex items-center gap-2"><Progress value={h.participationPct} className="flex-1 h-1.5" /><span className="text-xs">{h.participationPct}%</span></div></td>
                        <td className="p-2">{h.progressPct}%</td>
                        <td className="p-2">{h.attendancePct}%</td>
                        <td className="p-2">{h.avgScore} / 40</td>
                      </tr>
                    ))}
                    {!byHalaqa.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">لا توجد بيانات.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>النسب الفردية للطلاب</span>
                <Input placeholder="بحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 h-8 text-sm" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-right">#</th>
                      <th className="p-2 text-right">الطالب</th>
                      <th className="p-2 text-right">المقرأة</th>
                      <th className="p-2 text-right">الهدف</th>
                      <th className="p-2 text-right">المنجَز</th>
                      <th className="p-2 text-right">الإنجاز</th>
                      <th className="p-2 text-right">الحضور</th>
                      <th className="p-2 text-right">متوسط الدرجة</th>
                      <th className="p-2 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedStudents.map((r, i) => (
                      <tr key={r.student.id} className="border-t">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-medium">{nameOf(r.student)}</td>
                        <td className="p-2 text-xs">{maqare.find((m) => m.id === r.student.maqra_id)?.name || "—"}</td>
                        <td className="p-2">{r.target}</td>
                        <td className="p-2">{r.covered}</td>
                        <td className="p-2 w-32"><div className="flex items-center gap-2"><Progress value={r.progressPct} className="flex-1 h-1.5" /><span className="text-xs">{r.progressPct}%</span></div></td>
                        <td className="p-2">{r.attendancePct}%</td>
                        <td className="p-2">{r.avgScore}</td>
                        <td className="p-2">{statusBadge(r.status)}</td>
                      </tr>
                    ))}
                    {!rankedStudents.length && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">لا يوجد طلاب.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SummerStatsTab;
