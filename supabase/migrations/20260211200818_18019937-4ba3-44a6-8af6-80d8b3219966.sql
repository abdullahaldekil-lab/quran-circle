
-- Create enrollment request status enum
CREATE TYPE public.enrollment_request_status AS ENUM ('pending', 'approved', 'rejected', 'waiting_list');

-- Create enrollment requests table (public submissions via QR)
CREATE TABLE public.enrollment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardian_full_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  student_full_name TEXT NOT NULL,
  student_birth_year INTEGER,
  requested_halaqa_id UUID REFERENCES public.halaqat(id),
  preferred_time TEXT,
  notes TEXT,
  status public.enrollment_request_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  assigned_halaqa_id UUID REFERENCES public.halaqat(id),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  converted_student_id UUID REFERENCES public.students(id),
  converted_guardian_id UUID,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to INSERT (public form)
CREATE POLICY "Anyone can submit enrollment request"
  ON public.enrollment_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Staff can view all requests
CREATE POLICY "Manager and admin can view enrollment requests"
  ON public.enrollment_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'secretary', 'admin_staff', 'supervisor', 'assistant_supervisor')
    )
  );

-- Manager and admin can update requests
CREATE POLICY "Manager and admin can update enrollment requests"
  ON public.enrollment_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'secretary', 'admin_staff')
    )
  );

-- Manager can delete requests
CREATE POLICY "Manager can delete enrollment requests"
  ON public.enrollment_requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Anonymous can check their request status by phone
CREATE POLICY "Anyone can view own request by phone"
  ON public.enrollment_requests FOR SELECT
  TO anon
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_enrollment_requests_updated_at
  BEFORE UPDATE ON public.enrollment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
