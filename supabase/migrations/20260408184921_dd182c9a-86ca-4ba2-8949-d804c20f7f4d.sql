
-- =============================================
-- 1. FIX STUDENTS TABLE RLS
-- =============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated can manage students" ON public.students;

-- Staff can view all students
CREATE POLICY "Staff can view students"
ON public.students FOR SELECT
TO authenticated
USING (
  get_staff_role(auth.uid()) IN ('manager', 'admin_staff', 'supervisor', 'teacher', 'assistant_teacher')
);

-- Guardians can view only their linked children
CREATE POLICY "Guardians can view linked students"
ON public.students FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardian_students gs
    WHERE gs.student_id = students.id
    AND gs.guardian_id = auth.uid()
    AND gs.active = true
  )
);

-- Only staff can insert students
CREATE POLICY "Staff can insert students"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (
  get_staff_role(auth.uid()) IN ('manager', 'admin_staff', 'supervisor', 'teacher', 'assistant_teacher')
);

-- Only staff can update students
CREATE POLICY "Staff can update students"
ON public.students FOR UPDATE
TO authenticated
USING (
  get_staff_role(auth.uid()) IN ('manager', 'admin_staff', 'supervisor', 'teacher', 'assistant_teacher')
);

-- Only manager can delete students
CREATE POLICY "Manager can delete students"
ON public.students FOR DELETE
TO authenticated
USING (
  get_staff_role(auth.uid()) = 'manager'
);

-- =============================================
-- 2. FIX INSTRUCTIONS TABLE RLS
-- =============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated can manage instructions" ON public.instructions;

-- Manager can view all; others can view their own sent/received
CREATE POLICY "Staff can view relevant instructions"
ON public.instructions FOR SELECT
TO authenticated
USING (
  get_staff_role(auth.uid()) = 'manager'
  OR from_manager_id = auth.uid()
  OR to_teacher_id = auth.uid()
);

-- Only staff can create instructions
CREATE POLICY "Staff can create instructions"
ON public.instructions FOR INSERT
TO authenticated
WITH CHECK (
  get_staff_role(auth.uid()) IN ('manager', 'admin_staff', 'supervisor')
  AND from_manager_id = auth.uid()
);

-- Sender or manager can update
CREATE POLICY "Sender or manager can update instructions"
ON public.instructions FOR UPDATE
TO authenticated
USING (
  get_staff_role(auth.uid()) = 'manager'
  OR from_manager_id = auth.uid()
);

-- Only manager can delete
CREATE POLICY "Manager can delete instructions"
ON public.instructions FOR DELETE
TO authenticated
USING (
  get_staff_role(auth.uid()) = 'manager'
);

-- =============================================
-- 3. FIX RECITATION-AUDIO STORAGE BUCKET
-- =============================================

-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'recitation-audio';

-- Drop the public read policy
DROP POLICY IF EXISTS "Anyone can read audio" ON storage.objects;

-- Authenticated users can read recitation audio
CREATE POLICY "Authenticated can read recitation audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'recitation-audio');
