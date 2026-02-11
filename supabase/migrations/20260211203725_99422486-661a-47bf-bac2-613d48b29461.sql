
-- Academic calendar holidays table
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'custom' CHECK (holiday_type IN ('official', 'custom')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read holidays
CREATE POLICY "Authenticated users can read holidays"
  ON public.holidays FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only managers can manage holidays
CREATE POLICY "Managers can manage holidays"
  ON public.holidays FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE TRIGGER update_holidays_updated_at
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_holidays_dates ON public.holidays(start_date, end_date);
