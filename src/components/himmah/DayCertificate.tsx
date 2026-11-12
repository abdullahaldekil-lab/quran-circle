import logo from '@/assets/huwaylan-logo.jpeg';
import { formatDateSmart } from '@/lib/hijri';
import { appreciation, localDate, type HimmahDay, type summarize } from '@/lib/himmah';

export default function DayCertificate({ day, row }: { day: HimmahDay; row: ReturnType<typeof summarize>[number] }) {
  return <article className="himmah-certificate relative overflow-hidden bg-card text-card-foreground border-4 border-primary px-12 py-8 mx-auto font-cairo" dir="rtl">
    <img src={day.logo_url || logo} alt="" aria-hidden="true" className="absolute inset-0 m-auto w-[420px] h-[420px] object-contain opacity-[0.045] pointer-events-none" />
    <div className="relative z-10 flex h-full flex-col justify-between gap-5">
      <header className="grid grid-cols-[120px_1fr_120px] items-center gap-5 border-b-2 border-primary pb-5">
        <div className="flex justify-start">{day.association_logo_url ? <img src={day.association_logo_url} alt="شعار الجمعية" className="w-24 h-24 object-contain" /> : <span className="text-xs text-muted-foreground">شعار الجمعية</span>}</div>
        <div className="text-center"><p className="text-lg text-muted-foreground">يوم السرد</p><h2 className="text-2xl font-bold text-primary">مجمع حلق جامع حويلان</h2><h1 className="text-4xl font-bold mt-3">{day.certificate_title || 'شهادة شكر وتقدير'}</h1><p className="mt-2 text-lg">{day.title} · {formatDateSmart(day.day_date)}</p></div>
        <img src={day.logo_url || logo} alt="شعار المجمع" className="w-28 h-28 object-contain justify-self-end rounded-full" />
      </header>
      <div className="text-center space-y-4 py-3">
        <p className="text-xl">تبارك إدارة المجمع للطالب</p>
        <h2 className="text-5xl font-bold text-primary leading-tight">{row.student_name}</h2>
        <p className="text-xl max-w-4xl mx-auto leading-relaxed">من حلقة <strong>{row.halaqa_name}</strong> {day.certificate_note || <>نظير تميّزه في يوم السرد القرآني وإتمامه سرد <strong>{row.results.length}</strong> أحزاب من كتاب الله، سائلين الله له مزيدًا من التفوق والنجاح.</>}</p>
        <div className="flex justify-center gap-8 py-2">{[['نسبة الإنجاز', `${row.completion.toFixed(1)}%`], ['التقدير', appreciation(row.completion, day.grade_bounds)], ['الأحزاب المجتازة', row.passed.length]].map(([label, value]) => <div key={String(label)} className="w-32 h-32 rounded-full border-4 border-primary flex flex-col items-center justify-center bg-card"><span className="text-sm">{label}</span><strong className="text-xl text-primary mt-2">{value}</strong></div>)}</div>
        <p className="text-base text-muted-foreground">أرقام الأحزاب المجتازة: {row.passed.map(a => a.hizb).sort((a, b) => a - b).join('، ') || '—'}</p>
      </div>
      <p className="text-center text-sm text-muted-foreground">تاريخ الإصدار: {formatDateSmart(localDate())}</p><footer className="grid grid-cols-3 items-end gap-5 border-t-2 border-primary pt-5 text-center"><div><p>معلم الحلقة</p><strong className="text-lg">{row.teacher_name || 'الاسم غير مضاف'}</strong></div>{day.stamp_url ? <img src={day.stamp_url} alt="ختم المجمع" className="w-24 h-24 object-contain mx-auto" /> : <p className="text-muted-foreground text-sm">الختم الرسمي</p>}<div><p>مدير المجمع</p><strong className="text-lg">{day.manager_name || 'الاسم غير مضاف'}</strong></div></footer>
    </div>
  </article>;
}
