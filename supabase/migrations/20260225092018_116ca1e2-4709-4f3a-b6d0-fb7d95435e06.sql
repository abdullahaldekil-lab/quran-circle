
-- Add assigned_assistant_halaqa_id to profiles for tracking assistant teacher assignments
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assigned_assistant_halaqa_id UUID REFERENCES public.halaqat(id);

-- Unique constraint: each active halaqa can have only one assistant teacher
CREATE UNIQUE INDEX IF NOT EXISTS unique_assistant_teacher_per_halaqa 
ON public.halaqat(assistant_teacher_id) 
WHERE assistant_teacher_id IS NOT NULL AND active = true;

-- Unique constraint: each teacher can be assistant in only one halaqa
CREATE UNIQUE INDEX IF NOT EXISTS unique_assistant_halaqa_per_teacher 
ON public.profiles(assigned_assistant_halaqa_id) 
WHERE assigned_assistant_halaqa_id IS NOT NULL AND active = true;
