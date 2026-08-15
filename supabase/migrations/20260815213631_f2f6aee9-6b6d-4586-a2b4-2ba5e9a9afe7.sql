ALTER TABLE public.student_annual_plans
ADD COLUMN IF NOT EXISTS previous_memorized_ranges jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.student_annual_plans.previous_memorized_ranges IS 'Array of previously memorized segments: [{juz:int, from:text, to:text, pages:numeric}]';