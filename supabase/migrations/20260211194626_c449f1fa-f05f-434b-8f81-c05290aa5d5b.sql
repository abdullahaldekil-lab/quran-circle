
-- Create enum for pre-registration status
CREATE TYPE public.pre_registration_status AS ENUM ('new', 'under_review', 'approved', 'rejected', 'waiting_list');

-- Create pre-registrations table
CREATE TABLE public.pre_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_full_name TEXT NOT NULL,
  guardian_full_name TEXT NOT NULL,
  guardian_phone TEXT,
  requested_halaqa TEXT,
  student_notes TEXT,
  relationship TEXT DEFAULT 'أب',
  status public.pre_registration_status NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  converted_student_id UUID REFERENCES public.students(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;

-- Manager and admin_staff can do everything
CREATE POLICY "Managers full access on pre_registrations"
  ON public.pre_registrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'secretary', 'admin_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'secretary', 'admin_staff')
    )
  );

-- Supervisors can view
CREATE POLICY "Supervisors can view pre_registrations"
  ON public.pre_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('supervisor', 'assistant_supervisor')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_pre_registrations_updated_at
  BEFORE UPDATE ON public.pre_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
