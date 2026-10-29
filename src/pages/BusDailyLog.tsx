import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LogIn, LogOut, UserX, RotateCcw } from "lucide-react";
import { formatTime12 } from "@/lib/busTime";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const BusDailyLog = () => {
  const [buses, setBuses] = useState<any[]>([]);
  const [busId, setBusId] = useState("");
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<any[]>([]);
  const [logs, setLogs] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { supabase.from("buses").select("id, bus_name").eq("active", true).order("bus_name").then(({ data }) => { setBuses(data || []); if (data?.[0]) setBusId((p) => p || data[0].id); }); }, []);

  const load = async () => {
    if (!busId) return;
    const { data: asg } = await supabase.from("student_bus_assignments").select("student_id, students(full_name)").eq("bus_id", busId).eq("active", true);
    const list = (asg || []).map((a: any) => ({ id: a.student_id, full_name: a.students?.full_name || "—" })).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    setStudents(list);
    const ids = list.map((s) => s.id);
    const { data: lg } = ids.length ? await supabase.from("bus_daily_log").select("*").eq("log_date", date).in("student_id", ids) : { data: [] };
    setLogs(Object.fromEntries((lg || []).map((l: any) => [l.student_id, l])));
  };
  useEffect(() => { load(); }, [busId, date]);

  const save = async (studentId: string, patch: Record<string, any>) => {
    setBusy(studentId);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("bus_daily_log").upsert(
      { student_id: studentId, bus_id: busId, log_date: date, recorded_by: u.user?.id, ...patch },
      { onConflict: "student_id,log_date" },
    );
    setBusy(null);
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    load();
  };
  const now = () => new Date().toISOString();

  const boarded = students.filter((s) => logs[s.id]?.boarded_at).length;
  const alighted = students.filter((s) => logs[s.id]?.alighted_at).length;
  const absent = students.filter((s) => logs[s.id]?.absent).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">سجل صعود ونزول الباصات اليومي</h1>
        <p className="text-muted-foreground">سجّل وقت صعود كل طالب ونزوله من الباص لكل يوم</p>
      </div>
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-2">
        <div><Label>الباص</Label>
          <Select value={busId} onValueChange={setBusId}><SelectTrigger><SelectValue placeholder="اختر الباص" /></SelectTrigger>
            <SelectContent>{buses.map((b) => <SelectItem key={b.id} value={b.id}>{b.bus_name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </CardContent></Card>
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary">المسجلون: {students.length}</Badge>
        <Badge>صعدوا: {boarded}</Badge>
        <Badge variant="outline">نزلوا: {alighted}</Badge>
        <Badge variant="destructive">غائبون: {absent}</Badge>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">طلاب الباص</CardTitle></CardHeader>
        <CardContent>
          {students.length === 0 ? <p className="text-muted-foreground">لا يوجد طلاب مسجلون في هذا الباص.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>الطالب</TableHead><TableHead>الصعود</TableHead><TableHead>النزول</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
              <TableBody>
                {students.map((s) => {
                  const l = logs[s.id];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}{l?.absent && <Badge variant="destructive" className="mr-2">غائب</Badge>}</TableCell>
                      <TableCell>{l?.boarded_at ? formatTime12(l.boarded_at) : "—"}</TableCell>
                      <TableCell>{l?.alighted_at ? formatTime12(l.alighted_at) : "—"}</TableCell>
                      <TableCell className="flex gap-1 flex-wrap">
                        <Button size="sm" disabled={busy === s.id || !!l?.boarded_at} onClick={() => save(s.id, { boarded_at: now(), absent: false })}><LogIn className="w-3 h-3 ml-1" />صعد</Button>
                        <Button size="sm" variant="outline" disabled={busy === s.id || !l?.boarded_at || !!l?.alighted_at} onClick={() => save(s.id, { alighted_at: now() })}><LogOut className="w-3 h-3 ml-1" />نزل</Button>
                        <Button size="sm" variant="ghost" disabled={busy === s.id || l?.absent} onClick={() => save(s.id, { absent: true, boarded_at: null, alighted_at: null })}><UserX className="w-3 h-3 ml-1" />غائب</Button>
                        {l && <Button size="icon" variant="ghost" aria-label="إعادة" disabled={busy === s.id} onClick={() => save(s.id, { absent: false, boarded_at: null, alighted_at: null })}><RotateCcw className="w-3 h-3" /></Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BusDailyLog;
