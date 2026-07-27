ALTER TABLE public.summer_daily_records
  ADD COLUMN IF NOT EXISTS listening_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetitions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetition_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listening_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_peer_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_peer_name text,
  ADD COLUMN IF NOT EXISTS new_passed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS link_passed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reading_minutes numeric;

ALTER TABLE public.summer_students
  ADD COLUMN IF NOT EXISTS mastered_juz integer[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.summer_rooted_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summer_student_id uuid NOT NULL REFERENCES public.summer_students(id) ON DELETE CASCADE,
  surah text NOT NULL,
  ayah_number text,
  mistake_type text NOT NULL DEFAULT 'خطأ',
  correction text,
  resolved boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.summer_rooted_mistakes TO authenticated;
GRANT ALL ON public.summer_rooted_mistakes TO service_role;

ALTER TABLE public.summer_rooted_mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage rooted mistakes"
  ON public.summer_rooted_mistakes FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_summer_rooted_mistakes_updated_at
  BEFORE UPDATE ON public.summer_rooted_mistakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_summer_rooted_mistakes_student
  ON public.summer_rooted_mistakes(summer_student_id);