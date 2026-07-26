// Automatic student lateness / absence marking and guardian messaging.
//
// Runs every few minutes during the circle window (see the pg_cron schedule).
// Thresholds come from `preparation_config`: `tardiness_minutes` (default 70) and
// `absent_minutes` (default 100), counted from the base prayer.
//
// Three rules protect the teacher's own record:
//   1. Only students with NO attendance row for the day are touched.
//   2. The late stage INSERTs; a unique-violation means the teacher got there first.
//   3. The absent stage only escalates a row this function itself created and that is
//      still 'late'. If the teacher has since changed it, nothing happens.
//
// Idempotency uses the `attendance_auto_marks` unique key, not sentinel strings in a
// free-text notes column.

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

const DEFAULT_TARDINESS = 70;
const DEFAULT_ABSENT = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isAuthorizedCronCall(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // `dryRun` reports what would happen without writing — used for the first run.
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

    if (config.attendance_auto_mark_enabled === false) {
      return json({ skipped: "disabled_in_settings", today });
    }

    const tardinessMin = config.tardiness_minutes ?? DEFAULT_TARDINESS;
    // Absence must never be reachable before lateness.
    const absentMin = Math.max(tardinessMin, config.absent_minutes ?? DEFAULT_ABSENT);

    const times = await getPrayerTimes(supabase, today);
    const prepStart = prepStartFor(config, times, today);
    const elapsed = minutesSince(prepStart, now);

    if (elapsed < tardinessMin) {
      return json({ skipped: "too_early", elapsed, prepStart: prepStart.toISOString(), today });
    }

    const stage: "late" | "absent" = elapsed >= absentMin ? "absent" : "late";

    // Active students that belong to a halaqa.
    const { data: students } = await supabase
      .from("students")
      .select("id, full_name, halaqa_id")
      .eq("status", "active")
      .not("halaqa_id", "is", null);

    if (!students?.length) return json({ stage, elapsed, processed: 0, results: [] });

    // Today's attendance, so teacher-recorded students are left alone.
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, student_id, status")
      .eq("attendance_date", today);
    const existingByStudent = new Map((existing || []).map((r: any) => [r.student_id, r]));

    // Marks this function already made today.
    const { data: priorMarks } = await supabase
      .from("attendance_auto_marks")
      .select("student_id, stage, attendance_id")
      .eq("attendance_date", today);
    const markKey = (studentId: string, s: string) => `${studentId}:${s}`;
    const doneMarks = new Set((priorMarks || []).map((m: any) => markKey(m.student_id, m.stage)));
    const lateMarkRow = new Map(
      (priorMarks || []).filter((m: any) => m.stage === "late").map((m: any) => [m.student_id, m]),
    );

    const results: Record<string, unknown>[] = [];

    for (const student of students) {
      if (doneMarks.has(markKey(student.id, stage))) continue;

      const record: any = existingByStudent.get(student.id);
      const ourLate = lateMarkRow.get(student.id);

      if (record) {
        // A row already exists. The only one we may touch is the 'late' this function
        // wrote earlier today, and only to escalate it to 'absent'. Anything else —
        // a teacher's mark, an approved excuse, even a teacher-recorded absence — is
        // left exactly as it is, and its notification was already sent by whoever
        // recorded it.
        const isOurUnchangedLate =
          stage === "absent" &&
          ourLate &&
          ourLate.attendance_id === record.id &&
          record.status === "late";
        if (!isOurUnchangedLate) continue;
      }

      if (dryRun) {
        results.push({ student: student.full_name, action: `would_mark_${stage}` });
        continue;
      }

      // Claim the action first. A second concurrent tick loses the race here and
      // moves on, so no student is ever notified twice.
      const { data: claim } = await supabase
        .from("attendance_auto_marks")
        .insert({
          student_id: student.id,
          halaqa_id: student.halaqa_id,
          attendance_date: today,
          stage,
          minutes_after_start: elapsed,
        })
        .select("id")
        .maybeSingle();
      if (!claim) continue; // unique violation — already handled

      let attendanceId: string | null = null;

      if (stage === "late") {
        // INSERT (not upsert): if the teacher recorded this student between our read
        // and now, the UNIQUE(student_id, attendance_date) constraint rejects us and
        // their mark stands.
        const { data: inserted } = await supabase
          .from("attendance")
          .insert({
            student_id: student.id,
            halaqa_id: student.halaqa_id,
            attendance_date: today,
            status: "late",
            note: "تسجيل تلقائي: لم يُسجَّل حضوره خلال المهلة",
          })
          .select("id")
          .maybeSingle();
        attendanceId = inserted?.id ?? null;
      } else {
        if (record && ourLate && ourLate.attendance_id === record.id) {
          // Escalate only while it is still the 'late' we wrote.
          const { data: updated } = await supabase
            .from("attendance")
            .update({ status: "absent", note: "تسجيل تلقائي: لم يحضر خلال المهلة" })
            .eq("id", record.id)
            .eq("status", "late")
            .select("id")
            .maybeSingle();
          attendanceId = updated?.id ?? null;
          if (!attendanceId) continue; // teacher changed it in the meantime
        } else {
          const { data: inserted } = await supabase
            .from("attendance")
            .insert({
              student_id: student.id,
              halaqa_id: student.halaqa_id,
              attendance_date: today,
              status: "absent",
              note: "تسجيل تلقائي: لم يحضر خلال المهلة",
            })
            .select("id")
            .maybeSingle();
          attendanceId = inserted?.id ?? null;
        }
      }

      const { data: guardians } = await supabase
        .from("guardian_students")
        .select("guardian_id")
        .eq("student_id", student.id)
        .eq("active", true);

      const recipientIds = (guardians || []).map((g: any) => g.guardian_id).filter(Boolean);
      let notified = 0;
      if (recipientIds.length) {
        const res = await dispatchNotification(supabase, {
          templateCode: stage === "late" ? "STUDENT_LATE" : "STUDENT_ABSENT",
          recipientIds,
          variables: { studentName: student.full_name, date: today },
          metaData: { auto: true, minutes_after_start: elapsed },
        });
        notified = res.count;
      }

      await supabase
        .from("attendance_auto_marks")
        .update({ attendance_id: attendanceId, guardians_notified: notified })
        .eq("id", claim.id);

      results.push({ student: student.full_name, action: `marked_${stage}`, notified });
    }

    return json({ stage, elapsed, dryRun, processed: results.length, results, today });
  } catch (error) {
    console.error("student-attendance-monitor error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
