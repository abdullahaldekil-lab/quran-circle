// Staff QR + GPS check-in / check-out
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { code, latitude, longitude, action } = body as {
      code: string; latitude: number; longitude: number; action: 'check_in' | 'check_out';
    };
    if (!code || typeof latitude !== 'number' || typeof longitude !== 'number' || !['check_in', 'check_out'].includes(action)) {
      return new Response(JSON.stringify({ error: 'بيانات ناقصة' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify staff
    const { data: profile } = await admin
      .from('profiles').select('id, full_name, is_staff, active').eq('id', userId).maybeSingle();
    if (!profile?.is_staff || !profile?.active) {
      return new Response(JSON.stringify({ error: 'غير مصرح — الحساب ليس موظفاً نشطاً' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify QR
    const { data: qr } = await admin
      .from('staff_checkin_qr').select('*').eq('code', code).eq('active', true).maybeSingle();
    if (!qr) {
      return new Response(JSON.stringify({ error: 'رمز QR غير صالح' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const distance = haversineMeters(Number(qr.latitude), Number(qr.longitude), latitude, longitude);
    if (distance > (qr.radius_meters || 100)) {
      return new Response(JSON.stringify({
        error: 'أنت خارج نطاق الموقع المعتمد',
        distance_meters: Math.round(distance),
        allowed_radius: qr.radius_meters,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Existing record
    const { data: existing } = await admin
      .from('staff_attendance').select('*')
      .eq('staff_id', userId).eq('attendance_date', today).maybeSingle();

    // Determine status via preparation_config
    const { data: config } = await admin.from('preparation_config').select('*').limit(1).maybeSingle();
    let status: string = existing?.status || 'present';
    let lateMinutes = existing?.late_minutes || 0;

    if (action === 'check_in') {
      if (existing?.check_in_time) {
        return new Response(JSON.stringify({ error: 'الحضور مسجل مسبقاً' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (config?.auto_sync_asr) {
        const { data: prayer } = await admin.functions.invoke('prayer-times');
        const asr = (prayer as any)?.asr;
        if (asr) {
          const [h, m] = asr.split(':').map(Number);
          const prep = new Date(now);
          prep.setHours(h, m, 0, 0);
          prep.setMinutes(prep.getMinutes() + (config.offset_minutes ?? 0));
          const graceMin = config.late_tolerance_minutes ?? 10;
          const diffMin = Math.floor((now.getTime() - prep.getTime()) / 60000);
          if (diffMin <= 0) { status = 'present'; lateMinutes = 0; }
          else if (diffMin <= graceMin) { status = 'present'; lateMinutes = diffMin; }
          else { status = 'late'; lateMinutes = diffMin; }
        }
      }
      const payload = {
        staff_id: userId, attendance_date: today,
        check_in_time: now.toISOString(),
        status, late_minutes: lateMinutes,
        source: 'qr', qr_code: code, latitude, longitude,
      };
      if (existing) {
        await admin.from('staff_attendance').update(payload).eq('id', existing.id);
      } else {
        await admin.from('staff_attendance').insert(payload);
      }
    } else {
      // check_out
      if (!existing?.check_in_time) {
        return new Response(JSON.stringify({ error: 'لم يتم تسجيل الحضور بعد' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const checkIn = new Date(existing.check_in_time);
      const totalWork = Math.round((now.getTime() - checkIn.getTime()) / 60000);
      await admin.from('staff_attendance').update({
        check_out_time: now.toISOString(),
        total_work_minutes: totalWork,
      }).eq('id', existing.id);
    }

    return new Response(JSON.stringify({
      success: true, action, status, distance_meters: Math.round(distance),
      staff_name: profile.full_name, qr_label: qr.label,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
