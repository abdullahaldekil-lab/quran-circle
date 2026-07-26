DROP POLICY IF EXISTS "Managers can manage halaqat" ON public.halaqat;
CREATE POLICY "Staff can manage halaqat" ON public.halaqat
FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Managers can manage levels" ON public.memorization_levels;
CREATE POLICY "Managers can manage levels" ON public.memorization_levels
FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']))
WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']));

DROP POLICY IF EXISTS "Managers can manage badges" ON public.badges;
CREATE POLICY "Managers can manage badges" ON public.badges
FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']))
WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']));

DROP POLICY IF EXISTS "Managers can manage rewards" ON public.rewards;
CREATE POLICY "Managers can manage rewards" ON public.rewards
FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']))
WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']));

DROP POLICY IF EXISTS "Managers can manage level_tracks" ON public.level_tracks;
CREATE POLICY "Managers can manage level_tracks" ON public.level_tracks
FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']))
WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']));

DROP POLICY IF EXISTS "Managers can manage level_branches" ON public.level_branches;
CREATE POLICY "Managers can manage level_branches" ON public.level_branches
FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']))
WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']));

DROP POLICY IF EXISTS "Managers can manage level_parts" ON public.level_parts;
CREATE POLICY "Managers can manage level_parts" ON public.level_parts
FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']))
WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor']));

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Staff can insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));