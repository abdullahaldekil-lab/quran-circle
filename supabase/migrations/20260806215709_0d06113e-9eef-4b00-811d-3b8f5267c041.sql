ALTER TABLE public.program_materials
  ADD COLUMN IF NOT EXISTS program_key text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

CREATE INDEX IF NOT EXISTS program_materials_program_key_idx ON public.program_materials (program_key);