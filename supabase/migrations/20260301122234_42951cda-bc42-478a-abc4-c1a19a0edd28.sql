
-- Add form_data JSONB column for extended enrollment form fields
ALTER TABLE public.enrollment_requests 
ADD COLUMN IF NOT EXISTS form_data jsonb DEFAULT '{}'::jsonb;

-- Create secure RPC for anonymous status checking (returns limited data only)
CREATE OR REPLACE FUNCTION public.check_enrollment_status(phone_number text)
RETURNS TABLE(student_full_name text, status text, rejection_reason text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    er.student_full_name,
    er.status::text,
    er.rejection_reason,
    er.created_at
  FROM enrollment_requests er
  WHERE er.guardian_phone = phone_number
  ORDER BY er.created_at DESC
  LIMIT 10;
$$;

-- Grant anon access to the function
GRANT EXECUTE ON FUNCTION public.check_enrollment_status(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_enrollment_status(text) TO authenticated;
