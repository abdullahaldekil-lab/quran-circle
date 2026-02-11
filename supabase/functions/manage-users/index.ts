import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is a manager
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== "manager") {
      throw new Error("Only managers can manage users");
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case "create_staff": {
        const { email, full_name, phone, role } = payload;
        if (!email || !full_name || !role) throw new Error("Missing required fields");

        // Create user with a temporary password
        const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name, phone, user_type: "staff" },
        });
        if (createError) throw createError;

        // Update profile with role
        await supabaseAdmin
          .from("profiles")
          .update({ role, phone, full_name, position_title: null })
          .eq("id", newUser.user.id);

        // Generate password reset link for invitation
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
        });

        // Log audit
        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "user_created",
          target_user_id: newUser.user.id,
          details: `Staff account created: ${full_name} (${role})`,
        });

        return new Response(
          JSON.stringify({
            success: true,
            user_id: newUser.user.id,
            recovery_link: linkData?.properties?.action_link || null,
            temp_password: tempPassword,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_guardian": {
        const { full_name, phone, email } = payload;
        if (!full_name || !phone) throw new Error("Missing required fields");

        const guardianEmail = email || `guardian_${phone.replace(/\+/g, "")}@placeholder.local`;
        const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: guardianEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name, phone, user_type: "guardian" },
        });
        if (createError) throw createError;

        // Update guardian profile approval status
        await supabaseAdmin
          .from("guardian_profiles")
          .update({ approval_status: "pending", phone })
          .eq("id", newUser.user.id);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "guardian_invited",
          target_user_id: newUser.user.id,
          details: `Guardian invited: ${full_name} (${phone})`,
        });

        return new Response(
          JSON.stringify({ success: true, user_id: newUser.user.id, temp_password: tempPassword }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "approve_guardian": {
        const { guardian_id, approved } = payload;
        if (!guardian_id) throw new Error("Missing guardian_id");

        const status = approved ? "approved" : "rejected";
        await supabaseAdmin
          .from("guardian_profiles")
          .update({
            approval_status: status,
            approved_by: caller.id,
            approved_at: new Date().toISOString(),
          })
          .eq("id", guardian_id);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: approved ? "guardian_approved" : "guardian_rejected",
          target_user_id: guardian_id,
          details: `Guardian ${status}`,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_status": {
        const { user_id, status, user_type } = payload;
        if (!user_id || !status) throw new Error("Missing fields");

        if (user_type === "guardian") {
          // For guardians, we can ban/unban via admin API
        } else {
          await supabaseAdmin
            .from("profiles")
            .update({ active: status === "active" })
            .eq("id", user_id);
        }

        // Ban/unban user in auth
        if (status === "suspended") {
          await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
        } else if (status === "active") {
          await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
        }

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "status_changed",
          target_user_id: user_id,
          details: `Status changed to: ${status}`,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_role": {
        const { user_id, new_role } = payload;
        if (!user_id || !new_role) throw new Error("Missing fields");

        const { data: targetProfile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", user_id)
          .single();

        await supabaseAdmin
          .from("profiles")
          .update({ role: new_role })
          .eq("id", user_id);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "role_changed",
          target_user_id: user_id,
          details: `Role changed from ${targetProfile?.role} to ${new_role}`,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reset_password": {
        const { user_id, email } = payload;
        if (!email) throw new Error("Missing email");

        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
        });

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "password_reset",
          target_user_id: user_id,
          details: `Password reset triggered`,
        });

        return new Response(
          JSON.stringify({ success: true, link: linkData?.properties?.action_link }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "link_guardian_student": {
        const { guardian_id, student_id, relationship } = payload;
        if (!guardian_id || !student_id) throw new Error("Missing fields");

        const { error } = await supabaseAdmin
          .from("guardian_students")
          .upsert({
            guardian_id,
            student_id,
            relationship: relationship || "أب",
            active: true,
          }, { onConflict: "guardian_id,student_id" });

        if (error) throw error;

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "guardian_linked",
          target_user_id: guardian_id,
          details: `Linked guardian to student ${student_id}`,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unlink_guardian_student": {
        const { guardian_id, student_id } = payload;
        await supabaseAdmin
          .from("guardian_students")
          .update({ active: false })
          .eq("guardian_id", guardian_id)
          .eq("student_id", student_id);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "guardian_unlinked",
          target_user_id: guardian_id,
          details: `Unlinked guardian from student ${student_id}`,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
