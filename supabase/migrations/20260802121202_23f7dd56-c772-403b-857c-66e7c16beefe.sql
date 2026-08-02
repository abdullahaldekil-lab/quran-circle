-- Trigger-only functions: never callable via the API
REVOKE ALL ON FUNCTION public.apply_approved_excuse() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_approved_link_request() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.check_narration_achievements() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_student_level_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_student_plan_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_summer_plan_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_summer_daily_min() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_student_code() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- Authorization helpers: needed by RLS for signed-in users only, never by anon
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_staff_role(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.is_guardian_of(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(uuid) TO authenticated;

-- Intentional public endpoints (guarded internally): keep callable
GRANT EXECUTE ON FUNCTION public.get_student_portal_data(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_enrollment_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_narration_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_external_narration_review(text, text, text) TO anon, authenticated;