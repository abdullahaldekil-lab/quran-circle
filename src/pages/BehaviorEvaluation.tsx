import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { fetchMyHalaqat } from "@/lib/myHalaqat";
import { BEHAVIOR_CATEGORIES } from "@/lib/behavior";

type Student = { id: string; full_name: string };
type Entry = { id: string; student_id: string; eval_date: string; category: string; points: number; note: string | null };

const today = () => new Date().toISOString().slice(0, 10);

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

  useEffect(() => { fetchMyHalaqat(isTeacher).then((l) => { setHalaqat(l); if (l[0]) setHalaqaId((p) => p || l[0].id); }); }, [isTeacher]);

  const load = async () => {
    if (!halaqaId) return;
    const { data: sts } = await supabase.from("students").select("id, full_name").eq("halaqa_id", halaqaId).eq("status", "active").order("full_name");
    setStudents(sts || []);
    const ids = (sts || []).map((s) => s.id);
    if (!ids.length) { setEntries([]); return; }
    const { data } = await supabase.from("student_behavior").select("id, student_id, eval_date, category, points, note").in("student_id", ids).order("eval_date", { ascending: false }).limit(1000);
    setEntries(data || []);
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
    const cat = BEHAVIOR_CATEGORIES.find((c) => c.key === category)!;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("student_behavior").insert({ student_id: studentId, halaqa_id: halaqaId, eval_date: date, category: cat.label, points: cat.points, note: note || null, created_by: u.user?.id });
    setSaving(false);
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    toast.success(`تم تسجيل «${cat.label}» (${cat.points > 0 ? "+" : ""}${cat.points})`);
    setNote("");
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
        <h1 className="text-2xl font-bold text-foreground">تقييم السلوك</h1>
        <p className="text-muted-foreground">سجّل سلوك الطلاب الإيجابي والسلبي، وتابع النقاط التراكمية والترتيب</p>
      </div>

      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-6">
        <div className="md:col-span-1"><Label>الحلقة</Label>
          <Select value={halaqaId} onValueChange={setHalaqaId}><SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>{halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="md:col-span-1"><Label>الطالب</Label>
          <Select value={studentId} onValueChange={setStudentId}><SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
            <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent></Select></div>
        <div className="md:col-span-1"><Label>السلوك</Label>
          <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BEHAVIOR_CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label} ({c.points > 0 ? "+" : ""}{c.points})</SelectItem>)}</SelectContent></Select></div>
        <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>ملاحظة</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" /></div>
        <div className="flex items-end"><Button className="w-full" onClick={add} disabled={saving}>تسجيل</Button></div>
      </CardContent></Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">الترتيب التراكمي لنقاط السلوك</CardTitle></CardHeader>
          <CardContent><Table><TableHeader><TableRow>
            <TableHead className="text-right">المركز</TableHead><TableHead className="text-right">الطالب</TableHead>
            <TableHead className="text-right">إيجابي</TableHead><TableHead className="text-right">سلبي</TableHead><TableHead className="text-right">النقاط</TableHead>
          </TableRow></TableHeader><TableBody>
            {ranking.map((r) => <TableRow key={r.id}>
              <TableCell>{r.rank}</TableCell><TableCell>{r.full_name}</TableCell><TableCell>{r.pos}</TableCell><TableCell>{r.neg}</TableCell>
              <TableCell><Badge variant={r.total < 0 ? "destructive" : "secondary"}>{r.total}</Badge></TableCell>
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
