// Task reminders and overdue marking for staff.
//
// Notifications now go through the shared dispatcher instead of writing straight into
// `notifications`, so per-user preferences and the WhatsApp channel are honoured — the
// direct inserts bypassed both, which is why staff only ever saw in-app messages.
//
// A `sinceDays` guard bounds the first scheduled run: without it, switching cron on
// would mark every historical task overdue and fire a burst of notifications.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { dispatchNotification, isAuthorizedCronCall } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Ignore anything older than this many days, so a first run cannot avalanche. */
const DEFAULT_SINCE_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorizedCronCall(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let sinceDays = DEFAULT_SINCE_DAYS;
    let dryRun = false;
    try {
      const body = await req.json();
      if (typeof body?.sinceDays === "number") sinceDays = body.sinceDays;
      dryRun = body?.dryRun === true;
    } catch {
      // no body is fine
    }

    const now = new Date().toISOString();
    const todayDate = now.split("T")[0];
    const since = new Date(Date.now() - sinceDays * 86400000).toISOString().split("T")[0];
    const results: string[] = [];

    // 1. Reminders that have come due
    const { data: dueReminders, error: remErr } = await supabase
      .from("staff_tasks")
      .select("*")
      .lte("reminder_at", now)
      .gte("reminder_at", since)
      .eq("reminder_sent", false)
      .not("status", "eq", "completed")
      .not("status", "eq", "cancelled");

    if (remErr) throw remErr;

    for (const task of dueReminders || []) {
      if (dryRun) {
        results.push(`would remind: ${task.id}`);
        continue;
      }
      if (task.assigned_to) {
        await dispatchNotification(supabase, {
          templateCode: "TASK_REMINDER",
          recipientIds: [task.assigned_to],
          variables: { title: task.title, dueDate: task.due_date || "—" },
          metaData: { task_id: task.id },
        });
      }

      await supabase.from("staff_tasks").update({ reminder_sent: true }).eq("id", task.id);
      results.push(`Reminder sent for task: ${task.id}`);
    }

    // 2. Overdue tasks
    const { data: overdueTasks, error: ovErr } = await supabase
      .from("staff_tasks")
      .select("*")
      .lt("due_date", todayDate)
      .gte("due_date", since)
      .not("status", "in", '("completed","cancelled","overdue")');

    if (ovErr) throw ovErr;

    for (const task of overdueTasks || []) {
      if (dryRun) {
        results.push(`would mark overdue: ${task.id}`);
        continue;
      }
      await supabase.from("staff_tasks").update({ status: "overdue" }).eq("id", task.id);

      const recipients = [task.assigned_to, task.assigned_by].filter(
        (id, i, arr) => id && arr.indexOf(id) === i,
      ) as string[];

      if (recipients.length) {
        await dispatchNotification(supabase, {
          templateCode: "TASK_DUE",
          recipientIds: recipients,
          variables: { title: task.title, dueDate: task.due_date || "—" },
          metaData: { task_id: task.id },
        });
      }

      results.push(`Marked overdue: ${task.id}`);
    }

    return json({
      success: true,
      dryRun,
      sinceDays,
      reminders_sent: (dueReminders || []).length,
      overdue_marked: (overdueTasks || []).length,
      details: results,
    });
  } catch (error) {
    console.error("task-reminders error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
