import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/hooks/useRole";
import { fetchMyHalaqat, recitationPoints } from "@/lib/myHalaqat";

const HalaqaAttendanceRanking = () => {
  const { isTeacher } = useRole();
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [halaqaId, setHalaqaId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchMyHalaqat(isTeacher).then((l) => { setHalaqat(l); if (l[0]) setHalaqaId((p) => p || l[0].id); }); }, [isTeacher]);

  useEffect(() => {
    if (!halaqaId) return;
    setLoading(true);
    (async () => {
      const { data: sts } = await supabase.from("students").select("id, full_name").eq("halaqa_id", halaqaId).eq("status", "active");
      const ids = (sts || []).map((s) => s.id);
      let aq = supabase.from("attendance").select("student_id, status").in("student_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).is("archived_at", null);
      let rq = supabase.from("recitation_records").select("student_id, total_score").in("student_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).is("archived_at", null);
      if (from) { aq = aq.gte("attendance_date", from); rq = rq.gte("record_date", from); }
      if (to) { aq = aq.lte("attendance_date", to); rq = rq.lte("record_date", to); }
      const [{ data: att }, { data: rec }] = await Promise.all([aq.limit(10000), rq.limit(10000)]);
      const list = (sts || []).map((s) => {
        const a = (att || []).filter((x) => x.student_id === s.id);
        const r = (rec || []).filter((x) => x.student_id === s.id);
        const present = a.filter((x) => x.status === "present").length;
        const late = a.filter((x) => x.status === "late" || x.status === "late_excused").length;
        const absent = a.filter((x) => x.status === "absent").length;
        const excused = a.filter((x) => x.status === "excused").length;
        const days = a.length;
        const rate = days ? Math.round(((present + late) / days) * 100) : 0;
        const points = recitationPoints(r.map((x) => x.total_score));
        return { ...s, present, late, absent, excused, rate, recCount: r.length, points };
      });
      list.sort((x, y) => y.points - x.points || y.rate - x.rate || x.full_name.localeCompare(y.full_name, "ar"));
      let rank = 0, prev: string | null = null;
      list.forEach((r: any, i) => { const k = `${r.points}-${r.rate}`; if (k !== prev) rank = i + 1; prev = k; r.rank = rank; });
      setRows(list);
      setLoading(false);
    })();
  }, [halaqaId, from, to]);

  const totals = useMemo(() => rows.reduce((t, r) => ({ p: t.p + r.present + r.late, a: t.a + r.absent }), { p: 0, a: 0 }), [rows]);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">حضور الحلقة والترتيب التراكمي</h1>
        <p className="text-muted-foreground">حضور وغياب كل طالب مع نقاط التفوق في التسميع والمراكز</p>
      </div>
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-3">
        <div><Label>الحلقة</Label>
          <Select value={halaqaId} onValueChange={setHalaqaId}><SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>{halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>من (اختياري)</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>إلى (اختياري)</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </CardContent></Card>
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary">الطلاب: {rows.length}</Badge>
        <Badge variant="secondary">أيام حضور: {totals.p}</Badge>
        <Badge variant="destructive">أيام غياب: {totals.a}</Badge>
        <span className="text-xs text-muted-foreground self-center">نقاط التفوق = مجموع درجات التسميع؛ الترتيب بالنقاط ثم نسبة الحضور</span>
      </div>
      <Card><CardContent className="pt-4">
        {loading ? <p className="text-muted-foreground">جارٍ التحميل...</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>المركز</TableHead><TableHead>الطالب</TableHead><TableHead>حاضر</TableHead><TableHead>متأخر</TableHead>
              <TableHead>غائب</TableHead><TableHead>مستأذن</TableHead><TableHead>نسبة الحضور</TableHead><TableHead>عدد التسميع</TableHead><TableHead>نقاط التفوق</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.rank <= 3 ? <Badge>{r.rank}</Badge> : r.rank}</TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>{r.present}</TableCell><TableCell>{r.late}</TableCell>
                  <TableCell className={r.absent ? "text-destructive font-semibold" : ""}>{r.absent}</TableCell>
                  <TableCell>{r.excused}</TableCell><TableCell>{r.rate}%</TableCell>
                  <TableCell>{r.recCount}</TableCell><TableCell className="font-bold text-primary">{r.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
};

export default HalaqaAttendanceRanking;
