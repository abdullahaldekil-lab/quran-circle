ALTER TABLE public.recitation_records 
ADD COLUMN IF NOT EXISTS mistakes_breakdown JSONB DEFAULT '{"jali":0,"khafi":0,"taraddod":0,"nisyan":0}'::jsonb;