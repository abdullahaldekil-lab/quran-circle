ALTER TABLE public.student_annual_plans
  ADD COLUMN IF NOT EXISTS daily_memorization_pages NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_review_pages NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_linking_pages NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_memorized_from TEXT,
  ADD COLUMN IF NOT EXISTS previous_memorized_to TEXT,
  ADD COLUMN IF NOT EXISTS previous_memorized_pages INTEGER DEFAULT 0;

ALTER TABLE public.student_plan_progress
  ADD COLUMN IF NOT EXISTS actual_memorization INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_review INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_linking INTEGER DEFAULT 0;