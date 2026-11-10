import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Send, Users, KeyRound, MessageCircle } from 'lucide-react';
import { manage, reviewerStatusLabel, codeMessage, type Dashboard, type Reviewer } from '@/lib/himmah';

/** Memorization circles only: talqeen circles are excluded. */
const isMemorization = (h: { name: string; talqeen_curriculum_id: string | null }) => !h.talqeen_curriculum_id && !h.name.includes('تلقين');

export function DaySetup({ data, refresh }: { data: Dashboard; refresh: () => void }) {
  const { toast } = useToast();
  const [picked, setPicked] = useState<string[]>(data.day.halaqa_ids || []);
  const [plan, setPlan] = useState<Record<string, { on: boolean; from: number; to: number }>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked(data.day.halaqa_ids || []), [data.day.halaqa_ids]);
  const circles = useQuery({ queryKey: ['himmah-circles'], queryFn: async () => { const { data: rows, error } = await supabase.from('halaqat').select('id,name,talqeen_curriculum_id').eq('active', true).order('name'); if (error) throw error; return (rows || []).filter(isMemorization); } });
  const students = useQuery({ queryKey: ['himmah-circle-students', picked.join(',')], enabled: picked.length > 0, queryFn: async () => { const { data: rows, error } = await supabase.from('students').select('id,full_name,halaqa_id').in('halaqa_id', picked).eq('status', 'active').order('full_name'); if (error) throw error; return rows || []; } });
  const enrolled = useMemo(() => new Map(data.participants.map(p => [p.student_id, p])), [data.participants]);
  useEffect(() => {
    setPlan(prev => { const next = { ...prev }; for (const s of students.data || []) if (!next[s.id]) { const e = enrolled.get(s.id); next[s.id] = { on: true, from: e ? Math.min(...e.hizbs) : 1, to: e ? Math.max(...e.hizbs) : 1 }; } return next; });
  }, [students.data, enrolled]);
  const valid = (r: { from: number; to: number }) => Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 1 && r.to <= 60 && r.from <= r.to;
  async function save() {
    setBusy(true);
    try {
      await manage('halaqat', data.day.id, { halaqa_ids: picked });
      const list = (students.data || []).filter(s => plan[s.id]?.on);
      for (const s of list) { const r = plan[s.id]; if (!valid(r)) throw new Error(`نطاق أحزاب غير صحيح: ${s.full_name}`); await manage('participant', data.day.id, { student_id: s.id, hizbs: Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i) }); }
      const unchecked = (students.data || []).filter(s => !plan[s.id]?.on && enrolled.has(s.id));
      for (const s of unchecked) await manage('remove_participant', data.day.id, { participant_id: enrolled.get(s.id)!.id }).catch(() => undefined);
      toast({ title: `تم حفظ ${list.length} مشارك` }); refresh();
    } catch (e) { toast({ title: e instanceof Error ? e.message : 'تعذّر الحفظ', variant: 'destructive' }); } finally { setBusy(false); }
  }
  return <section className="border border-border rounded-lg p-4 space-y-4 bg-card" aria-label="إعداد اليوم">
    <h3 className="font-bold">١. حلقات اليوم والطلاب المشاركون</h3>
    <div className="flex flex-wrap gap-3">{circles.data?.map(c => <label key={c.id} className="flex items-center gap-2 border border-border rounded-md px-3 py-2"><Checkbox aria-label={`حلقة ${c.name}`} checked={picked.includes(c.id)} onCheckedChange={v => setPicked(p => v === true ? [...p, c.id] : p.filter(x => x !== c.id))} />{c.name}</label>)}</div>
    {picked.length > 0 && <>
      <div className="flex flex-wrap gap-2 items-center text-sm"><span>تعيين نطاق للجميع:</span><Input aria-label="من الحزب للجميع" type="number" className="w-20" min={1} max={60} id="all-from" defaultValue={1} /><Input aria-label="إلى الحزب للجميع" type="number" className="w-20" min={1} max={60} id="all-to" defaultValue={1} /><Button size="sm" variant="outline" onClick={() => { const f = Number((document.getElementById('all-from') as HTMLInputElement).value); const t = Number((document.getElementById('all-to') as HTMLInputElement).value); setPlan(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, from: f, to: t }]))); }}>تطبيق</Button></div>
      <Table><TableHeader><TableRow><TableHead>مشارك</TableHead><TableHead>الطالب</TableHead><TableHead>الحلقة</TableHead><TableHead>من الحزب</TableHead><TableHead>إلى الحزب</TableHead></TableRow></TableHeader><TableBody>{(students.data || []).map(s => { const r = plan[s.id] || { on: true, from: 1, to: 1 }; const upd = (x: Partial<typeof r>) => setPlan(p => ({ ...p, [s.id]: { ...r, ...x } })); return <TableRow key={s.id}><TableCell><Checkbox aria-label={`مشاركة ${s.full_name}`} checked={r.on} onCheckedChange={v => upd({ on: v === true })} /></TableCell><TableCell>{s.full_name}</TableCell><TableCell>{circles.data?.find(c => c.id === s.halaqa_id)?.name}</TableCell><TableCell><Input aria-label={`من الحزب ${s.full_name}`} type="number" className="w-20" min={1} max={60} value={r.from} onChange={e => upd({ from: Number(e.target.value) })} /></TableCell><TableCell><Input aria-label={`إلى الحزب ${s.full_name}`} type="number" className={`w-20 ${valid(r) ? '' : 'border-destructive'}`} min={1} max={60} value={r.to} onChange={e => upd({ to: Number(e.target.value) })} /></TableCell></TableRow>; })}</TableBody></Table>
      {students.data?.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد طلاب نشطون في الحلقات المختارة</p>}
    </>}
    <Button disabled={busy} onClick={save}>{busy ? 'جارٍ الحفظ...' : 'حفظ الحلقات والمشاركين'}</Button>
  </section>;
}

