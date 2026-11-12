import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { RefreshCw, Users, BookOpen, CircleCheck, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateSmart } from '@/lib/hijri';
import logo from '@/assets/huwaylan-logo.jpeg';

type DisplayStudent = { student_name: string; halaqa_name: string; total: number; presented: number; passed: number; average_score: number; completion: number };
type DisplayHalaqa = { halaqa_name: string; registered: number; present: number; total: number; presented: number; passed: number; completion: number };
type DisplayData = {
  day: { id: string; title: string; day_date: string; logo_url: string | null; ranking_mode: 'passed' | 'completion' };
  stats: { registered: number; present: number; total: number; presented: number; passed: number };
  best_student: DisplayStudent | null;
  best_halaqa: DisplayHalaqa | null;
  top_students: DisplayStudent[];
  top_halaqat: DisplayHalaqa[];
  server_now: string;
};

export default function HimmahDisplay() {
  const { dayId = '', displayKey = '' } = useParams();
  const view = useQuery({
    queryKey: ['himmah-public-display', dayId, displayKey],
    enabled: !!dayId && !!displayKey,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('himmah_public_display', { _day: dayId, _key: displayKey });
      if (error) throw error;
      return data as unknown as DisplayData;
    },
  });
  const data = view.data;
  const failed = data ? data.stats.presented - data.stats.passed : 0;
  const remaining = data ? data.stats.total - data.stats.presented : 0;
  const completion = data?.stats.total ? data.stats.passed / data.stats.total * 100 : 0;
  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground font-cairo p-5 md:p-8" dir="rtl">
    <img src={data?.day.logo_url || logo} alt="" aria-hidden="true" className="fixed inset-0 m-auto w-[65vmin] h-[65vmin] object-contain opacity-[0.055] pointer-events-none" />
    <div className="relative z-10 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-4"><img src={data?.day.logo_url || logo} alt="شعار المجمع" className="w-20 h-20 object-contain" /><div><p className="text-lg text-muted-foreground">مجمع حلق جامع حويلان</p><h1 className="text-3xl md:text-4xl font-bold text-himmah">{data?.day.title || 'يوم السرد – يوم الهمة'}</h1><p className="mt-1 text-muted-foreground">{data ? formatDateSmart(data.day.day_date) : 'جارٍ تحميل البيانات'}</p></div></div>
        <div className="text-left text-sm text-muted-foreground"><RefreshCw className={`w-5 h-5 mb-2 ${view.isFetching ? 'animate-spin' : ''}`} /><p>تحديث تلقائي كل 8 ثوانٍ · {view.isError ? 'غير متصل' : view.isFetching ? 'جارٍ التحديث' : 'متصل'}</p>{view.dataUpdatedAt > 0 && <p>{new Date(view.dataUpdatedAt).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</p>}</div>
      </header>
      {view.isError && <div className="border border-destructive rounded-lg p-4 text-center" role="alert"><p className="text-destructive font-bold">{data ? 'انقطع الاتصال؛ تظهر آخر بيانات صحيحة وستُعاد المحاولة تلقائيًا.' : 'تعذّر تحميل شاشة العرض أو أن الرابط غير صحيح'}</p><button className="mt-2 underline" onClick={() => view.refetch()}>إعادة المحاولة</button></div>}
      {data && <p className="text-sm text-muted-foreground text-center">معيار أفضل طالب: {data.day.ranking_mode === 'completion' ? 'نسبة الإنجاز ثم الأحزاب المجتازة ومتوسط الدرجات' : 'الأحزاب المجتازة ثم متوسط الدرجات'} · أفضل حلقة: الأعلى في نسبة إنجاز أحزابها</p>}
      {data && <>
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="بيانات عامة">
          {[['الطلاب', data.stats.registered, Users], ['الحضور', data.stats.present, Users], ['الأحزاب المسمّاة', data.stats.presented, BookOpen], ['المجتازة', data.stats.passed, CircleCheck], ['الراسبة', failed, BookOpen], ['المتبقية', remaining, BookOpen]].map(([label, value, Icon]) => { const I = Icon as typeof Users; return <div key={String(label)} className="bg-card/90 border border-border rounded-xl p-4 shadow-sm"><I className="w-5 h-5 text-himmah" /><p className="text-sm text-muted-foreground mt-3">{String(label)}</p><strong className="block text-3xl text-himmah mt-1">{Number(value)}</strong></div>; })}
        </section>
        <section className="grid md:grid-cols-2 gap-5">
          <div className="bg-card/95 border-2 border-primary rounded-2xl p-6"><div className="flex items-center gap-3"><Trophy className="w-9 h-9 text-himmah" /><h2 className="text-2xl font-bold">أفضل طالب</h2></div>{data.best_student ? <div className="mt-5"><h3 className="text-3xl font-bold text-himmah">{data.best_student.student_name}</h3><p className="text-lg mt-2">{data.best_student.halaqa_name}</p><div className="flex gap-6 mt-5 text-lg"><span>{data.best_student.passed} حزب مجتاز</span><span>{data.best_student.completion}% إنجاز</span><span>{data.best_student.average_score} متوسط</span></div></div> : <p className="mt-5 text-muted-foreground">لم تُسجّل نتائج بعد</p>}</div>
          <div className="bg-card/95 border-2 border-primary rounded-2xl p-6"><div className="flex items-center gap-3"><Trophy className="w-9 h-9 text-himmah" /><h2 className="text-2xl font-bold">أفضل حلقة</h2></div>{data.best_halaqa ? <div className="mt-5"><h3 className="text-3xl font-bold text-himmah">{data.best_halaqa.halaqa_name}</h3><div className="flex gap-6 mt-5 text-lg"><span>{data.best_halaqa.passed} حزب مجتاز</span><span>{data.best_halaqa.completion}% إنجاز</span><span>{data.best_halaqa.present} حضور</span></div></div> : <p className="mt-5 text-muted-foreground">لم تُسجّل نتائج بعد</p>}</div>
        </section>
        <section className="grid lg:grid-cols-2 gap-5">
          <div className="bg-card/95 border border-border rounded-xl p-5"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">الطلاب المتقدمون</h2><span className="text-sm text-muted-foreground">نسبة الإنجاز العامة {completion.toFixed(1)}%</span></div><div className="space-y-3">{data.top_students.map((student, i) => <div key={`${student.student_name}-${i}`} className="flex items-center gap-4 border-b border-border pb-3 last:border-0"><span className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">{i + 1}</span><div className="flex-1"><strong>{student.student_name}</strong><p className="text-sm text-muted-foreground">{student.halaqa_name}</p></div><span className="font-bold text-himmah">{student.passed} حزب</span></div>)}</div></div>
          <div className="bg-card/95 border border-border rounded-xl p-5"><h2 className="text-xl font-bold mb-4">ترتيب الحلقات</h2><div className="space-y-3">{data.top_halaqat.map((halaqa, i) => <div key={`${halaqa.halaqa_name}-${i}`} className="flex items-center gap-4 border-b border-border pb-3 last:border-0"><span className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">{i + 1}</span><strong className="flex-1">{halaqa.halaqa_name}</strong><span>{halaqa.passed} حزب</span><span className="font-bold text-himmah">{halaqa.completion}%</span></div>)}</div></div>
        </section>
      </>}
    </div>
  </main>;
}
