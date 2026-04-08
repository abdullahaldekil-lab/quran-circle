import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Server configuration error");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) throw new Error("Missing authorization");

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: authError } = await callerClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) throw new Error("Unauthorized");

    const caller = { id: claimsData.claims.sub as string };

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    const callerRole = callerProfile?.role;
    const isManager = callerRole === "manager";

    const { action, ...payload } = await req.json();

    // Actions that require manager role
    const managerActions = [
      "create_staff", "create_guardian", "approve_guardian",
      "update_status", "update_role", "reset_password",
      "link_guardian_student", "unlink_guardian_student",
      "admin_set_password", "admin_edit_user", "admin_delete_user",
      "admin_update_email",
    ];

    // Actions any authenticated user can do
    const selfActions = ["change_own_password", "update_own_profile"];

    if (managerActions.includes(action) && !isManager) {
      throw new Error("Only managers can perform this action");
    }

    if (!managerActions.includes(action) && !selfActions.includes(action)) {
      if (action && !isManager) throw new Error(`Unknown action: ${action}`);
    }

    switch (action) {
      // ==================== SELF-SERVICE ACTIONS ====================

      case "change_own_password": {
        const { old_password, new_password } = payload;
        if (!old_password || !new_password) throw new Error("يجب إدخال كلمة المرور القديمة والجديدة");
        if (new_password.length < 8) throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");

        // Verify old password by trying to sign in
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(caller.id);
        if (!userData?.user?.email) throw new Error("لم يتم العثور على بيانات المستخدم");

        const { error: signInError } = await createClient(supabaseUrl, anonKey)
          .auth.signInWithPassword({ email: userData.user.email, password: old_password });
        if (signInError) throw new Error("كلمة المرور القديمة غير صحيحة");

        // Update password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(caller.id, {
          password: new_password,
        });
        if (updateError) throw new Error("فشل تحديث كلمة المرور");

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "password_changed_self",
          target_user_id: caller.id,
          details: "User changed their own password",
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_own_profile": {
        const { full_name, phone, avatar_url } = payload;
        if (!full_name) throw new Error("الاسم مطلوب");

        const updateData: any = { full_name, phone };
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

        await supabaseAdmin
          .from("profiles")
          .update(updateData)
          .eq("id", caller.id);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ==================== ADMIN ACTIONS ====================

      case "admin_set_password": {
        const { user_id, new_password } = payload;
        if (!user_id || !new_password) throw new Error("يجب تحديد المستخدم وكلمة المرور الجديدة");
        if (new_password.length < 8) throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (updateError) throw new Error("فشل تحديث كلمة المرور: " + updateError.message);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "password_set_by_admin",
          target_user_id: user_id,
          details: "Admin set new password for user",
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "admin_edit_user": {
        const { user_id, full_name, phone, position_title, role } = payload;
        if (!user_id) throw new Error("يجب تحديد المستخدم");

        const updateData: any = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (phone !== undefined) updateData.phone = phone;
        if (position_title !== undefined) updateData.position_title = position_title;
        if (role !== undefined) updateData.role = role;

        await supabaseAdmin
          .from("profiles")
          .update(updateData)
          .eq("id", user_id);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "user_edited",
          target_user_id: user_id,
          details: `Admin edited user profile: ${JSON.stringify(updateData)}`,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "admin_delete_user": {
        const { user_id } = payload;
        if (!user_id) throw new Error("يجب تحديد المستخدم");
        if (user_id === caller.id) throw new Error("لا يمكنك حذف حسابك");

        // Prevent deleting last manager
        const { data: managers } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("role", "manager")
          .eq("active", true);
        
        const targetProfile = await supabaseAdmin
          .from("profiles")
          .select("role, full_name")
          .eq("id", user_id)
          .single();

        if (targetProfile.data?.role === "manager" && managers && managers.length <= 1) {
          throw new Error("لا يمكن حذف آخر مدير في النظام");
        }

        // Unlink from halaqat (teacher_id and assistant_teacher_id) without deleting historical data
        await supabaseAdmin
          .from("halaqat")
          .update({ teacher_id: null })
          .eq("teacher_id", user_id);

        await supabaseAdmin
          .from("halaqat")
          .update({ assistant_teacher_id: null })
          .eq("assistant_teacher_id", user_id);

        // Remove user permission overrides
        await supabaseAdmin
          .from("user_permissions")
          .delete()
          .eq("user_id", user_id);

        // Soft delete: deactivate + ban
        await supabaseAdmin
          .from("profiles")
          .update({ active: false })
          .eq("id", user_id);

        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
        if (banError) throw new Error("فشل تعطيل المستخدم: " + banError.message);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "user_deleted",
          target_user_id: user_id,
          details: `User soft-deleted: ${targetProfile.data?.full_name}. Halaqat & permissions unlinked.`,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_staff": {
        const { email, full_name, phone, role, halaqa_id, is_reserve } = payload;
        if (!email || !full_name || !role) throw new Error("Missing required fields");

        const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name, phone, user_type: "staff" },
        });
        if (createError) throw createError;

        const profileUpdate: Record<string, any> = { role, phone, full_name, position_title: null, is_reserve: !!is_reserve };
        if (halaqa_id && (role === "teacher" || role === "assistant_teacher")) {
          if (role === "teacher") {
            profileUpdate.assigned_halaqa_id = halaqa_id;
          } else {
            profileUpdate.assigned_assistant_halaqa_id = halaqa_id;
          }
        }

        await supabaseAdmin
          .from("profiles")
          .update(profileUpdate)
          .eq("id", newUser.user.id);

        // Link teacher to halaqa
        if (halaqa_id && (role === "teacher" || role === "assistant_teacher")) {
          const halaqaUpdate: Record<string, any> = {};
          if (role === "teacher") {
            halaqaUpdate.teacher_id = newUser.user.id;
          } else {
            halaqaUpdate.assistant_teacher_id = newUser.user.id;
          }
          await supabaseAdmin.from("halaqat").update(halaqaUpdate).eq("id", halaqa_id);
        }

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "user_created",
          target_user_id: newUser.user.id,
          details: `Staff account created: ${full_name} (${role})${is_reserve ? ' - احتياطي' : ''}${halaqa_id ? ' - linked to halaqa' : ''}`,
        });

        return new Response(
          JSON.stringify({
            success: true,
            user_id: newUser.user.id,
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

        if (user_type !== "guardian") {
          await supabaseAdmin
            .from("profiles")
            .update({ active: status === "active" })
            .eq("id", user_id);
        }

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
        let targetEmail = email;
        if (!targetEmail && user_id) {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
          if (userError || !userData?.user?.email) throw new Error("لم يتم العثور على بريد المستخدم");
          targetEmail = userData.user.email;
        }
        if (!targetEmail) throw new Error("Missing user_id or email");

        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
        });
        if (linkError) throw new Error("فشل في إنشاء رابط إعادة التعيين");

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "password_reset",
          target_user_id: user_id,
          details: `Password reset triggered for ${targetEmail}`,
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

      case "admin_update_email": {
        const { user_id, new_email } = payload;
        if (!user_id || !new_email) throw new Error("يجب تحديد المستخدم والبريد الجديد");

        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          email: new_email,
          email_confirm: true,
        });
        if (emailError) throw new Error("فشل تحديث البريد: " + emailError.message);

        await supabaseAdmin.from("admin_audit_log").insert({
          actor_user_id: caller.id,
          action_type: "email_updated",
          target_user_id: user_id,
          details: `Email updated to ${new_email}`,
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
