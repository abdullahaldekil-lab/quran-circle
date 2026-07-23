
-- 1) Extend summer_students with per-student plan
ALTER TABLE public.summer_students
  ADD COLUMN IF NOT EXISTS plan_type TEXT CHECK (plan_type IN ('hifz','taahud')),
  ADD COLUMN IF NOT EXISTS plan_track TEXT,
  ADD COLUMN IF NOT EXISTS plan_goal TEXT,
  ADD COLUMN IF NOT EXISTS assigned_reciter TEXT;

-- 2) Daily records table
CREATE TABLE IF NOT EXISTS public.summer_daily_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  summer_student_id UUID NOT NULL REFERENCES public.summer_students(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- new portion
  new_from TEXT,
  new_to TEXT,
  new_notifications INTEGER NOT NULL DEFAULT 0,
  new_mistakes_lahn INTEGER NOT NULL DEFAULT 0,
  new_listening_done BOOLEAN NOT NULL DEFAULT false,
  new_repetitions_done BOOLEAN NOT NULL DEFAULT false,
  new_test_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  new_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  -- linking on reciter
  link_from TEXT,
  link_to TEXT,
  link_notifications INTEGER NOT NULL DEFAULT 0,
  link_mistakes_lahn INTEGER NOT NULL DEFAULT 0,
  link_pages_count INTEGER NOT NULL DEFAULT 0,
  link_time_per_page TEXT,
  link_reciter TEXT,
  link_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  -- amyal (taahud)
  amyal_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  total_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (summer_student_id, record_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.summer_daily_records TO authenticated;
GRANT ALL ON public.summer_daily_records TO service_role;

ALTER TABLE public.summer_daily_records ENABLE ROW LEVEL SECURITY;

-- Managers and talqeen supervisors: full access
CREATE POLICY "Managers manage summer daily records"
ON public.summer_daily_records FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role IN ('manager','talqeen_supervisor','talqeen_assistant_supervisor')
           OR p.role LIKE 'custom_%'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role IN ('manager','talqeen_supervisor','talqeen_assistant_supervisor')
           OR p.role LIKE 'custom_%'))
);

-- Assigned teacher of the maqra: full access to their students' records
CREATE POLICY "Maqra teacher manages own records"
ON public.summer_daily_records FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.summer_students ss
    JOIN public.summer_maqare m ON m.id = ss.maqra_id
    WHERE ss.id = summer_daily_records.summer_student_id
      AND m.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.summer_students ss
    JOIN public.summer_maqare m ON m.id = ss.maqra_id
    WHERE ss.id = summer_daily_records.summer_student_id
      AND m.teacher_id = auth.uid()
  )
);

-- updated_at trigger
CREATE TRIGGER trg_summer_daily_records_updated_at
BEFORE UPDATE ON public.summer_daily_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
