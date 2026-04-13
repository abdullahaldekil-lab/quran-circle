
-- 1. Add recurrence column to staff_tasks
ALTER TABLE public.staff_tasks ADD COLUMN IF NOT EXISTS recurrence text DEFAULT 'none';

-- 2. Create talqeen_sessions table
CREATE TABLE IF NOT EXISTS public.talqeen_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  surah TEXT NOT NULL,
  from_ayah INTEGER,
  to_ayah INTEGER,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.talqeen_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage talqeen sessions"
  ON public.talqeen_sessions FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

-- 3. Add madarij_track_id to memorization_levels
ALTER TABLE public.memorization_levels ADD COLUMN IF NOT EXISTS madarij_track_id UUID REFERENCES public.madarij_tracks(id);
