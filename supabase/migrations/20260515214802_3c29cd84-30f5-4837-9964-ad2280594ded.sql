ALTER TABLE public.narration_results
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewer_name_manual TEXT,
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS segment_label TEXT;

ALTER TABLE public.narration_attempts
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES auth.users(id);

-- Drop old unique constraints (block multi-reviewer)
ALTER TABLE public.narration_results
  DROP CONSTRAINT IF EXISTS narration_results_session_id_student_id_key;
ALTER TABLE public.narration_attempts
  DROP CONSTRAINT IF EXISTS narration_attempts_session_id_student_id_key;

-- New unique allowing multiple reviewers (NULLs allowed multiple times)
CREATE UNIQUE INDEX IF NOT EXISTS narration_results_unique_reviewer
  ON public.narration_results (session_id, student_id, reviewer_id);
CREATE UNIQUE INDEX IF NOT EXISTS narration_attempts_unique_reviewer
  ON public.narration_attempts (session_id, student_id, reviewer_id);