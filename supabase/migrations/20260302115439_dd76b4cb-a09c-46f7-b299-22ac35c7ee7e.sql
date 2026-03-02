-- البند 5: سياسات RLS لـ student_badges (UPDATE + DELETE)
CREATE POLICY "Staff can update student badges"
ON public.student_badges
FOR UPDATE
TO authenticated
USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can delete student badges"
ON public.student_badges
FOR DELETE
TO authenticated
USING (get_staff_role(auth.uid()) IS NOT NULL);

-- إضافة عمود source_detail إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_badges' AND column_name='source_detail') THEN
    ALTER TABLE public.student_badges ADD COLUMN source_detail text;
  END IF;
END $$;