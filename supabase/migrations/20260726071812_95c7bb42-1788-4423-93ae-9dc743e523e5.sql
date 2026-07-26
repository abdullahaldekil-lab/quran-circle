REVOKE ALL ON FUNCTION public.get_staff_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_role(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_student_portal_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_portal_data(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.check_enrollment_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_enrollment_status(text) TO anon, authenticated, service_role;