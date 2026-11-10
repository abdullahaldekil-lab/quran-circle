import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Play, Square, CheckCircle2 } from 'lucide-react';
import { attemptAction, duration, outcome, type Attempt, type Dashboard, type Participant } from '@/lib/himmah';
import { useToast } from '@/hooks/use-toast';

export default function TimedRecitation({ data, participant, token, refresh }: { data: Dashboard; participant: Participant; token?: string; refresh: () => void }) {
  const { toast } = useToast();
  const [active, setActive] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const stored = localStorage.getItem(`himmah-attempt:${data.day.id}:${participant.id}`);
    const found = data.attempts.find(a => a.id === stored && ['running', 'ended'].includes(a.status));
    // Sync must not reset the timer or overwrite newer local counters for the same attempt.
    setActive(current => current && found && current.id === found.id ? current : current && !found && current.id === stored ? current : found || null);
  }, [data.day.id, participant.id, data.attempts]);
  async function run(action: string, hizb?: number, counts?: { mistakes: number; warnings: number }) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await attemptAction(action, data.day.id, { participant: participant.id, hizb, request: action === 'start' ? crypto.randomUUID() : undefined, attempt: active?.id, mistakes: counts?.mistakes ?? active?.mistakes, warnings: counts?.warnings ?? active?.warnings, token });
      setActive(result);
      localStorage.setItem(`himmah-attempt:${data.day.id}:${participant.id}`, result.id);
      if (action === 'approve') { toast({ title: 'تم اعتماد وحفظ النتيجة' }); setActive(null); refresh(); }
    } catch (error) { toast({ title: error instanceof Error ? error.message : 'تعذّر الحفظ، بيانات المحاولة محفوظة', variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  const seconds = active ? active.duration_seconds ?? Math.max(0, Math.floor((tick - Date.parse(active.started_at)) / 1000)) : 0;
  return <div className="space-y-5">
    <h3 className="font-bold text-lg">{participant.student_name}</h3>
    <div className="flex flex-wrap gap-2">{participant.hizbs.map(h => <Button key={h} variant={active?.hizb === h ? 'default' : 'outline'} disabled={busy || !!active} onClick={() => run('start', h)}><Play className="h-4 w-4 me-2" />بدء الحزب {h}</Button>)}</div>
    {active && <section className="border border-border rounded-lg p-5 space-y-5 bg-card">
      <div className="flex justify-between gap-4"><h4 className="font-bold">الحزب {active.hizb} · المحاولة {active.attempt_no}</h4><span className="font-mono text-3xl tabular-nums" dir="ltr">{duration(seconds)}</span></div>
      {(['mistakes', 'warnings'] as const).map(key => <div key={key} className="flex items-center justify-between gap-3"><span>{key === 'mistakes' ? 'الأخطاء' : 'التنبيهات'}</span><div className="flex items-center gap-4"><Button size="icon" variant="outline" aria-label={`إنقاص ${key === 'mistakes' ? 'الأخطاء' : 'التنبيهات'}`} disabled={busy || active[key] === 0} onClick={() => run('counts', undefined, { mistakes: active.mistakes, warnings: active.warnings, [key]: active[key] - 1 })}><Minus className="h-4 w-4" /></Button><span className="w-10 text-center text-2xl font-bold">{active[key]}</span><Button size="icon" variant="outline" aria-label={`زيادة ${key === 'mistakes' ? 'الأخطاء' : 'التنبيهات'}`} disabled={busy} onClick={() => run('counts', undefined, { mistakes: active.mistakes, warnings: active.warnings, [key]: active[key] + 1 })}><Plus className="h-4 w-4" /></Button></div></div>)}
      <div className="flex flex-wrap items-center justify-between gap-3"><Badge className={outcome(active.mistakes, active.warnings, data.day.error_weight, data.day.fail_threshold) === 'pass' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>{outcome(active.mistakes, active.warnings, data.day.error_weight, data.day.fail_threshold) === 'pass' ? 'مجتاز' : 'راسب'} · {active.mistakes * data.day.error_weight + active.warnings} تنبيه مكافئ</Badge>
      {active.status === 'running' ? <Button disabled={busy} onClick={() => run('end')}><Square className="h-4 w-4 me-2" />إنهاء الحزب</Button> : <Button disabled={busy} onClick={() => run('approve')}><CheckCircle2 className="h-4 w-4 me-2" />اعتماد وحفظ النتيجة</Button>}</div>
    </section>}
  </div>;
}