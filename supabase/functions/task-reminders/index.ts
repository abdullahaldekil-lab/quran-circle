import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();
    const results: string[] = [];

    // 1. Fetch tasks with due reminders
    const { data: dueReminders, error: remErr } = await supabase
      .from("staff_tasks")
      .select("*")
      .lte("reminder_at", now)
      .eq("reminder_sent", false)
      .not("status", "eq", "completed")
      .not("status", "eq", "cancelled");

    if (remErr) throw remErr;

    // 2. Send reminder notifications
    for (const task of dueReminders || []) {
      const recipientId = task.assigned_to;
      if (recipientId) {
        await supabase.from("notifications").insert({
          user_id: recipientId,
          title: `⏰ تذكير: ${task.title}`,
          body: `اقترب موعد استحقاق المهمة: ${task.title}`,
          channel: "inApp",
          status: "sent",
          sent_at: now,
          meta_data: { templateCode: "TASK_REMINDER", task_id: task.id },
        });
      }

      // Mark reminder as sent
      await supabase
        .from("staff_tasks")
        .update({ reminder_sent: true })
        .eq("id", task.id);

      results.push(`Reminder sent for task: ${task.id}`);
    }

    // 3. Fetch overdue tasks (due_date passed, not completed/cancelled/overdue)
    const todayDate = new Date().toISOString().split("T")[0];
    const { data: overdueTasks, error: ovErr } = await supabase
      .from("staff_tasks")
      .select("*")
      .lt("due_date", todayDate)
      .not("status", "in", '("completed","cancelled","overdue")');

    if (ovErr) throw ovErr;

    // 4. Mark overdue and notify
    for (const task of overdueTasks || []) {
      await supabase
        .from("staff_tasks")
        .update({ status: "overdue" })
        .eq("id", task.id);

      // Notify assignee
      if (task.assigned_to) {
        await supabase.from("notifications").insert({
          user_id: task.assigned_to,
          title: `🔴 مهمة متأخرة: ${task.title}`,
          body: `تجاوزت المهمة "${task.title}" موعد الاستحقاق`,
          channel: "inApp",
          status: "sent",
          sent_at: now,
          meta_data: { templateCode: "TASK_DUE", task_id: task.id },
        });
      }

      // Notify assigner
      if (task.assigned_by && task.assigned_by !== task.assigned_to) {
        await supabase.from("notifications").insert({
          user_id: task.assigned_by,
          title: `🔴 مهمة متأخرة: ${task.title}`,
          body: `المهمة "${task.title}" لم تُنجَز في الوقت المحدد`,
          channel: "inApp",
          status: "sent",
          sent_at: now,
          meta_data: { templateCode: "TASK_DUE", task_id: task.id },
        });
      }

      results.push(`Marked overdue: ${task.id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: (dueReminders || []).length,
        overdue_marked: (overdueTasks || []).length,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
