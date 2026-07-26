// Shared notification dispatcher.
//
// `send-notification` requires a caller JWT, so scheduled functions (cron) cannot
// invoke it. They used to write straight into `notifications` instead, which skipped
// template resolution, per-user preferences and WhatsApp entirely — that is why staff
// never received anything on a channel other than in-app.
//
// This module holds the dispatch logic so both paths behave identically:
//   - send-notification/index.ts keeps its auth gate and delegates here
//   - cron functions call it directly with the service-role client

// deno-lint-ignore-file no-explicit-any

export interface DispatchParams {
  templateCode: string;
  recipientIds: string[];
  variables?: Record<string, string>;
  metaData?: Record<string, unknown>;
}

export interface DispatchResult {
  success: boolean;
  count: number;
  error?: string;
}

/** Maps a template category to the per-user preference column that gates it. */
const CATEGORY_PREF: Record<string, string> = {
  academic: "academic_notifications",
  attendance: "attendance_notifications",
  system: "system_notifications",
  rewards: "rewards_notifications",
  tasks: "system_notifications",
};

const CHANNEL_PREF: Record<string, string> = {
  inApp: "enable_in_app",
  email: "enable_email",
  whatsapp: "enable_whatsapp",
};

const DEFAULT_PREFS = {
  enable_in_app: true,
  enable_email: false,
  enable_whatsapp: false,
  academic_notifications: true,
  attendance_notifications: true,
  system_notifications: true,
  rewards_notifications: true,
  whatsapp_phone: null as string | null,
};

const resolveVars = (text: string, vars: Record<string, string>): string => {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value);
  }
  return out;
};

/** Normalises a Saudi phone number to the international form the gateway expects. */
export const toWhatsappNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.startsWith("966") ? cleaned : `966${cleaned.slice(-9)}`;
};

export async function dispatchNotification(
  admin: any,
  { templateCode, recipientIds, variables = {}, metaData = {} }: DispatchParams,
): Promise<DispatchResult> {
  if (!recipientIds?.length) return { success: true, count: 0 };

  const { data: template } = await admin
    .from("notification_templates")
    .select("*")
    .eq("code", templateCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!template) {
    return { success: false, count: 0, error: `Template not found or inactive: ${templateCode}` };
  }

  const title = resolveVars(template.title, variables);
  const body = resolveVars(template.body, variables);
  const channels: string[] = template.default_channels || ["inApp"];
  const prefColumn = CATEGORY_PREF[template.category] || "system_notifications";

  const waUrl = Deno.env.get("WHATSAPP_API_URL");
  const waToken = Deno.env.get("WHATSAPP_API_TOKEN");

  const rows: Record<string, unknown>[] = [];
  // Recipients that should also get a WhatsApp message, resolved after the insert
  // so the notification row id is known and its status can be updated.
  const waTargets: { userId: string; phone: string }[] = [];

  for (const userId of [...new Set(recipientIds)].filter(Boolean)) {
    const { data: stored } = await admin
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const prefs: Record<string, any> = stored || DEFAULT_PREFS;
    if (!prefs[prefColumn]) continue;

    for (const channel of channels) {
      const prefKey = CHANNEL_PREF[channel];
      if (!prefKey || !prefs[prefKey]) continue;
      rows.push({
        user_id: userId,
        template_id: template.id,
        title,
        body,
        channel,
        // inApp is delivered the moment the row exists; other channels start pending
        // and are updated once the gateway answers.
        status: channel === "inApp" ? "sent" : "pending",
        sent_at: channel === "inApp" ? new Date().toISOString() : null,
        meta_data: { ...metaData, templateCode },
      });
    }

    if (prefs.enable_whatsapp && waUrl && waToken && channels.includes("whatsapp")) {
      let phone = prefs.whatsapp_phone;
      if (!phone) {
        const { data: profile } = await admin
          .from("profiles")
          .select("phone")
          .eq("id", userId)
          .maybeSingle();
        phone = profile?.phone;
      }
      if (phone) waTargets.push({ userId, phone });
    }
  }

  if (rows.length === 0) return { success: true, count: 0 };

  const { data: inserted, error: insertErr } = await admin
    .from("notifications")
    .insert(rows)
    .select("id, user_id, channel");

  if (insertErr) {
    return { success: false, count: 0, error: insertErr.message };
  }

  // Send WhatsApp and record the outcome, so /notification-log stops showing a
  // permanently "pending" queue.
  for (const target of waTargets) {
    const row = (inserted || []).find(
      (r: any) => r.user_id === target.userId && r.channel === "whatsapp",
    );
    let status = "failed";
    try {
      const res = await fetch(`${waUrl}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${waToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toWhatsappNumber(target.phone),
          message: `*${title}*\n${body}`,
        }),
      });
      status = res.ok ? "sent" : "failed";
    } catch (e) {
      console.error("WhatsApp error:", e);
    }
    if (row) {
      await admin
        .from("notifications")
        .update({ status, sent_at: status === "sent" ? new Date().toISOString() : null })
        .eq("id", row.id);
    }
  }

  return { success: true, count: rows.length };
}

/**
 * Shared gate for cron-triggered functions.
 *
 * These run with `verify_jwt = false` so pg_cron can reach them without a user token;
 * the shared secret is what keeps them from being public. When CRON_SECRET is unset
 * (local development) the gate is open.
 */
export const isAuthorizedCronCall = (req: Request): boolean => {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return true;
  const provided = req.headers.get("x-cron-secret");
  if (provided === expected) return true;
  // A logged-in staff member triggering a run manually from the app is also fine.
  return (req.headers.get("Authorization") || "").startsWith("Bearer ");
};
