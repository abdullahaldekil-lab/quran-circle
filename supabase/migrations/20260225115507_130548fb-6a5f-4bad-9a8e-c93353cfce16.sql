-- Sync existing teacher assignments: set assigned_halaqa_id for teachers already linked to active halaqat
UPDATE public.profiles p
SET assigned_halaqa_id = h.id
FROM public.halaqat h
WHERE h.teacher_id = p.id
  AND h.active = true
  AND p.assigned_halaqa_id IS NULL;

-- Sync existing assistant teacher assignments: set assigned_assistant_halaqa_id
UPDATE public.profiles p
SET assigned_assistant_halaqa_id = h.id
FROM public.halaqat h
WHERE h.assistant_teacher_id = p.id
  AND h.active = true
  AND p.assigned_assistant_halaqa_id IS NULL;