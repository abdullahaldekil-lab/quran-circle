import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { fetchMyHalaqat, currentSchoolWeek } from "@/lib/myHalaqat";
import { openWhatsapp, normalizeWhatsappNumber } from "@/lib/whatsapp";

type Row = { id: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; absent: number; late: number; present: number; recCount: number; recAvg: number | null; behavior: number };

const GuardianWeeklyReport = () => {
  const { isTeacher } = useRole();
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [halaqaId, setHalaqaId] = useState("");
  const week = currentSchoolWeek();
  const [from, setFrom] = useState(week.from);
  const [to, setTo] = useState(week.to);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const sentKey = `weekly-wa-sent:${halaqaId}:${from}:${to}`;
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [onlyAbsent, setOnlyAbsent] = useState(false);

  useEffect(() => { try { setSent(JSON.parse(localStorage.getItem(sentKey) || "{}")); } catch { setSent({}); } }, [sentKey]);
  const markSent = (id: string) => setSent((s) => { const n = { ...s, [id]: true }; localStorage.setItem(sentKey, JSON.stringify(n)); return n; });

  useEffect(() => { fetchMyHalaqat(isTeacher).then((l) => { setHalaqat(l); if (l[0]) setHalaqaId((p) => p || l[0].id); }); }, [isTeacher]);

  useEffect(() => {
    if (!halaqaId) return;
    setLoading(true);
    (async () => {
      const { data: sts } = await supabase.from("students").select("id, full_name, guardian_name, guardian_phone").eq("halaqa_id", halaqaId).eq("status", "active").order("full_name");
      const ids = (sts || []).map((s) => s.id);
      const [{ data: att }, { data: rec }, { data: beh }] = await Promise.all([
        ids.length ? supabase.from("attendance").select("student_id, status").in("student_id", ids).gte("attendance_date", from).lte("attendance_date", to) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("recitation_records").select("student_id, total_score").in("student_id", ids).gte("record_date", from).lte("record_date", to) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("student_behavior").select("student_id, points").in("student_id", ids).gte("eval_date", from).lte("eval_date", to) : Promise.resolve({ data: [] as any[] }),
      ]);
      setRows((sts || []).map((s) => {
        const a = (att || []).filter((x: any) => x.student_id === s.id);
        const r = (rec || []).filter((x: any) => x.student_id === s.id && x.total_score != null);
        return {
          ...s,
          absent: a.filter((x: any) => x.status === "absent").length,
          late: a.filter((x: any) => x.status === "late" || x.status === "late_excused").length,
          present: a.filter((x: any) => x.status === "present").length,
          recCount: r.length,
          recAvg: r.length ? Math.round(r.reduce((t: number, x: any) => t + Number(x.total_score), 0) / r.length) : null,
          behavior: (beh || []).filter((x: any) => x.student_id === s.id).reduce((t: number, x: any) => t + x.points, 0),
        };
      }));
      setLoading(false);
    })();
  }, [halaqaId, from, to]);

  const halaqaName = halaqat.find((h) => h.id === halaqaId)?.name || "";
  const buildMsg = (r: Row) =>
    `السلام عليكم ${r.guardian_name || "ولي الأمر"}\nالتقرير الأسبوعي للطالب: ${r.full_name} — ${halaqaName}\nالفترة: ${from} إلى ${to}\n\n` +
    `الحضور: ${r.present} يوم\nالغياب: ${r.absent} يوم\nالتأخر: ${r.late} مرة\n` +
    `التسميع: ${r.recCount} مرة${r.recAvg != null ? ` — متوسط الدرجة ${r.recAvg}` : ""}\n` +
    `نقاط السلوك: ${r.behavior > 0 ? "+" : ""}${r.behavior}\n\n` +
    (r.absent > 0 ? "نأمل متابعة انتظام الطالب في الحضور.\n" : "شكرًا لمتابعتكم، نسأل الله له التوفيق.\n");

  const shown = useMemo(() => rows.filter((r) => !onlyAbsent || r.absent > 0), [rows, onlyAbsent]);
  const absentQueue = useMemo(() => rows.filter((r) => r.absent > 0 && !sent[r.id] && normalizeWhatsappNumber(r.guardian_phone)), [rows, sent]);
  const sendOne = (r: Row) => { if (openWhatsapp(r.guardian_phone, buildMsg(r))) markSent(r.id); else toast.error("رقم ولي الأمر غير صالح"); };
  const sendNextAbsent = () => {
    const next = absentQueue[0];
    if (!next) return toast.info("تم الإرسال لجميع الغائبين");
    sendOne(next);
    toast.success(`فُتحت رسالة ${next.full_name} — متبقٍ ${absentQueue.length - 1}`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإشعارات الأسبوعية لأولياء الأمور</h1>
        <p className="text-muted-foreground">ملخص الغياب ونتائج التسميع لكل طالب، مع فتح واتساب مباشرة</p>
      </div>
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-4">
        <div><Label>الحلقة</Label>
          <Select value={halaqaId} onValueChange={setHalaqaId}><SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>{halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end"><Button variant={onlyAbsent ? "default" : "outline"} className="w-full" onClick={() => setOnlyAbsent((v) => !v)}>{onlyAbsent ? "عرض الجميع" : "الغائبون فقط"}</Button></div>
      </CardContent></Card>

      {loading ? <p className="text-muted-foreground">جارٍ التحميل...</p> : shown.length === 0 ? <p className="text-muted-foreground">لا يوجد طلاب.</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((r) => {
            const valid = !!normalizeWhatsappNumber(r.guardian_phone);
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{r.full_name}</CardTitle>
                  <div className="flex gap-1">
                    {r.absent > 0 && <Badge variant="destructive">غياب {r.absent}</Badge>}
                    {sent[r.id] && <Badge variant="secondary"><CheckCircle2 className="w-3 h-3 ml-1" />فُتحت</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <pre className="whitespace-pre-wrap text-sm bg-muted rounded-md p-3 font-sans">{buildMsg(r)}</pre>
                  <Button className="w-full" disabled={!valid} onClick={() => { if (openWhatsapp(r.guardian_phone, buildMsg(r))) setSent((s) => ({ ...s, [r.id]: true })); else toast.error("رقم ولي الأمر غير صالح"); }}>
                    <MessageCircle className="w-4 h-4 ml-2" />{valid ? "فتح واتساب" : "لا يوجد رقم صالح لولي الأمر"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GuardianWeeklyReport;
