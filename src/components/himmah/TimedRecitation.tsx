import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Play, Square, CheckCircle2, Pause, XCircle } from 'lucide-react';
import { attemptAction, cancelAttempt, duration, outcome, score, elapsedSeconds, pauseRemaining, canFinishHizb, serverNow, remainingHizbs, type Attempt, type Dashboard, type Participant } from '@/lib/himmah';
import { useToast } from '@/hooks/use-toast';

export default function TimedRecitation({ data, participant, token, refresh }: { data: Dashboard; participant: Participant; token?: string; refresh: () => void }) {
  const { toast } = useToast();
  const [active, setActive] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(serverNow());
  useEffect(() => { const timer = setInterval(() => setTick(serverNow()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const stored = localStorage.getItem(`himmah-attempt:${data.day.id}:${participant.id}`);
    const found = data.attempts.find(a => a.id === stored && ['running', 'ended'].includes(a.status));
    // Sync must not reset the timer or overwrite newer local counters for the same attempt.
    setActive(current => current && found && current.id === found.id ? current : current && !found && current.id === stored ? current : found || null);
  }, [data.day.id, participant.id, data.attempts]);
  async function run(action: string, hizb?: number, counts?: { mistakes: number; melodies: number; warnings: number }, quiet = false) {
    if (busy) return false;
    setBusy(true);
    try {
      const result = await attemptAction(action, data.day.id, { participant: participant.id, hizb, request: action === 'start' ? crypto.randomUUID() : undefined, attempt: active?.id, mistakes: counts?.mistakes ?? active?.mistakes, melodies: counts?.melodies ?? active?.melodies, warnings: counts?.warnings ?? active?.warnings, token });
      setActive(result);
      localStorage.setItem(`himmah-attempt:${data.day.id}:${participant.id}`, result.id);
      if (action === 'approve') { toast({ title: 'تم اعتماد وحفظ النتيجة' }); setActive(null); refresh(); }
      return true;
    } catch (error) { if (!quiet) toast({ title: (error as { message?: string })?.message || 'تعذّر الحفظ، بيانات المحاولة محفوظة', variant: 'destructive' }); return false; }
    finally { setBusy(false); }
  }
  /** Discards a mistaken or abandoned attempt before approval; nothing is recorded as a result. */
  async function cancel() {
    if (busy || !active || !window.confirm(`إلغاء محاولة الحزب ${active.hizb}؟ لن تُحتسب أي نتيجة لهذه المحاولة.`)) return;
    setBusy(true);
    try { await cancelAttempt(data.day.id, active.id, token); localStorage.removeItem(`himmah-attempt:${data.day.id}:${participant.id}`); setActive(null); toast({ title: 'أُلغيت المحاولة' }); refresh(); }
    catch (error) { toast({ title: error instanceof Error ? error.message : 'تعذّر إلغاء المحاولة', variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  const minimum = Math.max(540, data.day.minimum_duration_seconds || 540);
  const pauseLimit = data.day.pause_limit_seconds || 0;
  const seconds = active ? elapsedSeconds(active, tick, minimum, pauseLimit) : 0;
  const pauseLeft = active ? pauseRemaining(active, tick, pauseLimit) : null;
  const paused = !!active?.paused_at && active.status === 'running';
  const cfg = data.day;
  const pendingHizbs = remainingHizbs(participant, data.attempts, data.reopenings);
  const openElsewhere = new Set(data.attempts.filter(a => a.participant_id === participant.id && ['running', 'ended'].includes(a.status) && a.id !== active?.id).map(a => a.hizb));
  return <div className="space-y-5">
    <h3 className="font-bold text-lg">{participant.student_name}</h3>
    <p className="text-sm text-muted-foreground">المتبقي للطالب: {pendingHizbs.length} حزب · تظهر الأحزاب غير المسمّاة فقط</p>
    <div className="flex flex-wrap gap-2">{pendingHizbs.map(h => <Button key={h} variant={active?.hizb === h ? 'default' : 'outline'} disabled={busy || !!active || openElsewhere.has(h)} title={openElsewhere.has(h) ? 'الحزب قيد التسميع على جهاز آخر' : undefined} onClick={() => run('start', h)}><Play className="h-4 w-4 me-2" />{openElsewhere.has(h) ? `الحزب ${h} قيد التسميع` : `بدء الحزب ${h}`}</Button>)}</div>
    {!pendingHizbs.length && !active && <Badge className="bg-success text-success-foreground">اكتمل تسميع جميع أحزاب الطالب</Badge>}
    {active && <section className="border border-border rounded-lg p-5 space-y-5 bg-card">
      <div className="flex flex-wrap justify-between gap-4"><h4 className="font-bold">الحزب {active.hizb} · المحاولة {active.attempt_no}</h4><span className="text-end"><span className="font-mono text-3xl tabular-nums block" dir="ltr">{duration(seconds)}</span><span className="text-sm text-muted-foreground">الحد الأدنى: <bdi>{duration(minimum)}</bdi></span>{paused && <Badge variant="secondary">{pauseLeft === 0 ? 'انتهى وقت التوقف؛ المؤقت يعمل' : pauseLeft != null ? `موقوف مؤقتًا · بقي ${duration(pauseLeft)}` : 'موقوف مؤقتًا'}</Badge>}</span></div>
      {(['mistakes', 'melodies', 'warnings'] as const).map(key => { const label = key === 'mistakes' ? 'الأخطاء' : key === 'melodies' ? 'اللحن' : 'التنبيهات'; return <div key={key} className="flex items-center justify-between gap-3"><span>{label}</span><div className="flex items-center gap-4"><Button size="icon" variant="outline" aria-label={`إنقاص ${label}`} disabled={busy || active[key] === 0} onClick={() => run('counts', undefined, { mistakes: active.mistakes, melodies: active.melodies, warnings: active.warnings, [key]: active[key] - 1 })}><Minus className="h-4 w-4" /></Button><span className="w-10 text-center text-2xl font-bold">{active[key]}</span><Button size="icon" variant="outline" aria-label={`زيادة ${label}`} disabled={busy} onClick={() => run('counts', undefined, { mistakes: active.mistakes, melodies: active.melodies, warnings: active.warnings, [key]: active[key] + 1 })}><Plus className="h-4 w-4" /></Button></div></div>; })}
      <div className="flex flex-wrap items-center justify-between gap-3"><Badge className={outcome(active.mistakes, active.warnings, cfg, active.melodies) === 'pass' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>{outcome(active.mistakes, active.warnings, cfg, active.melodies) === 'pass' ? 'مجتاز' : 'راسب'} · الدرجة {score(active.mistakes, active.warnings, cfg, active.melodies)} من {cfg.total_score}</Badge>{active.status === 'running' && canFinishHizb(seconds, minimum) && <span className="text-sm text-muted-foreground">اكتمل الحد الأدنى؛ التسميع مستمر</span>}
      {active.status === 'running' ? <div className="flex gap-2">{paused ? <Button variant="outline" disabled={busy} onClick={() => run('resume')}><Play className="h-4 w-4 me-2" />استئناف</Button> : <Button variant="outline" disabled={busy || pauseLeft === 0} title={pauseLeft === 0 ? 'استُنفد وقت التوقف المسموح' : undefined} onClick={() => run('pause')}><Pause className="h-4 w-4 me-2" />{pauseLeft != null ? `إيقاف مؤقت (${duration(pauseLeft)})` : 'إيقاف مؤقت'}</Button>}<Button disabled={busy || !canFinishHizb(seconds, minimum)} title={!canFinishHizb(seconds, minimum) ? `المتبقي للحد الأدنى: ${duration(Math.max(0, minimum - seconds))}` : undefined} onClick={() => run('end')}><Square className="h-4 w-4 me-2" />إنهاء الحزب</Button></div> : <Button disabled={busy} onClick={() => run('approve')}><CheckCircle2 className="h-4 w-4 me-2" />اعتماد وحفظ النتيجة</Button>}</div>
      <div className="flex justify-end border-t border-border pt-3"><Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={cancel}><XCircle className="h-4 w-4 me-2" />إلغاء المحاولة (بدأت بالخطأ)</Button></div>
    </section>}
  </div>;
}