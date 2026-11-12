import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, CircleX, Clock3, Crown, Expand, ListChecks, RefreshCw, Settings2, Shrink, Trophy, Users, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateSmart } from '@/lib/hijri';
import logo from '@/assets/huwaylan-logo.jpeg';

type DisplayStudent = { student_name: string; halaqa_name: string; total: number; presented: number; passed: number; average_score: number; completion: number; rank: number };
type DisplayHalaqa = { halaqa_name: string; registered: number; present: number; total: number; presented: number; passed: number; completion: number; rank: number };
type DisplayData = {
  day: { id: string; title: string; day_date: string; ranking_mode: 'passed' | 'completion' };
  stats: { circles: number; registered: number; present: number; total: number; presented: number; passed: number; failed: number; remaining_recitation: number; remaining_pass: number };
  best_student: DisplayStudent | null;
  best_halaqa: DisplayHalaqa | null;
  top_students: DisplayStudent[];
  top_halaqat: DisplayHalaqa[];
  server_now: string;
};

const riyadhClock = new Intl.DateTimeFormat('ar-SA', { timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
const riyadhHijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' });

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return <div className="rounded-2xl border border-display-border/60 bg-display-card/85 p-4 shadow-lg backdrop-blur-sm">
    <div className="flex items-center justify-between gap-2"><p className="text-sm text-display-muted">{label}</p><Icon className="h-5 w-5 text-display-glow" /></div>
    <strong className="mt-2 block text-3xl font-bold tabular-nums text-display-foreground">{value}</strong>
  </div>;
}

export default function HimmahDisplay() {
  const { dayId = '', displayKey = '' } = useParams();
  const rootRef = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [topCount, setTopCount] = useState(() => {
    const saved = Number(localStorage.getItem('himmah-display-top-count'));
    return [5, 10, 15, 20].includes(saved) ? saved : 10;
  });

  const view = useQuery({
    queryKey: ['himmah-public-display', dayId, displayKey],
    enabled: !!dayId && !!displayKey,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('himmah_public_display', { _day: dayId, _key: displayKey });
      if (error) throw error;
      return data as unknown as DisplayData;
    },
  });
  const brand = useQuery({
    queryKey: ['himmah-public-branding', dayId, displayKey],
    enabled: !!dayId && !!displayKey,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('himmah_public_branding', { _day: dayId, _key: displayKey });
      if (error) throw error;
      return data as { logo_url?: string };
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);
  useEffect(() => {
    const onOnline = () => { setOnline(true); void view.refetch(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [view.refetch]);
  useEffect(() => localStorage.setItem('himmah-display-top-count', String(topCount)), [topCount]);

  const data = view.data;
  const displayLogo = brand.data?.logo_url || logo;
  const visibleStudents = useMemo(() => (data?.top_students || []).slice(0, topCount), [data?.top_students, topCount]);
  const tiedStudents = (data?.top_students || []).filter(s => s.rank === 1);
  const tiedHalaqat = (data?.top_halaqat || []).filter(h => h.rank === 1);
  const completion = data?.stats.total ? data.stats.passed / data.stats.total * 100 : 0;

  async function toggleFullscreen() {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { setFullscreenError('تعذّر ملء الشاشة من هذا المتصفح'); }
  }

  return <main ref={rootRef} className="himmah-display relative min-h-screen overflow-x-hidden p-4 font-cairo text-display-foreground md:p-7" dir="rtl">
    <img src={displayLogo} alt="" aria-hidden="true" className="pointer-events-none fixed inset-0 m-auto h-[70vmin] w-[70vmin] object-contain opacity-[0.045]" />
    <div className="relative z-10 mx-auto max-w-[1800px] space-y-5">
      <header className="grid gap-5 rounded-3xl border border-display-border/60 bg-display-card/75 p-5 shadow-2xl backdrop-blur-md md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-center gap-4">
          <img src={displayLogo} alt="شعار مجمع حلق جامع حويلان" className="h-20 w-20 rounded-2xl bg-display-foreground/90 object-contain p-1 md:h-24 md:w-24" />
          <div><p className="text-lg font-semibold text-display-gold">مجمع حلق جامع حويلان</p><h1 className="mt-1 text-2xl font-bold md:text-4xl">{data?.day.title || 'يوم السرد – يوم الهمة'}</h1><p className="mt-2 text-sm text-display-muted">{data ? formatDateSmart(data.day.day_date) : 'جارٍ تحميل بيانات اليوم'}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 md:justify-end">
          <div className="text-left"><time className="block text-3xl font-bold tabular-nums text-display-foreground md:text-5xl" dir="ltr">{riyadhClock.format(now)}</time><p className="mt-1 text-sm text-display-muted">{riyadhHijri.format(now)} هـ · بتوقيت الرياض</p></div>
          <div className="flex items-center gap-2">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-display-border bg-display-background/35 px-3 text-sm text-display-muted"><Settings2 className="h-4 w-4" /><span>الطلاب الظاهرون</span><select aria-label="عدد الطلاب الظاهرين" value={topCount} onChange={e => setTopCount(Number(e.target.value))} className="bg-transparent font-bold text-display-foreground outline-none"><option className="bg-display-background" value={5}>5</option><option className="bg-display-background" value={10}>10</option><option className="bg-display-background" value={15}>15</option><option className="bg-display-background" value={20}>20</option></select></label>
            <button type="button" aria-label={fullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'} onClick={toggleFullscreen} className="flex h-11 items-center gap-2 rounded-xl border border-display-border bg-display-glow/15 px-4 font-semibold text-display-foreground transition-colors hover:bg-display-glow/25">{fullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}{fullscreen ? 'إنهاء' : 'ملء الشاشة'}</button>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-display-muted" aria-live="polite">
        <p>معيار أفضل طالب: {data?.day.ranking_mode === 'completion' ? 'نسبة الإنجاز ثم الأحزاب المجتازة ومتوسط الدرجات' : 'الأحزاب المجتازة ثم متوسط الدرجات'} · أفضل حلقة: نسبة الإنجاز ثم الأحزاب المجتازة</p>
        <div className="flex items-center gap-2"><RefreshCw className={`h-4 w-4 ${view.isFetching ? 'animate-spin' : ''}`} /><span>{!online || view.isError ? 'غير متصل' : view.isFetching ? 'جارٍ التحديث' : 'متصل · تحديث كل 8 ثوانٍ'}</span>{view.dataUpdatedAt > 0 && <span>· آخر مزامنة {riyadhClock.format(new Date(view.dataUpdatedAt))}</span>}</div>
      </div>
      {(view.isError || !online || fullscreenError) && <div role="alert" className="rounded-xl border border-display-gold/60 bg-display-gold/10 p-3 text-center text-display-foreground"><WifiOff className="mx-2 inline h-5 w-5 text-display-gold" />{fullscreenError || (data ? 'انقطع الاتصال؛ تظهر آخر بيانات صحيحة وستُعاد المحاولة تلقائيًا.' : 'تعذّر تحميل شاشة العرض أو أن الرابط غير صحيح')}{!data && <button className="mr-3 underline" onClick={() => view.refetch()}>إعادة المحاولة</button>}</div>}

      {data && <section className="grid gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-2">
          <article className="rounded-3xl border-2 border-display-gold/70 bg-display-card/90 p-6 shadow-2xl">
            <div className="flex items-center gap-3"><Crown className="h-10 w-10 text-display-gold" /><h2 className="text-2xl font-bold">أفضل حلقة</h2></div>
            {data.best_halaqa ? <div className="mt-5"><h3 className="text-3xl font-bold text-display-gold">{data.best_halaqa.halaqa_name}</h3>{tiedHalaqat.length > 1 && <p className="mt-2 text-sm text-display-muted">تعادل في المركز الأول: {tiedHalaqat.map(h => h.halaqa_name).join('، ')}</p>}<div className="mt-5 flex gap-7 text-xl"><span><b className="text-display-glow">{data.best_halaqa.passed}</b> حزبًا مجتازًا</span><span><b className="text-display-glow">{data.best_halaqa.completion}%</b> إنجاز</span></div></div> : <p className="mt-8 text-xl text-display-muted">بانتظار بدء التسميع</p>}
          </article>
          <article className="rounded-3xl border border-display-border/60 bg-display-card/85 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Trophy className="h-6 w-6 text-display-gold" />ترتيب الحلقات</h2><div className="space-y-4">{data.top_halaqat.length ? data.top_halaqat.map(h => <div key={h.halaqa_name}><div className="mb-2 flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${h.rank <= 3 ? 'bg-display-gold text-display-background' : 'bg-display-glow/20 text-display-foreground'}`}>{h.rank}</span><strong className="flex-1">{h.halaqa_name}</strong><span className="text-display-muted">{h.passed} حزب</span><b className="w-16 text-left text-display-glow">{h.completion}%</b></div><div className="h-2 overflow-hidden rounded-full bg-display-track"><div className="h-full rounded-full bg-display-glow transition-[width] duration-500" style={{ width: `${Math.min(100, h.completion)}%` }} /></div></div>) : <p className="py-8 text-center text-display-muted">بانتظار بدء التسميع</p>}</div></article>
        </div>

        <article className="rounded-3xl border border-display-border/60 bg-display-card/85 p-5 shadow-xl xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-2xl font-bold"><Trophy className="h-7 w-7 text-display-gold" />أفضل الطلاب</h2><span className="rounded-full bg-display-glow/15 px-3 py-1 text-sm text-display-muted">نسبة الإنجاز العامة {completion.toFixed(1)}%</span></div>
          {data.best_student ? <div className="mt-4 rounded-2xl border border-display-gold/50 bg-display-gold/10 p-4"><p className="text-sm text-display-gold">الأفضل حاليًا</p><div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1"><strong className="text-2xl text-display-gold">{data.best_student.student_name}</strong><span>{data.best_student.halaqa_name}</span><span>{data.best_student.passed} حزبًا مجتازًا · {data.best_student.completion}% إنجاز</span></div>{tiedStudents.length > 1 && <p className="mt-2 text-sm text-display-muted">تعادل في المركز الأول: {tiedStudents.map(s => s.student_name).join('، ')}</p>}</div> : <p className="mt-4 rounded-2xl border border-display-border/60 p-6 text-center text-xl text-display-muted">بانتظار بدء التسميع</p>}
          <div className="mt-4 space-y-3">{visibleStudents.map(student => <div key={`${student.student_name}-${student.halaqa_name}`} className={`rounded-2xl border p-3 ${student.rank <= 3 ? 'border-display-gold/45 bg-display-gold/5' : 'border-display-border/40 bg-display-background/20'}`}><div className="flex items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${student.rank <= 3 ? 'bg-display-gold text-display-background' : 'bg-display-glow/20 text-display-foreground'}`}>{student.rank}</span><div className="min-w-0 flex-1"><strong className="block truncate text-lg">{student.student_name}</strong><p className="text-sm text-display-muted">{student.halaqa_name}</p></div><div className="text-left"><b className="block text-xl text-display-glow">{student.passed} حزب</b><span className="text-sm text-display-muted">{student.completion}% إنجاز</span></div></div><div className="mr-12 mt-2 h-1.5 overflow-hidden rounded-full bg-display-track"><div className="h-full rounded-full bg-display-glow transition-[width] duration-500" style={{ width: `${Math.min(100, student.completion)}%` }} /></div></div>)}</div>
        </article>
      </section>}

      {data && <section aria-label="البيانات العامة" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-9">
        <StatCard label="حلقات اليوم" value={data.stats.circles} icon={Users} /><StatCard label="الطلاب المشاركون" value={data.stats.registered} icon={Users} /><StatCard label="الحضور" value={data.stats.present} icon={CheckCircle2} /><StatCard label="الأحزاب المقررة" value={data.stats.total} icon={ListChecks} /><StatCard label="الأحزاب المسمّعة" value={data.stats.presented} icon={BookOpen} /><StatCard label="الأحزاب المجتازة" value={data.stats.passed} icon={CheckCircle2} /><StatCard label="الأحزاب الراسبة" value={data.stats.failed} icon={CircleX} /><StatCard label="المتبقي للتسميع" value={data.stats.remaining_recitation} icon={Clock3} /><StatCard label="المتبقي للاجتياز" value={data.stats.remaining_pass} icon={Trophy} />
      </section>}
      {!data && view.isLoading && <div className="rounded-3xl border border-display-border/60 bg-display-card/75 p-20 text-center text-xl text-display-muted">جارٍ تحميل شاشة العرض…</div>}
    </div>
  </main>;
}
