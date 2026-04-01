
-- Create request_type enum
CREATE TYPE public.request_type AS ENUM ('إجازة', 'مستلزمات', 'صيانة', 'استفسار', 'أخرى');

-- Create request_priority enum
CREATE TYPE public.request_priority AS ENUM ('عاجل', 'عادي', 'منخفض');

-- Create request_status enum
CREATE TYPE public.request_status AS ENUM ('new', 'in_progress', 'done', 'rejected');

-- Create internal_requests table
CREATE TABLE public.internal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  request_type public.request_type NOT NULL DEFAULT 'أخرى',
  priority public.request_priority NOT NULL DEFAULT 'عادي',
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_role TEXT,
  status public.request_status NOT NULL DEFAULT 'new',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create internal_request_replies table
CREATE TABLE public.internal_request_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES public.internal_requests(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_request_replies ENABLE ROW LEVEL SECURITY;

-- RLS for internal_requests

-- Manager sees all requests
CREATE POLICY "Manager can manage all requests"
ON public.internal_requests FOR ALL
TO authenticated
USING (get_staff_role(auth.uid()) = 'manager')
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Supervisor sees requests sent to their role or from teachers
CREATE POLICY "Supervisor can view relevant requests"
ON public.internal_requests FOR SELECT
TO authenticated
USING (
  get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor')
  AND (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR to_role IN ('supervisor', 'assistant_supervisor')
    OR get_staff_role(from_user_id) IN ('teacher', 'assistant_teacher')
  )
);

-- Staff can view own sent/received requests
CREATE POLICY "Staff can view own requests"
ON public.internal_requests FOR SELECT
TO authenticated
USING (
  from_user_id = auth.uid()
  OR to_user_id = auth.uid()
  OR to_role = get_staff_role(auth.uid())
);

-- Staff can insert their own requests
CREATE POLICY "Staff can create requests"
ON public.internal_requests FOR INSERT
TO authenticated
WITH CHECK (
  from_user_id = auth.uid()
  AND get_staff_role(auth.uid()) IS NOT NULL
);

-- Staff can update requests they received or sent
CREATE POLICY "Staff can update own requests"
ON public.internal_requests FOR UPDATE
TO authenticated
USING (
  from_user_id = auth.uid()
  OR to_user_id = auth.uid()
  OR to_role = get_staff_role(auth.uid())
  OR get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor')
);

-- RLS for internal_request_replies

-- Users can view replies on requests they can see
CREATE POLICY "Users can view replies on accessible requests"
ON public.internal_request_replies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internal_requests r
    WHERE r.id = request_id
    AND (
      r.from_user_id = auth.uid()
      OR r.to_user_id = auth.uid()
      OR r.to_role = get_staff_role(auth.uid())
      OR get_staff_role(auth.uid()) = 'manager'
      OR (get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor'))
    )
  )
);

-- Staff can add replies
CREATE POLICY "Staff can add replies"
ON public.internal_request_replies FOR INSERT
TO authenticated
WITH CHECK (
  from_user_id = auth.uid()
  AND get_staff_role(auth.uid()) IS NOT NULL
);

-- Auto-update updated_at trigger
CREATE TRIGGER update_internal_requests_updated_at
  BEFORE UPDATE ON public.internal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
