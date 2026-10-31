import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { riyadhToday, validBehaviorPoints } from "@/lib/guardianReports";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { fetchMyHalaqat } from "@/lib/myHalaqat";
import { BEHAVIOR_CATEGORIES } from "@/lib/behavior";

type Student = { id: string; full_name: string };
type Entry = { id: string; student_id: string; eval_date: string; category: string; points: number; note: string | null };

const today = riyadhToday;

const BehaviorEvaluation = () => {
  const { isTeacher } = useRole();
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [halaqaId, setHalaqaId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState<string>(BEHAVIOR_CATEGORIES[0].key);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [points, setPoints] = useState(String(BEHAVIOR_CATEGORIES[0].points));

  useEffect(() => { fetchMyHalaqat(isTeacher).then((l) => { setHalaqat(l); if (l[0]) setHalaqaId((p) => p || l[0].id); }); }, [isTeacher]);

  const load = async () => {
    if (!halaqaId) return;
    const { data: sts } = await supabase.from("students").select("id, full_name").eq("halaqa_id", halaqaId).eq("status", "active").order("full_name");
    setStudents(sts || []);
    const ids = (sts || []).map((s) => s.id);
    if (!ids.length) { setEntries([]); return; }
    const all: Entry[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await supabase.from("student_behavior").select("id, student_id, eval_date, category, points, note").in("student_id", ids).order("eval_date", { ascending: false }).order("id").range(start, start + 999);
      if (error) { toast.error("تعذر تحميل نقاط السلوك"); return; }
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setEntries(all);
  };
  useEffect(() => { load(); setStudentId(""); }, [halaqaId]);

  const ranking = useMemo(() => {
    const totals = students.map((s) => {
      const e = entries.filter((x) => x.student_id === s.id);
      return { ...s, total: e.reduce((t, x) => t + x.points, 0), pos: e.filter((x) => x.points > 0).length, neg: e.filter((x) => x.points < 0).length };
    }).sort((a, b) => b.total - a.total || a.full_name.localeCompare(b.full_name, "ar"));
    let rank = 0, prev: number | null = null;
    return totals.map((t, i) => { if (t.total !== prev) { rank = i + 1; prev = t.total; } return { ...t, rank }; });
  }, [students, entries]);

  const add = async () => {
    if (!studentId) return toast.error("اختر الطالب");
    const cat = BEHAVIOR_CATEGORIES.find((c) => c.key === category);
    if (!cat || !validBehaviorPoints(points) || !students.some(s => s.id === studentId)) return toast.error("أدخل نقاطًا صحيحة لطالب في حلقتك");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("student_behavior").insert({ student_id: studentId, halaqa_id: halaqaId, eval_date: date, category: cat.label, points: Number(points), note: note || null, created_by: u.user?.id });
    setSaving(false);
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    toast.success(`تم تسجيل «${cat.label}» (${Number(points) > 0 ? "+" : ""}${points})`);
    setNote("");
    setEntryOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("student_behavior").delete().eq("id", id);
    if (error) return toast.error("تعذر الحذف");
    setEntries((e) => e.filter((x) => x.id !== id));
  };

  const name = (id: string) => students.find((s) => s.id === id)?.full_name || "";

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{isTeacher ? "سلوك طلاب حلقتي" : "تقييم السلوك"}</h1>
      </div>

      <div className="max-w-sm"><Label>الحلقة</Label>
          {isTeacher ? <p className="py-2 font-semibold">{halaqat.find(h => h.id === halaqaId)?.name || "لا توجد حلقة مسندة"}</p> : <Select value={halaqaId} onValueChange={setHalaqaId}><SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>{halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select>}</div>
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}><DialogContent dir="rtl"><DialogHeader><DialogTitle>تسجيل نقاط: {name(studentId)}</DialogTitle></DialogHeader>
        <div><Label>الطالب</Label>
          <Select value={studentId} onValueChange={setStudentId}><SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
            <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent></Select></div>
        <div className="md:col-span-1"><Label>السلوك</Label>
          <Select value={category} onValueChange={v => { setCategory(v); const c = BEHAVIOR_CATEGORIES.find(c => c.key === v); if (c) setPoints(String(c.points)); }}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BEHAVIOR_CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label} ({c.points > 0 ? "+" : ""}{c.points})</SelectItem>)}</SelectContent></Select></div>
        <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label htmlFor="behavior-points">النقاط</Label><Input id="behavior-points" type="number" step="1" value={points} onChange={e => setPoints(e.target.value)} /></div>
        <div><Label>ملاحظة</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" /></div>
        <DialogFooter><Button onClick={add} disabled={saving}>{saving ? "جارٍ الحفظ..." : "تسجيل"}</Button></DialogFooter>
      </DialogContent></Dialog>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">الترتيب التراكمي لنقاط السلوك</CardTitle></CardHeader>
          <CardContent><Table><TableHeader><TableRow>
            <TableHead className="text-right">المركز</TableHead><TableHead className="text-right">الطالب</TableHead>
            <TableHead className="text-right">إيجابي</TableHead><TableHead className="text-right">سلبي</TableHead><TableHead className="text-right">النقاط</TableHead>
          </TableRow></TableHeader><TableBody>
            {ranking.map((r) => <TableRow key={r.id}>
              <TableCell>{r.rank}</TableCell><TableCell><Button variant="link" className="px-0" onClick={() => { setStudentId(r.id); setNote(""); setDate(today()); setEntryOpen(true); }}>{r.full_name}<Plus className="w-4 h-4 mr-2" /></Button></TableCell><TableCell>{r.pos}</TableCell><TableCell>{r.neg}</TableCell>
              <TableCell><Button variant="ghost" aria-label={`نقاط ${r.full_name}`} onClick={() => { setStudentId(r.id); setNote(""); setDate(today()); setEntryOpen(true); }}><Badge variant={r.total < 0 ? "destructive" : "secondary"}>{r.total}</Badge></Button></TableCell>
            </TableRow>)}
          </TableBody></Table></CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">آخر التقييمات</CardTitle></CardHeader>
          <CardContent>{entries.length === 0 ? <p className="text-muted-foreground">لا توجد تقييمات بعد.</p> : (
            <Table><TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead><TableHead className="text-right">الطالب</TableHead><TableHead className="text-right">السلوك</TableHead><TableHead className="text-right">النقاط</TableHead><TableHead />
            </TableRow></TableHeader><TableBody>
              {entries.slice(0, 50).map((e) => <TableRow key={e.id}>
                <TableCell>{e.eval_date}</TableCell><TableCell>{name(e.student_id)}</TableCell>
                <TableCell>{e.category}{e.note ? <span className="block text-xs text-muted-foreground">{e.note}</span> : null}</TableCell>
                <TableCell>{e.points > 0 ? "+" : ""}{e.points}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => remove(e.id)} aria-label="حذف"><Trash2 className="w-4 h-4" /></Button></TableCell>
              </TableRow>)}
            </TableBody></Table>)}
          </CardContent></Card>
      </div>
    </div>
  );
};

export default BehaviorEvaluation;
