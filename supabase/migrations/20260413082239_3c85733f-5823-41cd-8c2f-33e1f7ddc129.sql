
-- Drop existing policies
DROP POLICY IF EXISTS "Manager can manage all requests" ON public.internal_requests;
DROP POLICY IF EXISTS "Supervisor can view relevant requests" ON public.internal_requests;
DROP POLICY IF EXISTS "Staff can view own requests" ON public.internal_requests;
DROP POLICY IF EXISTS "Staff can create requests" ON public.internal_requests;
DROP POLICY IF EXISTS "Staff can update own requests" ON public.internal_requests;
DROP POLICY IF EXISTS "Manager can delete requests" ON public.internal_requests;

-- Unified read policy
CREATE POLICY "Users can view relevant requests"
ON public.internal_requests FOR SELECT
TO authenticated
USING (
  get_staff_role(auth.uid()) = 'manager'
  OR from_user_id = auth.uid()
  OR to_user_id = auth.uid()
  OR to_role = get_staff_role(auth.uid())
  OR (
    get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor')
    AND (
      to_role IN ('supervisor', 'assistant_supervisor')
      OR get_staff_role(from_user_id) IN ('teacher', 'assistant_teacher')
    )
  )
);

-- Insert policy
CREATE POLICY "Staff can create requests"
ON public.internal_requests FOR INSERT
TO authenticated
WITH CHECK (
  from_user_id = auth.uid()
  AND get_staff_role(auth.uid()) IS NOT NULL
);

-- Update policy
CREATE POLICY "Staff can update requests"
ON public.internal_requests FOR UPDATE
TO authenticated
USING (
  get_staff_role(auth.uid()) = 'manager'
  OR from_user_id = auth.uid()
  OR to_user_id = auth.uid()
  OR to_role = get_staff_role(auth.uid())
  OR get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor')
);

-- Delete policy for managers only
CREATE POLICY "Manager can delete requests"
ON public.internal_requests FOR DELETE
TO authenticated
USING (get_staff_role(auth.uid()) = 'manager');
