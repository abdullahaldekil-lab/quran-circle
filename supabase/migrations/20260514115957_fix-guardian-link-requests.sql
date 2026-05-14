-- 1) Add rejection_reason to guardian_profiles
ALTER TABLE public.guardian_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2) Unique constraint: prevent duplicate pending requests for same guardian+student
CREATE UNIQUE INDEX IF NOT EXISTS idx_guardian_link_requests_pending_unique
  ON public.guardian_link_requests (guardian_id, student_national_id)
  WHERE status = 'pending';

-- 3) Fix RLS: add WITH CHECK to staff update policy for link requests
DROP POLICY IF EXISTS "Staff can review link requests" ON public.guardian_link_requests;

CREATE POLICY "Staff can review link requests"
  ON public.guardian_link_requests FOR UPDATE
  USING (
    public.get_staff_role(auth.uid()) = ANY (
      ARRAY['manager', 'supervisor', 'assistant_supervisor', 'secretary']
    )
  )
  WITH CHECK (
    public.get_staff_role(auth.uid()) = ANY (
      ARRAY['manager', 'supervisor', 'assistant_supervisor', 'secretary']
    )
  );
