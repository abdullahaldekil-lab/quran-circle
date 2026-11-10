// Sends a Himmah reviewer access code through the project's configured WhatsApp channel.
// When the channel is not configured it reports configured:false so the admin copies the message manually.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

// Same headers as the project's other functions, so the browser preflight behaves identically.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const Body = z.object({ day_id: z.string().uuid(), reviewer_id: z.string().uuid(), message: z.string().min(10).max(1000) });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'غير مصرح' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(auth.slice(7));
    if (claimsError || !claims?.claims?.sub) return json({ error: 'غير مصرح' }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { day_id, reviewer_id, message } = parsed.data;
    // Authorised read: only Himmah admins receive reviewer phone numbers from this RPC.
    const { data, error } = await supabase.rpc('himmah_dashboard', { _day: day_id });
    if (error) return json({ error: error.message }, 403);
    const dash = data as { can_manage: boolean; reviewers: { id: string; phone: string }[] };
    if (!dash.can_manage) return json({ error: 'للإدارة فقط' }, 403);
    const phone = dash.reviewers.find(r => r.id === reviewer_id)?.phone;
    if (!phone) return json({ error: 'لا يوجد جوال للمسمّع' }, 400);
    const url = Deno.env.get('WHATSAPP_API_URL'); const token = Deno.env.get('WHATSAPP_API_TOKEN');
    if (!url || !token) return json({ configured: false });
    const to = phone.startsWith('05') ? `966${phone.slice(1)}` : phone;
    const res = await fetch(`${url}/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to, message }) });
    if (!res.ok) { const details = await res.text(); console.error(`WhatsApp send failed [${res.status}]: ${details}`); return json({ configured: true, sent: false, status: res.status, details }, 502); }
    return json({ configured: true, sent: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'خطأ' }, 500);
  }
});