export function ReviewerManager({ data, refresh }: { data: Dashboard; refresh: () => void }) {
  const { toast } = useToast();
  const [assignFor, setAssignFor] = useState<Reviewer | null>(null);
  const [halaqat, setHalaqat] = useState<string[]>([]); const [students, setStudents] = useState<string[]>([]);
  const [issued, setIssued] = useState<{ reviewer: Reviewer; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const circles = [...new Map(data.participants.map(p => [p.halaqa_id, p.halaqa_name])).entries()];
  const scopeOf = (id: string) => data.assignments.filter(a => a.reviewer_id === id);
  const scopeText = (id: string) => { const s = scopeOf(id); if (!s.length) return '—'; return [...s.filter(a => a.halaqa_id).map(a => circles.find(c => c[0] === a.halaqa_id)?.[1] || 'حلقة'), ...(s.some(a => a.participant_id) ? [`${s.filter(a => a.participant_id).length} طالب`] : [])].join('، '); };
  function openAssign(r: Reviewer) { const s = scopeOf(r.id); setHalaqat(s.flatMap(a => a.halaqa_id ? [a.halaqa_id] : [])); setStudents(s.flatMap(a => a.participant_id ? [a.participant_id] : [])); setAssignFor(r); }
  async function saveAssign() {
    if (!assignFor) return; setBusy(true);
    try { const { error } = await supabase.rpc('himmah_assign', { _reviewer: assignFor.id, _halaqat: halaqat, _participants: students }); if (error) throw error; toast({ title: 'تم حفظ التكليف' }); setAssignFor(null); refresh(); }
    catch (e) { toast({ title: e instanceof Error ? e.message : 'تعذّر الحفظ', variant: 'destructive' }); } finally { setBusy(false); }
  }
  async function issue(r: Reviewer) {
    setBusy(true);
    try { const { data: code, error } = await supabase.rpc('himmah_issue_code', { _reviewer: r.id }); if (error) throw error; setIssued({ reviewer: r, code: String(code) }); refresh(); }
    catch (e) { toast({ title: e instanceof Error ? e.message : 'تعذّر إصدار الكود', variant: 'destructive' }); } finally { setBusy(false); }
  }
  const link = `${window.location.origin}/himmah-register/${data.day.id}/${data.day.invite_key}`;
  const message = issued ? codeMessage(issued.reviewer.full_name, data.day.title, issued.code, link, scopeText(issued.reviewer.id)) : '';
  async function send() {
    if (!issued) return; setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('himmah-send-code', { body: { day_id: data.day.id, reviewer_id: issued.reviewer.id, message } });
      if (error) { const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message; throw new Error(details); }
      if (res?.configured === false) toast({ title: 'الإرسال الآلي غير مهيأ؛ انسخ الرسالة وأرسلها يدويًا', variant: 'destructive' });
      else toast({ title: 'أُرسل الكود عبر واتساب' });
    } catch (e) { toast({ title: `تعذّر الإرسال: ${e instanceof Error ? e.message : ''}`, variant: 'destructive' }); } finally { setBusy(false); }
  }
  const external = data.reviewers.filter(r => !r.staff);
  const pending = external.filter(r => r.status === 'pending').length;
  return <section className="space-y-4" aria-label="إدارة المسمّعين الخارجيين">
    <div className="flex flex-wrap gap-2 items-center"><Button variant="outline" disabled={!data.day.registration_open} onClick={() => navigator.clipboard.writeText(link).then(() => toast({ title: 'تم نسخ رابط التسجيل' })).catch(() => toast({ title: 'تعذّر النسخ', variant: 'destructive' }))}><Copy className="w-4 h-4 me-2" />نسخ رابط تسجيل المسمّعين</Button>{!data.day.registration_open && <span className="text-sm text-muted-foreground">التسجيل مغلق — افتحه من الإعدادات</span>}{pending > 0 && <Badge variant="secondary">{pending} بانتظار التوزيع</Badge>}</div>
    <Table><TableHeader><TableRow><TableHead>المسمّع</TableHead><TableHead>الجوال</TableHead><TableHead>الحالة</TableHead><TableHead>التكليف</TableHead><TableHead>الإجراءات</TableHead></TableRow></TableHeader><TableBody>{external.map(r => <TableRow key={r.id}><TableCell>{r.full_name}</TableCell><TableCell dir="ltr">{r.phone || '—'}</TableCell><TableCell><Badge variant={r.status === 'assigned' ? 'default' : r.status === 'revoked' ? 'destructive' : 'secondary'}>{reviewerStatusLabel(r)}</Badge></TableCell><TableCell>{scopeText(r.id)}</TableCell><TableCell className="flex flex-wrap gap-2">{r.status !== 'revoked' && <><Button size="sm" variant="outline" disabled={busy} onClick={() => openAssign(r)}><Users className="w-4 h-4 me-1" />توزيع</Button><Button size="sm" disabled={busy || !scopeOf(r.id).length} onClick={() => issue(r)}><KeyRound className="w-4 h-4 me-1" />{r.code_issued_at ? 'إعادة إصدار الكود' : 'إصدار الكود'}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => manage('revoke', data.day.id, { reviewer_id: r.id }).then(refresh)}>إيقاف</Button></>}</TableCell></TableRow>)}</TableBody></Table>
    {external.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد مسمّعون مسجلون بعد</p>}
    <Dialog open={!!assignFor} onOpenChange={v => !v && setAssignFor(null)}><DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>توزيع على {assignFor?.full_name}</DialogTitle></DialogHeader>
      <p className="font-medium">حلقات كاملة</p><div className="flex flex-wrap gap-2">{circles.map(([id, name]) => <label key={id} className="flex items-center gap-2 border border-border rounded-md px-3 py-2"><Checkbox aria-label={`تكليف حلقة ${name}`} checked={halaqat.includes(id)} onCheckedChange={v => setHalaqat(h => v === true ? [...h, id] : h.filter(x => x !== id))} />{name}</label>)}</div>
      <p className="font-medium mt-3">أو طلاب محددون</p><div className="grid sm:grid-cols-2 gap-2">{data.participants.filter(p => !halaqat.includes(p.halaqa_id)).map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox aria-label={`تكليف الطالب ${p.student_name}`} checked={students.includes(p.id)} onCheckedChange={v => setStudents(s => v === true ? [...s, p.id] : s.filter(x => x !== p.id))} />{p.student_name} · {p.halaqa_name}</label>)}</div>
      <Button disabled={busy || (!halaqat.length && !students.length)} onClick={saveAssign}>حفظ التكليف</Button></DialogContent></Dialog>
    <Dialog open={!!issued} onOpenChange={v => !v && setIssued(null)}><DialogContent dir="rtl"><DialogHeader><DialogTitle>كود دخول {issued?.reviewer.full_name}</DialogTitle></DialogHeader>
      <p className="text-center font-mono text-3xl tracking-widest" dir="ltr" data-testid="issued-code">{issued?.code}</p>
      <p className="text-sm text-muted-foreground">يظهر الكود مرة واحدة فقط. إعادة الإصدار تُلغي الكود السابق.</p>
      <pre className="whitespace-pre-wrap text-sm bg-muted rounded-md p-3">{message}</pre>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={send}><Send className="w-4 h-4 me-2" />إرسال عبر واتساب</Button><Button variant="outline" onClick={() => navigator.clipboard.writeText(message).then(() => toast({ title: 'تم نسخ الرسالة' })).catch(() => toast({ title: 'تعذّر النسخ', variant: 'destructive' }))}><Copy className="w-4 h-4 me-2" />نسخ الرسالة</Button>{issued?.reviewer.phone && <Button variant="outline" asChild><a href={`https://wa.me/${issued.reviewer.phone.startsWith('05') ? '966' + issued.reviewer.phone.slice(1) : issued.reviewer.phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4 me-2" />فتح واتساب يدويًا</a></Button>}</div>
    </DialogContent></Dialog>
  </section>;
}
