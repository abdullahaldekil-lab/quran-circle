
CREATE TABLE public.excellence_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_grade NUMERIC NOT NULL DEFAULT 100,
  deduction_per_mistake NUMERIC NOT NULL DEFAULT 2,
  deduction_per_lahn NUMERIC NOT NULL DEFAULT 1,
  deduction_per_warning NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.excellence_settings ENABLE ROW LEVEL SECURITY;

-- All staff can view
CREATE POLICY "Staff can view excellence settings"
  ON public.excellence_settings FOR SELECT
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- Manager can manage
CREATE POLICY "Manager can manage excellence settings"
  ON public.excellence_settings FOR ALL
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Insert default row
INSERT INTO public.excellence_settings (max_grade, deduction_per_mistake, deduction_per_lahn, deduction_per_warning)
VALUES (100, 2, 1, 0.5);

-- Updated at trigger
CREATE TRIGGER update_excellence_settings_updated_at
  BEFORE UPDATE ON public.excellence_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
