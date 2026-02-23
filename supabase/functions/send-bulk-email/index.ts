import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

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
    const { recipientIds, subject, body } = await req.json();

    if (!recipientIds?.length || !subject || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user emails
    const emailResults: { userId: string; email: string }[] = [];
    for (const userId of recipientIds) {
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        emailResults.push({ userId, email: userData.user.email });
      }
    }

    let sent = 0;
    const notifications: Array<{
      user_id: string;
      title: string;
      body: string;
      channel: string;
      status: string;
      meta_data: Record<string, unknown>;
    }> = [];

    for (const { userId, email } of emailResults) {
      let emailStatus = "pending";

      if (resendApiKey) {
        // Send actual email via Resend
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "مجمع حويلان <admin@quran-circle.enter.com.sa>",
              to: [email],
              subject,
              html: `<div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;">
                <div style="background: #1a5c3a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                  <h2 style="margin: 0;">مجمع حويلان لتحفيظ القرآن الكريم</h2>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
                  <h3 style="color: #1a5c3a; margin-top: 0;">${subject}</h3>
                  <p style="line-height: 1.8; color: #333; white-space: pre-wrap;">${body}</p>
                </div>
                <p style="text-align: center; color: #999; font-size: 12px; margin-top: 16px;">
                  هذه رسالة آلية من نظام مجمع حويلان
                </p>
              </div>`,
            }),
          });

          if (emailResponse.ok) {
            emailStatus = "sent";
            sent++;
          } else {
            emailStatus = "failed";
            const errBody = await emailResponse.text();
            console.error(`Email failed for ${email}:`, errBody);
          }
        } catch (e) {
          emailStatus = "failed";
          console.error(`Email error for ${email}:`, e);
        }
      } else {
        // No Resend key — log as pending
        emailStatus = "pending";
        sent++;
      }

      notifications.push({
        user_id: userId,
        title: subject,
        body,
        channel: "email",
        status: emailStatus,
        meta_data: { email, source: "bulk_email", sent_by: claimsData.claims.sub },
      });
    }

    // Insert notification records
    if (notifications.length > 0) {
      await adminClient.from("notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({ success: true, sent, total: emailResults.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
