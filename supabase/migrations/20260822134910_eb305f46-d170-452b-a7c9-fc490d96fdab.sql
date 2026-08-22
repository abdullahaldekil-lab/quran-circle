ALTER TABLE public.madarij_enrollments
  ADD COLUMN IF NOT EXISTS days_planned integer,
  ADD COLUMN IF NOT EXISTS level_part_id uuid REFERENCES public.level_parts(id) ON DELETE SET NULL;