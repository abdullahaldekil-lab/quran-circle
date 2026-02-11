
-- Temporary cross-halaqa access overrides
CREATE TABLE public.temporary_access_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id),
  granted_by UUID NOT NULL REFERENCES public.profiles(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.temporary_access_overrides ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own overrides
CREATE POLICY "Users can read own overrides"
  ON public.temporary_access_overrides FOR SELECT
  USING (auth.uid() = user_id);

-- Managers can manage all overrides
CREATE POLICY "Managers can manage overrides"
  ON public.temporary_access_overrides FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Index for efficient lookups
CREATE INDEX idx_temp_overrides_user_dates ON public.temporary_access_overrides(user_id, start_date, end_date);
