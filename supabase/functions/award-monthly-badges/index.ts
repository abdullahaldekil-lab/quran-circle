import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    // 1. Best attendance
    const { data: attData } = await supabase
      .from("attendance")
      .select("student_id, status")
      .gte("attendance_date", monthStart)
      .lte("attendance_date", monthEnd);

    const attMap: Record<string, { present: number; total: number }> = {};
    (attData || []).forEach((a: any) => {
      if (!attMap[a.student_id]) attMap[a.student_id] = { present: 0, total: 0 };
      attMap[a.student_id].total++;
      if (a.status === "present") attMap[a.student_id].present++;
    });

    let bestAttStudent = "";
    let bestAttRate = 0;
    for (const [sid, v] of Object.entries(attMap)) {
      const rate = v.total > 0 ? v.present / v.total : 0;
      if (rate > bestAttRate) { bestAttRate = rate; bestAttStudent = sid; }
    }

    // 2. Best recitation score
    const { data: recData } = await supabase
      .from("recitation_records")
      .select("student_id, total_score")
      .gte("record_date", monthStart)
      .lte("record_date", monthEnd);

    const recMap: Record<string, { sum: number; count: number }> = {};
    (recData || []).forEach((r: any) => {
      if (!recMap[r.student_id]) recMap[r.student_id] = { sum: 0, count: 0 };
      recMap[r.student_id].sum += Number(r.total_score || 0);
      recMap[r.student_id].count++;
    });

    let bestRecStudent = "";
    let bestRecAvg = 0;
    for (const [sid, v] of Object.entries(recMap)) {
      const avg = v.count > 0 ? v.sum / v.count : 0;
      if (avg > bestRecAvg) { bestRecAvg = avg; bestRecStudent = sid; }
    }

    // 3. Most hizb completed
    const { data: examData } = await supabase
      .from("madarij_hizb_exams")
      .select("student_id")
      .eq("passed", true)
      .gte("created_at", monthStart + "T00:00:00")
      .lte("created_at", monthEnd + "T23:59:59");

    const hizbMap: Record<string, number> = {};
    (examData || []).forEach((e: any) => {
      hizbMap[e.student_id] = (hizbMap[e.student_id] || 0) + 1;
    });
    let bestHizbStudent = "";
    let bestHizbCount = 0;
    for (const [sid, count] of Object.entries(hizbMap)) {
      if (count > bestHizbCount) { bestHizbCount = count; bestHizbStudent = sid; }
    }

    // Award badges
    const winners: Record<string, string> = {};
    if (bestAttStudent) winners["best_attendance"] = bestAttStudent;
    if (bestRecStudent) winners["best_recitation"] = bestRecStudent;
    if (bestHizbStudent) winners["most_hizb"] = bestHizbStudent;

    let awarded = 0;
    for (const [badgeType, studentId] of Object.entries(winners)) {
      if (!studentId) continue;
      const { data: exists } = await supabase
        .from("student_badges")
        .select("id")
        .eq("student_id", studentId)
        .eq("badge_type", badgeType)
        .gte("awarded_at", monthStart + "T00:00:00")
        .maybeSingle();

      if (!exists) {
        await supabase.from("student_badges").insert({
          student_id: studentId,
          badge_type: badgeType,
          awarded_at: new Date().toISOString(),
          is_auto: true,
        });
        awarded++;
      }
    }

    return new Response(JSON.stringify({ success: true, awarded, winners }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
