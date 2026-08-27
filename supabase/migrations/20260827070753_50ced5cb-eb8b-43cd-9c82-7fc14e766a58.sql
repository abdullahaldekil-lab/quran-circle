ALTER TABLE public.program_materials
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'both';

ALTER TABLE public.program_materials
  DROP CONSTRAINT IF EXISTS program_materials_audience_check;

ALTER TABLE public.program_materials
  ADD CONSTRAINT program_materials_audience_check
  CHECK (audience IN ('students', 'teachers', 'both'));

CREATE INDEX IF NOT EXISTS idx_program_materials_audience
  ON public.program_materials (audience);