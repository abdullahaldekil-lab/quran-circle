import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { dashboard } from '@/lib/himmah';
import { HimmahWorkspace } from './HimmahDay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logo from '@/assets/huwaylan-logo.jpeg';

/** Registration records name + phone only (pending). Student data opens only after an admin-issued access code. */
export default function HimmahRegister() {
  const { dayId, invite } = useParams();
  const queryClient = useQueryClient();
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [registered, setRegistered] = useState(false);
  const [code, setCode] = useState(() => sessionStorage.getItem(`himmah-code:${dayId}`) || '');
  const view = useQuery({ queryKey: ['himmah-external', dayId, code], enabled: !!dayId && !!code, retry: false, refetchInterval: 8000, queryFn: () => { if (!dayId) throw new Error('الرابط غير صحيح'); return dashboard(dayId, code); } });
  const logout = () => { sessionStorage.removeItem(`himmah-code:${dayId}`); setCode(''); };
  const [ended, setEnded] = useState('');
  useEffect(() => {
    if (!code || !view.isError) return;
    const hadSession = !!queryClient.getQueryData(['himmah-external', dayId, code]);
    queryClient.removeQueries({ queryKey: ['himmah-external', dayId] });
    sessionStorage.removeItem(`himmah-code:${dayId}`); setCode(''); setCodeInput('');
    setEnded(hadSession ? 'انتهت جلستك: أُلغي الكود أو انتهت صلاحية اليوم. أدخل كودًا جديدًا من الإدارة.' : 'الكود غير صحيح أو أوقفته الإدارة أو انتهت صلاحية اليوم');
  }, [view.isError, code, dayId, queryClient]);
  if (view.data && !view.isError) return <main className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto font-cairo" dir="rtl"><div className="flex justify-end mb-3"><Button variant="outline" size="sm" onClick={logout}>خروج</Button></div><HimmahWorkspace data={view.data} token={code} refresh={() => view.refetch()} /></main>;
  return <main className="min-h-screen bg-background p-4 md:p-8 font-cairo" dir="rtl"><div className="max-w-md mx-auto py-8 space-y-8">
    <img src={logo} className="w-24 h-24 mx-auto object-contain" alt="شعار مجمع حويلان" />
    <h1 className="text-2xl font-bold text-himmah text-center">المسمّعون · يوم الهمة</h1>
    <section className="space-y-3 border border-border rounded-lg p-4 bg-card" aria-label="الدخول بالكود">
      <h2 className="font-bold">لديّ كود دخول</h2>
      {ended && <p className="text-destructive" role="alert">{ended}</p>}
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const c = codeInput.trim().toUpperCase(); if (!c) return; setEnded(''); sessionStorage.setItem(`himmah-code:${dayId}`, c); setCode(c); }}>
        <Input aria-label="كود الدخول" dir="ltr" className="font-mono tracking-widest uppercase" maxLength={12} value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="XXXXXXXX" />
        <Button type="submit" disabled={view.isFetching}>{view.isFetching ? 'جارٍ التحقق...' : 'دخول'}</Button>
      </form>
    </section>
    <section className="space-y-3 border border-border rounded-lg p-4 bg-card" aria-label="تسجيل مسمّع جديد">
      <h2 className="font-bold">تسجيل مسمّع جديد</h2>
      {registered ? <p className="text-success font-medium" role="status">تم تسجيلك بحالة «بانتظار التوزيع». ستصلك رسالة بكود الدخول بعد أن تكلّفك الإدارة.</p> :
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (!invite) return; setBusy(true); setError(''); try { const { error: failure } = await supabase.rpc('himmah_register', { _invite: invite, _name: name, _phone: phone }); if (failure) throw failure; setRegistered(true); } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر التسجيل'); } finally { setBusy(false); } }}>
        <Label htmlFor="reviewer-name">الاسم الكامل</Label><Input id="reviewer-name" required minLength={3} maxLength={120} value={name} onChange={e => setName(e.target.value)} />
        <Label htmlFor="reviewer-phone">رقم الجوال</Label><Input id="reviewer-phone" required type="tel" pattern="(05[0-9]{8}|9665[0-9]{8})" placeholder="05xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />
        {error && <p className="text-destructive">{error}</p>}
        <Button className="w-full" disabled={busy} type="submit">{busy ? 'جارٍ التسجيل...' : 'التسجيل'}</Button>
      </form>}
    </section>
  </div></main>;
}
