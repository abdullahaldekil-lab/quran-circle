import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { absoluteAyah, parseAyahRef } from '@/lib/quran-locate';
import { attemptStatusLabel, duration, formatHizbs } from '@/lib/himmah';
import { formatDateSmart } from '@/lib/hijri';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookCheck, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Memorization = { student_id: string; completed: number[]; partial: number[]; sources: string[]; last_updated: string | null; needs_completion: boolean; manual_ranges: { from_label: string; to_label: string; start_ayah: number; end_ayah: number }[]; plan: { academic_year: string; term: string; daily_memorization_pages: number } | null };
type HimmahResult = { attempt_id: string; day_title: string; day_date: string; hizb: number; reviewer_name: string | null; score: number | null; status: 'pass' | 'fail' | 'running' | 'ended' | 'cancelled'; mistakes: number; melodies: number; warnings: number; duration_seconds: number | null; approved_at: string | null; attempt_no: number; halaqa_name_at_day: string; latest_approved: boolean };
type RangeRow = { from: string; to: string };

export default function StudentMemorizationHimmah({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
  const [data, setData] = useState<Memorization | null>(null);
  const [history, setHistory] = useState<HimmahResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allAttempts, setAllAttempts] = useState(false);
  const [open, setOpen] = useState(false);
  const [ranges, setRanges] = useState<RangeRow[]>([{ from: '', to: '' }]);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [m, h] = await Promise.all([
        supabase.rpc('student_memorization_data', { _student_ids: [studentId] }),
        supabase.rpc('student_himmah_history', { _student: studentId }),
      ]);
      if (m.error) throw m.error; if (h.error) throw h.error;
      setData(((m.data as unknown as Memorization[]) || [])[0] || null);
      setHistory((h.data as unknown as HimmahResult[]) || []);
    } catch (e) { setError((e as { message?: string })?.message || 'تعذّر تحميل المحفوظ ونتائج السرد'); }
    finally { setLoading(false); }
  }, [studentId]);
  useEffect(() => { void load(); }, [load]);

  const openEditor = () => {
    setRanges(data?.manual_ranges?.length
      ? data.manual_ranges.map(r => ({ from: r.from_label, to: r.to_label }))
      : [{ from: '', to: '' }]);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = ranges.map(r => {
        const from = parseAyahRef(r.from), to = parseAyahRef(r.to);
        if (!from || !to) throw new Error('اكتب البداية والنهاية بالسورة والآية، مثل: النبأ 1 — النازعات 46');
        const a = absoluteAyah(from), b = absoluteAyah(to);
        return { start_ayah: Math.min(a, b), end_ayah: Math.max(a, b), from_label: r.from.trim(), to_label: r.to.trim() };
      });
      const { error } = await supabase.rpc('student_save_memorization_ranges', { _student: studentId, _ranges: payload });
      if (error) throw error;
      toast.success('تم توثيق مواضع المحفوظ وتحديث الأحزاب المؤهلة'); setOpen(false); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'تعذّر حفظ المحفوظ'); }
    finally { setSaving(false); }
  };
  if (loading) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">جارٍ حساب المحفوظ ونتائج السرد…</CardContent></Card>;
  if (error) return <Card><CardContent className="py-6 space-y-3 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={load}>إعادة المحاولة</Button></CardContent></Card>;
  if (!data) return null;
  const shown = allAttempts ? history : history.filter(x => x.latest_approved || !x.approved_at);
  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span className="flex items-center gap-2"><BookCheck className="h-5 w-5 text-primary" />المحفوظ المثبت ويوم السرد</span>{canEdit && <Button size="sm" variant="outline" onClick={openEditor}><Pencil className="ml-1 h-4 w-4" />استكمال المحفوظ</Button>}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {data.plan && <p className="rounded-md bg-muted p-3 text-sm">الخطة الحالية: {data.plan.academic_year} — {data.plan.term}؛ المقدار اليومي {data.plan.daily_memorization_pages} صفحة. المستهدف لا يُحسب محفوظًا تلقائيًا.</p>}
      {data.needs_completion && <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">يحتاج استكمال بيانات المحفوظ: المقدار القديم لا يحدد مواضع الحفظ، لذلك لم تُستنتج منه أحزاب.</p>}
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border p-3"><p className="mb-2 text-sm font-medium">الأحزاب مكتملة الحفظ</p><p className="font-bold text-primary">{data.completed.length ? formatHizbs(data.completed) : 'لا يوجد'}</p></div><div className="rounded-lg border p-3"><p className="mb-2 text-sm font-medium">الأحزاب قيد الإكمال</p><p>{data.partial.length ? formatHizbs(data.partial) : 'لا يوجد'}</p></div></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>الدليل:</span>{data.sources.length ? data.sources.map(s => <Badge key={s} variant="secondary">{s}</Badge>) : <span>لا توجد نطاقات موثقة</span>}{data.last_updated && <span>آخر تحديث: {formatDateSmart(data.last_updated)}</span>}</div>
      <div className="space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" />سجل يوم السرد</h4><label className="flex items-center gap-2 text-sm"><Checkbox aria-label="عرض جميع المحاولات" checked={allAttempts} onCheckedChange={v => setAllAttempts(v === true)} />جميع المحاولات</label></div>
        {shown.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">لا توجد نتائج يوم سرد لهذا الطالب</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>اليوم / الحزب</TableHead><TableHead>المسمّع</TableHead><TableHead>الدرجة</TableHead><TableHead>النتيجة</TableHead><TableHead>خطأ / لحن / تنبيه</TableHead><TableHead>المدة</TableHead><TableHead>الاعتماد</TableHead></TableRow></TableHeader><TableBody>{shown.map(r => <TableRow key={r.attempt_id}><TableCell><p>{r.day_title} — حزب {r.hizb}</p><p className="text-xs text-muted-foreground">{formatDateSmart(r.day_date)} · {r.halaqa_name_at_day} · محاولة {r.attempt_no}</p></TableCell><TableCell>{r.reviewer_name || '—'}</TableCell><TableCell>{r.score ?? '—'}</TableCell><TableCell><Badge variant={r.status === 'pass' ? 'default' : r.status === 'fail' ? 'destructive' : 'secondary'}>{attemptStatusLabel(r.status)}</Badge></TableCell><TableCell>{r.mistakes} / {r.melodies} / {r.warnings}</TableCell><TableCell dir="ltr">{r.duration_seconds == null ? '—' : duration(r.duration_seconds)}</TableCell><TableCell>{r.approved_at ? formatDateSmart(r.approved_at) : '—'}</TableCell></TableRow>)}</TableBody></Table></div>}
      </div>
    </CardContent>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="flex max-h-[85vh] flex-col overflow-hidden"><DialogHeader><DialogTitle>تعديل واستكمال المحفوظ</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{data.manual_ranges.length ? `حُمّلت ${data.manual_ranges.length} نطاقات موثقة سابقًا؛ عدّلها أو أضف إليها.` : 'لا توجد نطاقات موثقة يدويًا بعد؛ أضف المواضع الفعلية الآن.'} تُدمج التداخلات، وأي فجوة تمنع اكتمال الحزب. يحفظ النظام النسخ السابقة للتدقيق.</p><Button type="button" variant="outline" className="w-full" onClick={() => setRanges(x => [...x, { from: '', to: '' }])}><Plus className="ml-1 h-4 w-4" />إضافة موضع آخر</Button><div className="max-h-[45vh] space-y-3 overflow-y-auto pe-1">{ranges.map((r, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border p-3"><div><Label>من السورة والآية</Label><Input value={r.from} onChange={e => setRanges(x => x.map((v, j) => j === i ? { ...v, from: e.target.value } : v))} placeholder="النبأ 1" /></div><div><Label>إلى السورة والآية</Label><Input value={r.to} onChange={e => setRanges(x => x.map((v, j) => j === i ? { ...v, to: e.target.value } : v))} placeholder="النازعات 46" /></div><Button aria-label={`حذف النطاق ${i + 1}`} variant="ghost" size="icon" disabled={ranges.length === 1} onClick={() => setRanges(x => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button disabled={saving} onClick={() => { try { void save(); } catch (e) { toast.error(e instanceof Error ? e.message : 'بيانات غير صحيحة'); } }}>{saving ? 'جارٍ الحفظ…' : 'حفظ وتحديث الأهلية'}</Button></DialogFooter></DialogContent></Dialog>
  </Card>;
}
