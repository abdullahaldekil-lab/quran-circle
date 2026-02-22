
-- 1. Create narration_attempts table
CREATE TABLE public.narration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.narration_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  narration_type text NOT NULL DEFAULT 'regular',
  total_hizb_count numeric NOT NULL DEFAULT 0,
  total_pages_approx numeric NOT NULL DEFAULT 0,
  mistakes_count integer NOT NULL DEFAULT 0,
  lahn_count integer NOT NULL DEFAULT 0,
  warnings_count integer NOT NULL DEFAULT 0,
  grade numeric NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pending',
  manual_entry boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- 2. Create narration_ranges table
CREATE TABLE public.narration_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.narration_attempts(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'regular',
  from_hizb integer NOT NULL DEFAULT 1,
  to_hizb integer NOT NULL DEFAULT 1,
  hizb_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add check constraint for from_hizb <= to_hizb
ALTER TABLE public.narration_ranges ADD CONSTRAINT narration_ranges_hizb_order CHECK (from_hizb <= to_hizb);

-- 3. Add new columns to narration_settings
ALTER TABLE public.narration_settings
  ADD COLUMN IF NOT EXISTS pages_per_hizb integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS min_hizb_required integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_pages_required integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS memorization_weight numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS mastery_weight numeric NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS performance_weight numeric NOT NULL DEFAULT 0.2;

-- 4. Enable RLS
ALTER TABLE public.narration_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narration_ranges ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for narration_attempts
CREATE POLICY "Manager can manage narration attempts"
  ON public.narration_attempts FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage narration attempts"
  ON public.narration_attempts FOR ALL
  USING (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']));

CREATE POLICY "Staff can view narration attempts"
  ON public.narration_attempts FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- 6. RLS policies for narration_ranges
CREATE POLICY "Manager can manage narration ranges"
  ON public.narration_ranges FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage narration ranges"
  ON public.narration_ranges FOR ALL
  USING (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']));

CREATE POLICY "Staff can view narration ranges"
  ON public.narration_ranges FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- 7. Trigger for updated_at on narration_attempts
CREATE TRIGGER update_narration_attempts_updated_at
  BEFORE UPDATE ON public.narration_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
