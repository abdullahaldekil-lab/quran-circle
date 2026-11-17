import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { savePlan, formatHizbs, type Dashboard } from '@/lib/himmah';
import { planChanges, type PlanRow, type PlanIssue } from '@/lib/himmahPlan';

type EligibleStudent = { student_id: string; student_name: string; halaqa_id: string; halaqa_name: string; completed: number[]; partial: number[]; eligible: boolean; reason: string | null };
const isMemorization = (h: { name: string; talqeen_curriculum_id: string | null }) => !h.talqeen_curriculum_id && !h.name.includes('تلقين');

export default function HimmahEligibilitySetup({ data, refresh }: { data: Dashboard; refresh: () => void }) {
  const { toast } = useToast();
  const [picked, setPicked] = useState<string[]>(data.day.halaqa_ids || []);
  const [plan, setPlan] = useState<Record<string, PlanRow>>({});
  const [busy, setBusy] = useState(false);
  const [circlesDirty, setCirclesDirty] = useState(false);
  const [issues, setIssues] = useState<PlanIssue[]>([]);
  const [saveError, setSaveError] = useState('');
  const [studentPage, setStudentPage] = useState(0);
  useEffect(() => { if (!circlesDirty) setPicked(data.day.halaqa_ids || []); }, [data.day.halaqa_ids, circlesDirty]);
  const circles = useQuery({ queryKey: ['himmah-circles'], queryFn: async () => { const { data: rows, error } = await supabase.from('halaqat').select('id,name,talqeen_curriculum_id').eq('active', true).order('name'); if (error) throw error; return (rows || []).filter(isMemorization); } });
  const students = useQuery({ queryKey: ['himmah-eligible-students', data.day.id, picked.join(',')], enabled: picked.length > 0, retry: false, queryFn: async () => { const { data: rows, error } = await supabase.rpc('himmah_eligible_students', { _day: data.day.id, _halaqa_ids: picked }); if (error) throw error; return ((rows as unknown as EligibleStudent[]) || []); } });
  const enrolled = useMemo(() => new Map(data.participants.map(p => [p.student_id, p])), [data.participants]);
  // Drafts contain only user edits. Polling and eligibility refresh never replace them.
  const rowFor = (s: EligibleStudent): PlanRow => plan[s.student_id] || { on: enrolled.has(s.student_id), hizbs: enrolled.get(s.student_id)?.hizbs || s.completed };
  useEffect(() => setStudentPage(0), [picked.join(',')]);
  const toggleStudent = (s: EligibleStudent, on: boolean) => setPlan(p => ({ ...p, [s.student_id]: { on, hizbs: p[s.student_id]?.hizbs ?? enrolled.get(s.student_id)?.hizbs ?? s.completed } }));
  const addQualified = () => setPlan(p => ({ ...p, ...Object.fromEntries((students.data || []).filter(s => s.eligible && !p[s.student_id]).map(s => [s.student_id, { on: true, hizbs: enrolled.get(s.student_id)?.hizbs || s.completed }])) }));
  async function save() {
    const changes = planChanges(plan, data.participants, picked);
    const leaving = data.participants.filter(p => !picked.includes(p.halaqa_id) || changes.remove.includes(p.student_id));
    if (leaving.length && !window.confirm(`إزالة ${leaving.length} مشارك؟ لا يمكن إزالة أصحاب المحاولات المحفوظة.`)) return;
    setBusy(true); setIssues([]); setSaveError('');
    try {
      const result = await savePlan(data.day.id, picked, changes.plan, changes.remove);
      setPlan({}); setCirclesDirty(false); refresh(); void students.refetch(); toast({ title: `تم حفظ ${result.saved} تعديل${result.removed ? ` وإزالة ${result.removed}` : ''}` });
    } catch (e) {
      const error = e as { message?: string; details?: string }; setSaveError(error.message || 'تعذّر الحفظ؛ لم يُغيَّر شيء');
      try { const parsed: unknown = JSON.parse(error.details || '[]'); if (Array.isArray(parsed)) setIssues(parsed.filter((x): x is PlanIssue => typeof x?.student_id === 'string' && typeof x?.message === 'string')); } catch { /* Keep the full server message visible. */ }
    }
    finally { setBusy(false); }
  }
  return <section className="space-y-4" aria-label="إعداد اليوم التلقائي">
    <div><h3 className="font-bold">١. حلقات اليوم والطلاب المؤهلون</h3><p className="text-sm text-muted-foreground">تظهر الأحزاب من المحفوظ المثبت فقط؛ مستهدف الخطة ونتيجة السرد لا يضيفان حفظًا.</p></div>
    <div className="flex flex-wrap gap-3">{circles.data?.map(c => <label key={c.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2"><Checkbox disabled={busy} aria-label={`حلقة ${c.name}`} checked={picked.includes(c.id)} onCheckedChange={v => { setCirclesDirty(true); setPicked(p => v === true ? [...p, c.id] : p.filter(x => x !== c.id)); }} />{c.name}</label>)}</div>
    <Button size="sm" variant="outline" disabled={students.isFetching || !picked.length} onClick={() => students.refetch()}>تحديث الأهلية من ملف الطالب</Button>
    {students.isLoading && <p className="text-sm text-muted-foreground">جارٍ حساب الأحزاب المكتملة لكل طالب…</p>}
    {students.error && <div className="space-y-2 rounded-md border border-destructive/30 p-3"><p className="text-sm text-destructive">{students.error.message}</p><Button variant="outline" size="sm" onClick={() => students.refetch()}>إعادة المحاولة</Button></div>}
    {picked.length > 0 && students.data && <>
      <div className="flex flex-wrap items-center gap-2"><Button disabled={busy} size="sm" variant="outline" onClick={addQualified}>إضافة الطلاب المؤهلين</Button><Button disabled={busy} size="sm" variant="ghost" onClick={() => setPlan(p => ({ ...p, ...Object.fromEntries((students.data || []).map(s => [s.student_id, { ...rowFor(s), on: false }])) }))}>إلغاء تحديد الكل</Button><Badge variant="secondary">{students.data.filter(s => s.eligible).length} مؤهل من {students.data.length}</Badge></div>
      <div className="space-y-3">{students.data.slice(studentPage * 20, studentPage * 20 + 20).map(s => {
        const r = rowFor(s), stored = enrolled.get(s.student_id)?.hizbs || [];
        const added = r.on ? r.hizbs.filter(h => !stored.includes(h)) : [];
        const removed = stored.filter(h => !r.on || !r.hizbs.includes(h));
        const options = [...new Set([...s.completed, ...stored, ...r.hizbs])].sort((a, b) => a - b);
        const errors = issues.filter(x => x.student_id === s.student_id);
        return <article key={s.student_id} className="space-y-3 rounded-md border border-border p-3" aria-label={`مقرر ${s.student_name}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex min-w-0 items-center gap-2"><Checkbox aria-label={`مشاركة ${s.student_name}`} disabled={busy || (!s.eligible && !enrolled.has(s.student_id))} checked={r.on} onCheckedChange={v => toggleStudent(s, v === true)} /><span className="font-medium break-words">{s.student_name}</span></label><span className="text-sm text-muted-foreground">{s.halaqa_name}</span><Button variant="link" size="sm" asChild><Link to={`/students/${s.student_id}`} target="_blank">ملف الطالب / توثيق المحفوظ</Link></Button></div>
          <div className="grid gap-2 text-sm sm:grid-cols-2"><p>المكتمل وفق الملف: <bdi>{formatHizbs(s.completed) || 'لا يوجد'}</bdi></p><p>المقرر المحفوظ لليوم: <bdi>{formatHizbs(stored) || 'غير مسجل'}</bdi></p></div>
          {options.length > 0 && <div className="flex flex-wrap gap-2">{options.map(h => <label key={h} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-sm"><Checkbox disabled={busy || !r.on} aria-label={`الحزب ${h} للطالب ${s.student_name}`} checked={r.hizbs.includes(h)} onCheckedChange={v => setPlan(p => ({ ...p, [s.student_id]: { ...r, hizbs: v === true ? [...r.hizbs, h].sort((a, b) => a - b) : r.hizbs.filter(x => x !== h) } }))} />{h}{!s.completed.includes(h) && <span className="text-xs text-warning">غير مثبت حاليًا</span>}</label>)}</div>}
          {(added.length > 0 || removed.length > 0) && <p className="text-sm text-primary">غير محفوظ — إضافات: {formatHizbs(added) || 'لا يوجد'} · استبعادات: {formatHizbs(removed) || 'لا يوجد'}</p>}
          {!s.eligible && <p className="text-sm text-muted-foreground">{s.reason}</p>}
          {errors.map((x, i) => <p key={i} role="alert" className="break-words text-sm text-destructive">{x.message}</p>)}
        </article>;
      })}</div>
      <div className="flex items-center justify-between gap-2"><span className="text-sm">{studentPage * 20 + 1}–{Math.min((studentPage + 1) * 20, students.data.length)} من {students.data.length}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={studentPage === 0} onClick={() => setStudentPage(x => x - 1)}>الطلاب السابقون</Button><Button size="sm" variant="outline" disabled={(studentPage + 1) * 20 >= students.data.length} onClick={() => setStudentPage(x => x + 1)}>الطلاب التاليون</Button></div></div>
      {students.data.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد طلاب نشطون في الحلقات المختارة</p>}
    </>}
    {saveError && <div role="alert" className="space-y-2 border-s-4 border-destructive ps-3 text-sm text-destructive"><p>{saveError}</p><p>بقيت التعديلات غير المحفوظة؛ عالج الأخطاء ثم أعد الحفظ.</p>{issues.map((x, i) => <p key={i}>{x.message}</p>)}</div>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || students.isLoading} onClick={save}>{busy ? 'جارٍ الحفظ…' : 'حفظ الحلقات والمقررات'}</Button><Button disabled={busy || (!circlesDirty && !Object.keys(plan).length)} variant="outline" onClick={() => { setPlan({}); setCirclesDirty(false); setPicked(data.day.halaqa_ids || []); setIssues([]); setSaveError(''); }}>التراجع عن التعديلات</Button></div>
  </section>;
}
