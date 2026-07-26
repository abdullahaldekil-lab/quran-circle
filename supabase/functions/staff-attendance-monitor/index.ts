// Staff tardiness / absence monitoring.
//
// Runs on a schedule. Uses `preparation_config.tardiness_minutes` and `absent_minutes`
// against the start of the working day (base prayer + offset).
//
// Two defects fixed here:
//   - `hhmmToDateToday` used `Date.setHours` on a UTC runtime, so a Riyadh prayer time
//     was interpreted three hours off. It never showed because nothing was scheduled.
//   - Idempotency was done by appending emoji sentinels into the free-text `notes`
//     column and substring-matching them, so any manual edit of the notes either
//     re-fired the notification or silenced it for good. Now a unique key does it.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchNotification, isAuthorizedCronCall } from "../_shared/notify.ts";
import {
  getPrayerTimes,
  isWeekend,
  minutesSince,
  prepStartFor,
  riyadhToday,
} from "../_shared/prayer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isAuthorizedCronCall(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dryRun === true;
    } catch {
      // no body is fine
    }

    const now = new Date();
    const today = riyadhToday(now);

    if (isWeekend(now)) return json({ skipped: "weekend", today });

    const { data: holiday } = await supabase
      .from("holidays")
      .select("id")
      .lte("start_date", today)
      .gte("end_date", today)
      .limit(1)
      .maybeSingle();
    if (holiday) return json({ skipped: "holiday", today });

    const { data: config } = await supabase
      .from("preparation_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!config) return json({ error: "preparation_config missing" }, 500);

    const tardinessMin = config.tardiness_minutes ?? 70;
    const absentMin = Math.max(tardinessMin, config.absent_minutes ?? 100);

    const times = await getPrayerTimes(supabase, today);
    const prepStart = prepStartFor(config, times, today);
    const elapsed = minutesSince(prepStart, now);

    if (elapsed < tardinessMin) {
      return json({ skipped: "too_early", elapsed, prepStart: prepStart.toISOString(), today });
    }

    const stage: "late" | "absent" = elapsed >= absentMin ? "absent" : "late";

    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_staff", true)
      .eq("active", true);

    if (!staff?.length) return json({ stage, elapsed, processed: 0, results: [] });

    const { data: records } = await supabase
      .from("staff_attendance")
      .select("staff_id, check_in_time, status")
      .eq("attendance_date", today);
    const recMap = new Map((records || []).map((r: any) => [r.staff_id, r]));

    const { data: priorMarks } = await supabase
      .from("staff_attendance_auto_marks")
      .select("staff_id, stage")
      .eq("attendance_date", today);
    const done = new Set((priorMarks || []).map((m: any) => `${m.staff_id}:${m.stage}`));

    const results: Record<string, unknown>[] = [];

    for (const member of staff) {
      if (done.has(`${member.id}:${stage}`)) continue;

      const rec: any = recMap.get(member.id);
      if (rec?.check_in_time) continue; // already checked in
      if (rec && ["leave", "excused", "late_excused"].includes(rec.status)) continue;

      if (dryRun) {
        results.push({ staff: member.full_name, action: `would_${stage}` });
        continue;
      }

      // Claim first — a concurrent tick loses the race and skips.
      const { data: claim } = await supabase
        .from("staff_attendance_auto_marks")
        .insert({
          staff_id: member.id,
          attendance_date: today,
          stage,
          minutes_after_start: elapsed,
        })
        .select("id")
        .maybeSingle();
      if (!claim) continue;

      if (stage === "absent") {
        const payload = {
          staff_id: member.id,
          attendance_date: today,
          status: "absent",
          late_minutes: 0,
          early_leave_minutes: 0,
          total_work_minutes: 0,
        };
        if (rec) {
          await supabase
            .from("staff_attendance")
            .update(payload)
            .eq("staff_id", member.id)
            .eq("attendance_date", today);
        } else {
          await supabase.from("staff_attendance").insert(payload);
        }
        await dispatchNotification(supabase, {
          templateCode: "STAFF_ABSENT",
          recipientIds: [member.id],
          variables: {
            staffName: member.full_name,
            date: today,
            minutes: String(absentMin),
          },
          metaData: { auto: true, stage },
        });
        results.push({ staff: member.full_name, action: "marked_absent" });
      } else {
        await dispatchNotification(supabase, {
          templateCode: "STAFF_LATE",
          recipientIds: [member.id],
          variables: {
            staffName: member.full_name,
            date: today,
            minutes: String(elapsed),
          },
          metaData: { auto: true, stage },
        });
        results.push({ staff: member.full_name, action: "tardiness_reminder" });
      }
    }

    return json({ stage, elapsed, dryRun, processed: results.length, results, today });
  } catch (error) {
    console.error("staff-attendance-monitor error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
