-- Step 1: Drop policies that reference ::staff_role cast
DROP POLICY IF EXISTS "Manager and admin can update enrollment requests" ON public.enrollment_requests;
DROP POLICY IF EXISTS "Manager and admin can view enrollment requests" ON public.enrollment_requests;
DROP POLICY IF EXISTS "Manager can delete enrollment requests" ON public.enrollment_requests;
DROP POLICY IF EXISTS "Managers can manage holidays" ON public.holidays;
DROP POLICY IF EXISTS "Managers full access on pre_registrations" ON public.pre_registrations;
DROP POLICY IF EXISTS "Supervisors can view pre_registrations" ON public.pre_registrations;
DROP POLICY IF EXISTS "Managers can manage preparation config" ON public.preparation_config;
DROP POLICY IF EXISTS "Managers can manage overrides" ON public.temporary_access_overrides;

-- Step 2: Convert column from enum to text
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE text
  USING role::text;

-- Step 3: Set default value as text
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'teacher';

-- Step 4: Recreate all dropped policies with text comparisons

CREATE POLICY "Manager and admin can update enrollment requests"
ON public.enrollment_requests FOR UPDATE TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role IN ('manager', 'secretary', 'admin_staff')
));

CREATE POLICY "Manager and admin can view enrollment requests"
ON public.enrollment_requests FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role IN ('manager', 'secretary', 'admin_staff', 'supervisor', 'assistant_supervisor')
));

CREATE POLICY "Manager can delete enrollment requests"
ON public.enrollment_requests FOR DELETE TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role = 'manager'
));

CREATE POLICY "Managers can manage holidays"
ON public.holidays FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role = 'manager'
));

CREATE POLICY "Managers full access on pre_registrations"
ON public.pre_registrations FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role IN ('manager', 'secretary', 'admin_staff')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role IN ('manager', 'secretary', 'admin_staff')
));

CREATE POLICY "Supervisors can view pre_registrations"
ON public.pre_registrations FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role IN ('supervisor', 'assistant_supervisor')
));

CREATE POLICY "Managers can manage preparation config"
ON public.preparation_config FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role = 'manager'
));

CREATE POLICY "Managers can manage overrides"
ON public.temporary_access_overrides FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role = 'manager'
));

-- Step 5: Update get_staff_role function
CREATE OR REPLACE FUNCTION public.get_staff_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;