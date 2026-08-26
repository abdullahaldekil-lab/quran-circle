GRANT EXECUTE ON FUNCTION public.get_staff_role(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(uuid) TO anon;