ALTER TABLE public.preparation_config
  ADD COLUMN IF NOT EXISTS auto_sync_asr BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS late_tolerance_minutes INTEGER DEFAULT 10;