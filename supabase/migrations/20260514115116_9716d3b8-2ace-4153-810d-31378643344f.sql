
-- 1) Tighten RLS so guardians do NOT see all students/halaqat/attendance.
-- Replace overly-permissive "Authenticated" policies with staff-only + guardian-restricted.

-- STUDENTS: drop the broad authenticated policy. Staff/Guardian policies already exist.
DROP POLICY IF EXISTS "Authenticated can view students" ON public.students;

-- HALAQAT: drop broad policy, add staff + guardian-restricted view
DROP POLICY IF EXISTS "Authenticated can view halaqat" ON public.halaqat;

CREATE POLICY "Staff can view halaqat"
  ON public.halaqat FOR SELECT
  USING (public.get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Guardians can view halaqat of their children"
  ON public.halaqat FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.guardian_students gs ON gs.student_id = s.id
    WHERE s.halaqa_id = halaqat.id
      AND gs.guardian_id = auth.uid()
      AND gs.active = true
  ));

-- ATTENDANCE: drop broad policies, add staff + guardian-restricted
DROP POLICY IF EXISTS "Authenticated can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated can manage attendance" ON public.attendance;

CREATE POLICY "Staff can view attendance"
  ON public.attendance FOR SELECT
  USING (public.get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can manage attendance"
  ON public.attendance FOR ALL
  USING (public.get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (public.get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Guardians can view their children's attendance"
  ON public.attendance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.guardian_students gs
    WHERE gs.student_id = attendance.student_id
      AND gs.guardian_id = auth.uid()
      AND gs.active = true
  ));

-- 2) Guardian approval: only show data for APPROVED guardians
-- Update guardian_students viewing — only when guardian is approved
DROP POLICY IF EXISTS "Guardians can view linked students" ON public.students;
CREATE POLICY "Guardians can view linked students"
  ON public.students FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.guardian_students gs
    JOIN public.guardian_profiles gp ON gp.id = gs.guardian_id
    WHERE gs.student_id = students.id
      AND gs.guardian_id = auth.uid()
      AND gs.active = true
      AND gp.approval_status = 'approved'
  ));

-- 3) Link requests by national_id
CREATE TABLE IF NOT EXISTS public.guardian_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.guardian_profiles(id) ON DELETE CASCADE,
  student_national_id TEXT NOT NULL,
  student_name_hint TEXT,
  relationship TEXT DEFAULT 'أب',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  matched_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guardian_link_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians manage own link requests"
  ON public.guardian_link_requests FOR ALL
  USING (guardian_id = auth.uid())
  WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Staff can view link requests"
  ON public.guardian_link_requests FOR SELECT
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor','secretary']));

CREATE POLICY "Staff can review link requests"
  ON public.guardian_link_requests FOR UPDATE
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor','secretary']));

CREATE TRIGGER trg_glr_updated
  BEFORE UPDATE ON public.guardian_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when approved → match student by national_id and create guardian_students row
CREATE OR REPLACE FUNCTION public.apply_approved_link_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student_id UUID;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT id INTO v_student_id FROM public.students
    WHERE national_id = NEW.student_national_id LIMIT 1;

    IF v_student_id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد طالب مطابق لرقم الهوية: %', NEW.student_national_id;
    END IF;

    NEW.matched_student_id := v_student_id;
    NEW.reviewed_at := now();

    INSERT INTO public.guardian_students (guardian_id, student_id, relationship, active)
    VALUES (NEW.guardian_id, v_student_id, COALESCE(NEW.relationship,'أب'), true)
    ON CONFLICT (guardian_id, student_id) DO UPDATE SET active = true;
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_approved_link_request
  BEFORE UPDATE ON public.guardian_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_approved_link_request();

-- 4) Allow guardian to read their own link request status (already covered by FOR ALL above)
-- 5) Index for matching
CREATE INDEX IF NOT EXISTS idx_students_national_id ON public.students(national_id);
