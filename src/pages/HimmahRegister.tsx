import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { dashboard, randomToken } from '@/lib/himmah';
import { HimmahWorkspace } from './HimmahDay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logo from '@/assets/huwaylan-logo.jpeg';

export default function HimmahRegister() {
  const { dayId, invite } = useParams(); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(() => sessionStorage.getItem(`himmah-access:${dayId}`) || '');
  const view = useQuery({ queryKey: ['himmah-external', dayId, token], enabled: !!dayId && !!token, retry: false, queryFn: () => { if (!dayId) throw new Error('الرابط غير صحيح'); return dashboard(dayId, token); } });
  return <main className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto font-cairo" dir="rtl">{view.data ? <HimmahWorkspace data={view.data} token={token} refresh={() => view.refetch()} /> : <div className="max-w-md mx-auto py-12 space-y-6"><img src={logo} className="w-24 h-24 mx-auto object-contain" alt="شعار مجمع حويلان" /><h1 className="text-2xl font-bold text-himmah text-center">تسجيل المسمّع · يوم الهمة</h1>{view.isError && <><p className="text-destructive">انتهت جلسة الوصول أو أوقفتها الإدارة</p><Button variant="outline" onClick={() => { sessionStorage.removeItem(`himmah-access:${dayId}`); setToken(''); }}>التسجيل مجددًا</Button></>}{!token && <form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (!invite) return; setBusy(true); setError(''); try { const generated = randomToken(); const { error: failure } = await supabase.rpc('himmah_register', { _invite: invite, _name: name, _phone: phone, _token: generated }); if (failure) throw failure; sessionStorage.setItem(`himmah-access:${dayId}`, generated); setToken(generated); } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر التسجيل'); } finally { setBusy(false); } }}><Label htmlFor="reviewer-name">الاسم الكامل</Label><Input id="reviewer-name" required minLength={3} maxLength={120} value={name} onChange={e => setName(e.target.value)} /><Label htmlFor="reviewer-phone">رقم الجوال</Label><Input id="reviewer-phone" required type="tel" pattern="(05[0-9]{8}|9665[0-9]{8})" placeholder="05xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />{error && <p className="text-destructive">{error}</p>}<Button className="w-full" disabled={busy} type="submit">{busy ? 'جارٍ التسجيل...' : 'التسجيل'}</Button></form>}{view.isFetching && <p>جارٍ تحميل اليوم...</p>}</div>}</main>;
}