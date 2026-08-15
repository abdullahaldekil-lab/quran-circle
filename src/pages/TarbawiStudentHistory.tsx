import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, BookOpen, Headphones, GraduationCap, CalendarCheck } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import {
  ATTENDANCE_LABELS, averageCommitment, gradeLabel, scorePercentage, sumAxes,
} from "@/lib/tarbawi";

export default function TarbawiStudentHistory() {
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [halaqaId, setHalaqaId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("halaqat").select("id, name").eq("active", true).order("name")
      .then(({ data }) => { setHalaqat(data || []); setHalaqaId((p) => p || data?.[0]?.id || ""); });
  }, []);

  useEffect(() => {
    if (!halaqaId) return;
    supabase.from("students").select("id, full_name").eq("halaqa_id", halaqaId).eq("status", "active").order("full_name")
      .then(({ data }) => { setStudents(data || []); setStudentId(data?.[0]?.id || ""); });
  }, [halaqaId]);

  const load = useCallback(async () => {
    if (!studentId) return;
    const [recs, sc, v] = await Promise.all([
      (supabase as any).from("tarbawi_weekly_records").select("*").eq("student_id", studentId).order("week_start", { ascending: false }),
      (supabase as any).from("tarbawi_exam_scores").select("*").eq("student_id", studentId),
      (supabase as any).from("program_material_views").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(50),
    ]);
    setRecords(recs.data || []);
    setScores(sc.data || []);
    setViews(v.data || []);

    const examIds = [...new Set((sc.data || []).map((x: any) => x.exam_id))];
    if (examIds.length) {
      const { data } = await (supabase as any).from("tarbawi_exams").select("*").in("id", examIds);
      setExams(data || []);
    } else setExams([]);

    const matIds = [...new Set((v.data || []).map((x: any) => x.material_id).filter(Boolean))];
    if (matIds.length) {
      const { data } = await (supabase as any).from("program_materials").select("id, title, material_type").in("id", matIds);
      setMaterials(data || []);
    } else setMaterials([]);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const totals = sumAxes(records);
  const commitment = averageCommitment(records);
  const filteredStudents = students.filter((s) => s.full_name.includes(search));
  const student = students.find((s) => s.id === studentId);
  const matTitle = (id: string) => materials.find((m) => m.id === id)?.title || "مادة محذوفة";

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-5">
        <History className="w-5 h-5 text-primary" /> السجل التربوي للطالب
      </h1>

      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <Label className="text-xs">الحلقة</Label>
          <Select value={halaqaId} onValueChange={setHalaqaId}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">بحث</Label>
          <Input value={search} placeholder="اسم الطالب" className="h-9 w-40"
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">الطالب</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {filteredStudents.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {student && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <Card className="border-2"><CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> جلسات حضرها</p>
              <p className="font-bold">{totals.attendance}</p>
            </CardContent></Card>
            <Card className="border-2"><CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="w-3 h-3" /> صفحات قرأها</p>
              <p className="font-bold">{totals.reading}</p>
            </CardContent></Card>
            <Card className="border-2"><CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Headphones className="w-3 h-3" /> دقائق السماع</p>
              <p className="font-bold">{totals.listening}</p>
            </CardContent></Card>
            <Card className="border-2"><CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3 h-3" /> الالتزام العام</p>
              <p className="font-bold">{commitment}% — {gradeLabel(commitment)}</p>
            </CardContent></Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">سجل الأسابيع</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {records.map((r) => (
                  <div key={r.id} className="text-xs border-b pb-1">
                    <div className="flex items-center justify-between">
                      <span>{formatDateSmart(r.week_start)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ATTENDANCE_LABELS[r.session_attendance as keyof typeof ATTENDANCE_LABELS] || "—"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      قراءة {r.reading_pages || 0} صفحة · سماع {r.listening_minutes || 0} د · حفظ {r.memorization_amount || "—"}
                    </p>
                  </div>
                ))}
                {records.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد سجل بعد</p>}
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">الاختبارات</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {scores.map((sc) => {
                  const ex = exams.find((e) => e.id === sc.exam_id);
                  const pct = scorePercentage(sc.score, ex?.max_score);
                  return (
                    <div key={sc.id} className="text-xs border-b pb-1 flex items-center justify-between gap-2">
                      <span className="flex-1 truncate">{ex?.title || "اختبار"}</span>
                      <Badge variant="secondary" className="text-[10px]">{sc.score}/{ex?.max_score} — {pct}%</Badge>
                    </div>
                  );
                })}
                {scores.length === 0 && <p className="text-xs text-muted-foreground">لا توجد اختبارات</p>}
              </CardContent>
            </Card>

            <Card className="border-2 sm:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">المواد الإثرائية (الكتب والمسموعات)</CardTitle></CardHeader>
              <CardContent className="space-y-1 max-h-64 overflow-y-auto">
                {views.map((v) => (
                  <div key={v.id} className="text-xs border-b pb-1 flex items-center justify-between gap-2">
                    <span className="flex-1 truncate">{matTitle(v.material_id)}</span>
                    <span className="text-muted-foreground">{formatDateSmart(String(v.created_at).split("T")[0])}</span>
                    <Badge variant="outline" className="text-[10px]">{v.event_type}</Badge>
                  </div>
                ))}
                {views.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد تفاعل مع المواد بعد</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
