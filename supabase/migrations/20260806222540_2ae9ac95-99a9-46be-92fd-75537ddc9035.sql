ALTER TABLE public.program_materials
  ADD COLUMN IF NOT EXISTS segment_order text,
  ADD COLUMN IF NOT EXISTS suggested_minutes integer,
  ADD COLUMN IF NOT EXISTS usage_notes text;