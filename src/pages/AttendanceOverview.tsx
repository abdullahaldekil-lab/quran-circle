import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { formatDateTimeSmart, formatDateSmart } from "@/lib/hijri";

const STATUS_AR: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "مستأذن", late_excused: "متأخر بعذر" };

const AttendanceOverview = () => {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [halaqaId, setHalaqaId] = useState("all");
  const [staffId, setStaffId] = useState("all");
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<Map<string, any>>(new Map());
  const [tracks, setTracks] = useState<Map<string, string>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("halaqat").select("id, name, teacher_id, talqeen_curriculum_id").eq("active", true).order("name").then(async ({ data }) => {
      setHalaqat(data || []);
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("attendance").select("id, student_id, halaqa_id, attendance_date, status, marked_at, created_at, marked_by").gte("attendance_date", from).lte("attendance_date", to).limit(5000);
      if (halaqaId !== "all") q = q.eq("halaqa_id", halaqaId);
      const { data } = await q;
      const list = data || [];
      const sIds = [...new Set(list.map((r) => r.student_id))];
      const pIds = [...new Set([...list.map((r) => r.marked_by), ...halaqat.map((h) => h.teacher_id)].filter(Boolean))] as string[];
      const [st, pr, en] = await Promise.all([
        sIds.length ? supabase.from("students").select("id, full_name, status").in("id", sIds) : Promise.resolve({ data: [] as any[] }),
        pIds.length ? supabase.from("profiles").select("id, full_name").in("id", pIds) : Promise.resolve({ data: [] as any[] }),
        sIds.length ? supabase.from("madarij_enrollments").select("student_id, madarij_tracks!madarij_enrollments_track_id_fkey(name)").in("student_id", sIds).eq("status", "active") : Promise.resolve({ data: [] as any[] }),
      ]);
      setStudents(new Map((st.data || []).map((s: any) => [s.id, s])));
      setProfiles(new Map((pr.data || []).map((p: any) => [p.id, p.full_name])));
      setTracks(new Map((en.data || []).map((e: any) => [e.student_id, e.madarij_tracks?.name || "مدارج"])));
      setRows(list);
      setLoading(false);
    })();
  }, [from, to, halaqaId, halaqat]);

  const staffOptions = useMemo(() => [...new Set(rows.map((r) => r.marked_by).filter(Boolean))] as string[], [rows]);

  const groups = useMemo(() => {
    const filtered = staffId === "all" ? rows : rows.filter((r) => r.marked_by === staffId);
    const byH = new Map<string, any[]>();
    filtered.forEach((r) => { if (!byH.has(r.halaqa_id)) byH.set(r.halaqa_id, []); byH.get(r.halaqa_id)!.push(r); });
    return [...byH.entries()].map(([hid, list]) => {
      const h = halaqat.find((x) => x.id === hid);
      const markers = [...new Set(list.map((r) => r.marked_by).filter(Boolean))].map((id) => profiles.get(id as string) || "موظف");
      const last = list.reduce((m, r) => ((r.marked_at || r.created_at) > m ? (r.marked_at || r.created_at) : m), "");
      const c = (s: string) => list.filter((r) => r.status === s).length;
      return { hid, h, list, markers, last, present: c("present"), absent: c("absent"), late: c("late") + c("late_excused"), excused: c("excused") };
    }).sort((a, b) => (a.h?.name || "").localeCompare(b.h?.name || "", "ar"));
  }, [rows, staffId, halaqat, profiles]);

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-4" dir="rtl">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />حضور الطلاب حسب الحلقة والموظف</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1"><Label>الحلقة</Label>
            <Select value={halaqaId} onValueChange={setHalaqaId}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">جميع الحلقات</SelectItem>{halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>الموظف المسجِّل</Label>
            <Select value={staffId} onValueChange={setStaffId}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">الجميع</SelectItem>{staffOptions.map((id) => <SelectItem key={id} value={id}>{profiles.get(id) || "موظف"}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardContent>
      </Card>

      {loading ? <p className="text-center text-sm text-muted-foreground">جارٍ التحميل...</p> : groups.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">لا يوجد حضور مسجل في الفترة المحددة</CardContent></Card>
      ) : groups.map((g) => (
        <Card key={g.hid}>
          <button className="w-full text-right p-4 flex flex-wrap items-center justify-between gap-2" onClick={() => setOpen(open === g.hid ? null : g.hid)} aria-expanded={open === g.hid}>
            <div>
              <p className="font-bold">{g.h?.name || "حلقة"}</p>
              <p className="text-xs text-muted-foreground">المعلم: {profiles.get(g.h?.teacher_id) || "—"} · سجّل الحضور: {g.markers.length ? g.markers.join("، ") : "غير معروف (سجلات قديمة)"}{g.last ? ` · آخر تسجيل ${formatDateTimeSmart(g.last)}` : ""}</p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Badge>حاضر {g.present}</Badge><Badge variant="destructive">غائب {g.absent}</Badge>
              <Badge variant="secondary">متأخر {g.late}</Badge><Badge variant="outline">مستأذن {g.excused}</Badge>
              {open === g.hid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {open === g.hid && (
            <CardContent className="overflow-x-auto pt-0">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground"><th className="p-1 text-right">الطالب</th><th className="p-1 text-right">التاريخ</th><th className="p-1">الحالة</th><th className="p-1 text-right">المسار</th><th className="p-1 text-right">سجّله</th><th className="p-1"></th></tr></thead>
                <tbody>
                  {g.list.sort((a, b) => (students.get(a.student_id)?.full_name || "").localeCompare(students.get(b.student_id)?.full_name || "", "ar")).map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-1">{students.get(r.student_id)?.full_name || "—"}</td>
                      <td className="p-1">{formatDateSmart(r.attendance_date)}</td>
                      <td className="p-1 text-center">{STATUS_AR[r.status] || r.status}</td>
                      <td className="p-1">{g.h?.talqeen_curriculum_id ? "التلقين" : tracks.get(r.student_id) || "بدون مسار"}</td>
                      <td className="p-1">{r.marked_by ? profiles.get(r.marked_by) || "موظف" : "—"}</td>
                      <td className="p-1"><Link className="text-primary underline" to={`/students/${r.student_id}/track`}>متابعة المسار</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

export default AttendanceOverview;
