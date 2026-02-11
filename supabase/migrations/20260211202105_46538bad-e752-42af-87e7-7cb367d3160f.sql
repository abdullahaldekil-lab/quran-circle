
-- Prayer-based preparation time configuration
CREATE TABLE public.preparation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_prayer TEXT NOT NULL DEFAULT 'asr',
  offset_minutes INTEGER NOT NULL DEFAULT 40,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.preparation_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read config
CREATE POLICY "Anyone authenticated can read preparation config"
  ON public.preparation_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only managers can update
CREATE POLICY "Managers can manage preparation config"
  ON public.preparation_config FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Insert default config
INSERT INTO public.preparation_config (base_prayer, offset_minutes, duration_minutes)
VALUES ('asr', 40, 30);
