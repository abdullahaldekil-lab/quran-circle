-- مواد البرامج: ربطها ببرنامج، ودلو تخزين لرفع الملفات فعليًا.
--
-- الجدول فيه file_path منذ إنشائه لكن لم يُكتب فيه قط لعدم وجود دلو، وواجهة
-- الإضافة كانت تحذف program_id قبل الإدراج فكل المواد غير مصنّفة.

ALTER TABLE public.program_materials
  ADD COLUMN IF NOT EXISTS program_key TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

CREATE INDEX IF NOT EXISTS idx_program_materials_key
  ON public.program_materials (program_key, order_index);

-- المشرف المسؤول عن البرنامج (لصفحة إشراف البرامج)
ALTER TABLE public.summer_programs
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.talqeen_curricula
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- دلو خاص (غير عام) — التنزيل عبر روابط موقّعة، على غرار recitation-audio.
INSERT INTO storage.buckets (id, name, public)
VALUES ('program-materials', 'program-materials', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff can view program material files" ON storage.objects;
CREATE POLICY "Staff can view program material files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'program-materials' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Managers can upload program material files" ON storage.objects;
CREATE POLICY "Managers can upload program material files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'program-materials'
  AND public.get_staff_role(auth.uid()) = ANY (ARRAY['manager', 'supervisor'])
);

DROP POLICY IF EXISTS "Managers can update program material files" ON storage.objects;
CREATE POLICY "Managers can update program material files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'program-materials'
  AND public.get_staff_role(auth.uid()) = ANY (ARRAY['manager', 'supervisor'])
);

DROP POLICY IF EXISTS "Managers can delete program material files" ON storage.objects;
CREATE POLICY "Managers can delete program material files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'program-materials'
  AND public.get_staff_role(auth.uid()) = ANY (ARRAY['manager', 'supervisor'])
);
