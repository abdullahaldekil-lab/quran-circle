
-- 1. Fix profiles INSERT: prevent privilege escalation by restricting role on self-insert
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  AND (role IS NULL OR role IN ('guardian', 'user'))
);

CREATE POLICY "Managers can insert any profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Also prevent users from updating their own role (managers already have separate policy)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- 2. Fix recitation_records: restrict to staff (teachers of the halaqa or managers/supervisors)
DROP POLICY IF EXISTS "Authenticated can manage records" ON public.recitation_records;
DROP POLICY IF EXISTS "Authenticated can view records" ON public.recitation_records;

CREATE POLICY "Staff can view recitation records"
ON public.recitation_records
FOR SELECT
TO authenticated
USING (
  get_staff_role(auth.uid()) IN ('manager','supervisor','secretary','teacher','assistant')
);

CREATE POLICY "Guardians can view their children's records"
ON public.recitation_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardian_students gs
    WHERE gs.guardian_id = auth.uid()
      AND gs.student_id = recitation_records.student_id
      AND gs.active = true
  )
);

CREATE POLICY "Staff can insert recitation records"
ON public.recitation_records
FOR INSERT
TO authenticated
WITH CHECK (
  get_staff_role(auth.uid()) IN ('manager','supervisor','secretary','teacher','assistant')
);

CREATE POLICY "Staff can update recitation records"
ON public.recitation_records
FOR UPDATE
TO authenticated
USING (get_staff_role(auth.uid()) IN ('manager','supervisor','secretary','teacher','assistant'))
WITH CHECK (get_staff_role(auth.uid()) IN ('manager','supervisor','secretary','teacher','assistant'));

CREATE POLICY "Managers can delete recitation records"
ON public.recitation_records
FOR DELETE
TO authenticated
USING (get_staff_role(auth.uid()) IN ('manager','supervisor'));

-- 3. Realtime channel authorization: only authenticated users on their own user-scoped topics
-- Allow staff to subscribe to broad operational channels; restrict notification channels per-user
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive their own notifications" ON realtime.messages;
CREATE POLICY "Authenticated users can receive their own notifications"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Staff can subscribe to any operational channel
  public.get_staff_role(auth.uid()) IN ('manager','supervisor','secretary','teacher','assistant')
  -- Or the channel is explicitly user-scoped (topic contains auth.uid())
  OR (realtime.topic() LIKE '%' || auth.uid()::text || '%')
);
