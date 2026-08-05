-- Replace the broad "Staff can manage halaqat" ALL policy with read-for-all-staff
-- plus write limited to manager and secretary.
DROP POLICY IF EXISTS "Staff can manage halaqat" ON public.halaqat;

CREATE POLICY "Manager and secretary can insert halaqat"
ON public.halaqat FOR INSERT TO authenticated
WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager', 'secretary'));

CREATE POLICY "Manager and secretary can update halaqat"
ON public.halaqat FOR UPDATE TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('manager', 'secretary'))
WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager', 'secretary'));

CREATE POLICY "Manager and secretary can delete halaqat"
ON public.halaqat FOR DELETE TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('manager', 'secretary'));