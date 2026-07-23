// Monitors staff attendance and sends tardiness/absence notifications
// Runs periodically (via cron). Uses preparation_config.tardiness_minutes & absent_minutes
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function hhmmToDateToday(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const dow = now.getDay();
    // Skip weekend (Fri=5, Sat=6)
    if (dow === 5 || dow === 6) {
      return new Response(JSON.stringify({ skipped: 'weekend' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = now.toISOString().split('T')[0];

    // Skip holidays
    const { data: holiday } = await supabase
      .from('holidays').select('id')
      .lte('start_date', today).gte('end_date', today).limit(1).maybeSingle();
    if (holiday) {
      return new Response(JSON.stringify({ skipped: 'holiday' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await supabase
      .from('preparation_config').select('*').limit(1).maybeSingle();
    if (!config) throw new Error('preparation_config missing');

    const tardinessMin = config.tardiness_minutes ?? 70;
    const absentMin = config.absent_minutes ?? 100;

    // Resolve preparation start time
    let prepStart: Date;
    if (config.auto_sync_asr) {
      const { data: prayer } = await supabase.functions.invoke('prayer-times');
      const asr = (prayer as any)?.asr;
      if (!asr) throw new Error('asr time unavailable');
      prepStart = hhmmToDateToday(asr);
      prepStart.setMinutes(prepStart.getMinutes() + (config.offset_minutes ?? 0));
    } else {
      // Fallback: use configured offset from midnight (best effort)
      prepStart = hhmmToDateToday('16:00');
    }

    const minutesSinceStart = Math.floor((now.getTime() - prepStart.getTime()) / 60000);
    if (minutesSinceStart < tardinessMin) {
      return new Response(JSON.stringify({ skipped: 'too_early', minutesSinceStart, prepStart: prepStart.toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All active staff
    const { data: staff } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('is_staff', true)
      .eq('active', true);

    // Today's attendance
    const { data: records } = await supabase
      .from('staff_attendance')
      .select('staff_id, check_in_time, status, notes')
      .eq('attendance_date', today);
    const recMap = new Map((records || []).map((r: any) => [r.staff_id, r]));

    const stage: 'tardiness' | 'absent' = minutesSinceStart >= absentMin ? 'absent' : 'tardiness';
    const results: any[] = [];

    for (const s of staff || []) {
      const rec: any = recMap.get(s.id);
      if (rec?.check_in_time) continue; // already checked in
      if (rec?.status === 'leave' || rec?.status === 'excused' || rec?.status === 'late_excused') continue;

      const flagField = stage === 'tardiness' ? '⏰_tardiness_notified' : '⛔_absent_marked';
      const notes = rec?.notes || '';
      if (notes.includes(flagField)) continue;

      if (stage === 'absent') {
        // Mark absent
        const payload = {
          staff_id: s.id,
          attendance_date: today,
          status: 'absent',
          late_minutes: 0,
          early_leave_minutes: 0,
          total_work_minutes: 0,
          notes: `${notes} ${flagField}`.trim(),
        };
        if (rec) {
          await supabase.from('staff_attendance').update(payload).eq('staff_id', s.id).eq('attendance_date', today);
        } else {
          await supabase.from('staff_attendance').insert(payload);
        }
        await supabase.from('notifications').insert({
          user_id: s.id,
          title: 'تم تسجيل غياب',
          body: `تم تسجيل غيابك تلقائياً لعدم تسجيل الحضور خلال ${absentMin} دقيقة من بداية الدوام`,
          channel: 'inApp',
          status: 'sent',
          sent_at: now.toISOString(),
        });
        results.push({ staff: s.full_name, action: 'marked_absent' });
      } else {
        // Tardiness reminder
        const payload = {
          staff_id: s.id,
          attendance_date: today,
          status: rec?.status || 'absent',
          notes: `${notes} ${flagField}`.trim(),
        };
        if (rec) {
          await supabase.from('staff_attendance').update({ notes: payload.notes }).eq('staff_id', s.id).eq('attendance_date', today);
        } else {
          await supabase.from('staff_attendance').insert(payload);
        }
        await supabase.from('notifications').insert({
          user_id: s.id,
          title: 'تذكير بتسجيل الحضور',
          body: `مضى ${minutesSinceStart} دقيقة على بداية الدوام دون تسجيل حضورك. يرجى المبادرة قبل احتساب الغياب`,
          channel: 'inApp',
          status: 'sent',
          sent_at: now.toISOString(),
        });
        results.push({ staff: s.full_name, action: 'tardiness_reminder' });
      }
    }

    return new Response(JSON.stringify({ stage, minutesSinceStart, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
