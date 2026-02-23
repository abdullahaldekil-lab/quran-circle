import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  templateCode: string;
  recipientIds: string[];
  variables?: Record<string, string>;
  metaData?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { templateCode, recipientIds, variables = {}, metaData = {} } =
      (await req.json()) as NotificationPayload;

    // Get template
    const { data: template, error: tplErr } = await adminClient
      .from("notification_templates")
      .select("*")
      .eq("code", templateCode)
      .eq("is_active", true)
      .maybeSingle();

    if (tplErr || !template) {
      return new Response(
        JSON.stringify({ error: "Template not found or inactive", code: templateCode }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve variables in title/body
    const resolveVars = (text: string, vars: Record<string, string>) => {
      let result = text;
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
      }
      return result;
    };

    const resolvedTitle = resolveVars(template.title, variables);
    const resolvedBody = resolveVars(template.body, variables);
    const defaultChannels: string[] = template.default_channels || ["inApp"];

    // Category mapping for preferences
    const categoryPrefMap: Record<string, string> = {
      academic: "academic_notifications",
      attendance: "attendance_notifications",
      system: "system_notifications",
      rewards: "rewards_notifications",
    };
    const prefColumn = categoryPrefMap[template.category] || "system_notifications";

    const notifications: Array<{
      user_id: string;
      template_id: string;
      title: string;
      body: string;
      channel: string;
      status: string;
      meta_data: Record<string, unknown>;
    }> = [];

    for (const userId of recipientIds) {
      // Get user preferences
      const { data: prefs } = await adminClient
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Default preferences if none exist
      const userPrefs = prefs || {
        enable_in_app: true,
        enable_email: false,
        enable_whatsapp: false,
        academic_notifications: true,
        attendance_notifications: true,
        system_notifications: true,
        rewards_notifications: true,
      };

      // Check if category is enabled
      if (!(userPrefs as Record<string, unknown>)[prefColumn]) continue;

      const channelMap: Record<string, string> = {
        inApp: "enable_in_app",
        email: "enable_email",
        whatsapp: "enable_whatsapp",
      };

      for (const channel of defaultChannels) {
        const prefKey = channelMap[channel];
        if (prefKey && (userPrefs as Record<string, unknown>)[prefKey]) {
          let status = "pending";

          if (channel === "inApp") {
            status = "sent"; // In-app delivered immediately
          }
          // email and whatsapp stay pending for future processing

          notifications.push({
            user_id: userId,
            template_id: template.id,
            title: resolvedTitle,
            body: resolvedBody,
            channel,
            status,
            meta_data: { ...metaData, templateCode },
          });
        }
      }
    }

    if (notifications.length > 0) {
      const { error: insertErr } = await adminClient
        .from("notifications")
        .insert(notifications);

      if (insertErr) {
        console.error("Insert error:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to create notifications", details: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: notifications.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
