import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];

    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, warning_level')
      .eq('status', 'active');

    const results = [];

    for (const student of students || []) {
      const { count } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .eq('status', 'absent')
        .gte('attendance_date', monthStart);

      const absent = count || 0;
      const current = student.warning_level || 0;
      let newLevel = current;

      if (absent >= 3 && current < 1) newLevel = 1;
      if (absent >= 6 && current < 2) newLevel = 2;
      if (absent >= 9 && current < 3) newLevel = 3;
      if (absent >= 10) {
        await supabase.from('students')
          .update({
            status: 'inactive',
            inactivation_reason: 'غياب متكرر',
            inactivation_date: now.toISOString().split('T')[0]
          })
          .eq('id', student.id);
        await supabase.from('student_status_log').insert({
          student_id: student.id,
          new_status: 'inactive',
          reason_category: 'absence',
          reason_detail: `غياب ${absent} أيام`,
          is_system: true
        });
      }

      if (newLevel > current) {
        await supabase.from('students').update({ warning_level: newLevel }).eq('id', student.id);

        const labels = ['', 'أول', 'ثانٍ', 'ثالث'];
        const { data: guardians } = await supabase
          .from('guardian_students')
          .select('guardian_id')
          .eq('student_id', student.id);

        for (const g of guardians || []) {
          await supabase.from('notifications').insert({
            user_id: g.guardian_id,
            title: `إنذار غياب ${labels[newLevel]}`,
            body: `الطالب ${student.full_name} غاب ${absent} أيام هذا الشهر`,
            channel: 'inApp',
            status: 'sent',
            sent_at: now.toISOString()
          });
        }

        results.push({ student: student.full_name, absent, newLevel });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
