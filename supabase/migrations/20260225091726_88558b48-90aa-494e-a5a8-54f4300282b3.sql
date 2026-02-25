
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assigned_halaqa_id UUID REFERENCES public.halaqat(id);

-- Unique constraint: each active halaqa can have only one teacher
CREATE UNIQUE INDEX IF NOT EXISTS unique_teacher_per_halaqa 
ON public.halaqat(teacher_id) 
WHERE teacher_id IS NOT NULL AND active = true;

-- Unique constraint: each active teacher can be assigned to only one halaqa
CREATE UNIQUE INDEX IF NOT EXISTS unique_halaqa_per_teacher 
ON public.profiles(assigned_halaqa_id) 
WHERE assigned_halaqa_id IS NOT NULL AND active = true;
