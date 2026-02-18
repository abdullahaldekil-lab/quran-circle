ALTER TABLE public.narration_results 
ADD COLUMN IF NOT EXISTS total_hizbat integer NOT NULL DEFAULT 0;