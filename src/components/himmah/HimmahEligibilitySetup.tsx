import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { savePlan, type Dashboard } from '@/lib/himmah';

type EligibleStudent = { student_id: string; student_name: string; halaqa_id: string; halaqa_name: string; completed: number[]; partial: number[]; eligible: boolean; reason: string | null };
type PlanRow = { on: boolean; hizbs: number[] };
const isMemorization = (h: { name: string; talqeen_curriculum_id: string | null }) => !h.talqeen_curriculum_id && !h.name.includes('تلقين');

export default function HimmahEligibilitySetup({ data, refresh }: { data: Dashboard; refresh: () => void }) {
  const { toast } = useToast();
  const [picked, setPicked] = useState<string[]>(data.day.halaqa_ids || []);
  const [plan, setPlan] = useState<Record<string, PlanRow>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked(data.day.halaqa_ids || []), [data.day.halaqa_ids]);
  const circles = useQuery({ queryKey: ['himmah-circles'], queryFn: async () => { const { data: rows, error } = await supabase.from('halaqat').select('id,name,talqeen_curriculum_id').eq('active', true).order('name'); if (error) throw error; return (rows || []).filter(isMemorization); } });
  const students = useQuery({ queryKey: ['himmah-eligible-students', data.day.id, picked.join(',')], enabled: picked.length > 0, retry: false, queryFn: async () => { const { data: rows, error } = await supabase.rpc('himmah_eligible_students', { _day: data.day.id, _halaqa_ids: picked }); if (error) throw error; return ((rows as unknown as EligibleStudent[]) || []); } });
  const enrolled = useMemo(() => new Map(data.participants.map(p => [p.student_id, p])), [data.participants]);
  useEffect(() => {
    setPlan(prev => {
      const next = { ...prev };
      for (const s of students.data || []) {
        const existing = enrolled.get(s.student_id);
        if (!next[s.student_id] || existing) next[s.student_id] = { on: !!existing, hizbs: existing ? existing.hizbs : (next[s.student_id]?.hizbs || s.completed) };
      }
      return next;
    });
  }, [students.data, enrolled]);
  const toggleStudent = (s: EligibleStudent, on: boolean) => setPlan(p => ({ ...p, [s.student_id]: { on, hizbs: p[s.student_id]?.hizbs?.length ? p[s.student_id].hizbs : s.completed } }));
  const addQualified = () => setPlan(p => ({ ...p, ...Object.fromEntries((students.data || []).filter(s => s.eligible).map(s => [s.student_id, { on: true, hizbs: enrolled.get(s.student_id)?.hizbs || s.completed }])) }));
  async function save() {
    const shown = students.data || [];
    const list = shown.filter(s => plan[s.student_id]?.on && plan[s.student_id].hizbs.length > 0);
    const unchecked = shown.filter(s => !plan[s.student_id]?.on && enrolled.has(s.student_id));
    const leaving = data.participants.filter(p => !picked.includes(p.halaqa_id) || unchecked.some(s => s.student_id === p.student_id));
    if (leaving.length && !window.confirm(`سيُحذف ${leaving.length} مشارك من اليوم مع الاحتفاظ بأي محاولات محفوظة. هل تريد المتابعة؟`)) return;
    setBusy(true);
    try {
      const result = await savePlan(data.day.id, picked, list.map(s => ({ student_id: s.student_id, hizbs: plan[s.student_id].hizbs })), unchecked.map(s => s.student_id));
      refresh(); toast({ title: `تم حفظ ${result.saved} مشارك${result.removed ? ` وحذف ${result.removed}` : ''}` });
    } catch (e) { toast({ title: (e as { message?: string })?.message || 'تعذّر الحفظ؛ لم يُغيَّر شيء', variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label="إعداد اليوم التلقائي">
    <div><h3 className="font-bold">١. حلقات اليوم والطلاب المؤهلون</h3><p className="text-sm text-muted-foreground">تظهر الأحزاب من المحفوظ المثبت فقط؛ مستهدف الخطة ونتيجة السرد لا يضيفان حفظًا.</p></div>
    <div className="flex flex-wrap gap-3">{circles.data?.map(c => <label key={c.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2"><Checkbox aria-label={`حلقة ${c.name}`} checked={picked.includes(c.id)} onCheckedChange={v => setPicked(p => v === true ? [...p, c.id] : p.filter(x => x !== c.id))} />{c.name}</label>)}</div>
    {students.isLoading && <p className="text-sm text-muted-foreground">جارٍ حساب الأحزاب المكتملة لكل طالب…</p>}
    {students.error && <div className="space-y-2 rounded-md border border-destructive/30 p-3"><p className="text-sm text-destructive">{students.error.message}</p><Button variant="outline" size="sm" onClick={() => students.refetch()}>إعادة المحاولة</Button></div>}
    {picked.length > 0 && students.data && <>
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={addQualified}>إضافة الطلاب المؤهلين</Button><Button size="sm" variant="ghost" onClick={() => setPlan(p => Object.fromEntries(Object.entries(p).map(([id, r]) => [id, { ...r, on: false }])))}>إلغاء تحديد الكل</Button><Badge variant="secondary">{students.data.filter(s => s.eligible).length} مؤهل من {students.data.length}</Badge></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>مشارك</TableHead><TableHead>الطالب</TableHead><TableHead>الحلقة</TableHead><TableHead>الأحزاب المكتملة — استبعد ما لا تريده لهذا اليوم</TableHead></TableRow></TableHeader><TableBody>{students.data.map(s => { const r = plan[s.student_id] || { on: false, hizbs: s.completed }; return <TableRow key={s.student_id}><TableCell><Checkbox aria-label={`مشاركة ${s.student_name}`} disabled={!s.eligible} checked={r.on} onCheckedChange={v => toggleStudent(s, v === true)} /></TableCell><TableCell><p>{s.student_name}</p>{!s.eligible && <p className="text-xs text-muted-foreground">{s.reason}</p>}</TableCell><TableCell>{s.halaqa_name}</TableCell><TableCell>{s.eligible ? <div className="flex min-w-64 flex-wrap gap-2">{s.completed.map(h => <label key={h} className="flex items-center gap-1 rounded border px-2 py-1 text-sm"><Checkbox aria-label={`الحزب ${h} للطالب ${s.student_name}`} checked={r.hizbs.includes(h)} onCheckedChange={v => setPlan(p => ({ ...p, [s.student_id]: { ...r, hizbs: v === true ? [...r.hizbs, h].sort((a, b) => a - b) : r.hizbs.filter(x => x !== h) } }))} />{h}</label>)}</div> : <span className="text-muted-foreground">—</span>}</TableCell></TableRow>; })}</TableBody></Table></div>
      {students.data.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد طلاب نشطون في الحلقات المختارة</p>}
    </>}
    <Button disabled={busy || students.isLoading} onClick={save}>{busy ? 'جارٍ الحفظ…' : 'معاينة وحفظ الحلقات والمقررات'}</Button>
  </section>;
}
