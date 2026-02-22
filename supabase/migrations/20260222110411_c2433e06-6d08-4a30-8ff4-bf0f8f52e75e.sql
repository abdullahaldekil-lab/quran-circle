
-- Create narration_goals table for halaqa-level narration targets
CREATE TABLE public.narration_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id) ON DELETE CASCADE,
  semester TEXT NOT NULL DEFAULT 'current',
  target_hizb_count INTEGER NOT NULL DEFAULT 50,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(halaqa_id, semester)
);

-- Enable RLS
ALTER TABLE public.narration_goals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can view narration goals"
  ON public.narration_goals FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage narration goals"
  ON public.narration_goals FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage own halaqa goals"
  ON public.narration_goals FOR ALL
  USING (get_staff_role(auth.uid()) IN ('teacher', 'assistant_teacher'))
  WITH CHECK (get_staff_role(auth.uid()) IN ('teacher', 'assistant_teacher'));

-- Trigger for updated_at
CREATE TRIGGER update_narration_goals_updated_at
  BEFORE UPDATE ON public.narration_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
