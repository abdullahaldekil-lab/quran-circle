
-- Add last_login_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Add approval fields to guardian_profiles
ALTER TABLE public.guardian_profiles 
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add relationship and active to guardian_students
ALTER TABLE public.guardian_students
  ADD COLUMN IF NOT EXISTS relationship text DEFAULT 'أب',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Create admin audit log table
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action_type text NOT NULL,
  target_user_id uuid,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only managers can view audit logs
CREATE POLICY "Manager can view audit log"
ON public.admin_audit_log
FOR SELECT
USING (get_staff_role(auth.uid()) = 'manager');

-- Staff can insert audit entries
CREATE POLICY "Staff can insert audit log"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

-- Manager can manage profiles (update roles, status)
CREATE POLICY "Manager can update all profiles"
ON public.profiles
FOR UPDATE
USING (get_staff_role(auth.uid()) = 'manager');
