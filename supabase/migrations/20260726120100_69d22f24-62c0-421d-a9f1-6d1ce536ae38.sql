-- منع إسناد طالب جديد إلى حلقة تلقين + سجل تغيير الحلقة.
--
-- التسجيل في التلقين يتم حصريًا من قسم التلقين. الواجهة تُخفي حلقات التلقين من
-- كل نماذج إنشاء الطلاب، وهذا الحارس هو خط الدفاع الأخير على مستوى قاعدة البيانات.
--
-- ملاحظة مقصودة: الحظر على INSERT فقط (طالب جديد). نقل طالب قائم يُسجَّل ولا يُمنع،
-- حتى لا تتعطل عمليات النقل المشروعة التي يقوم بها قسم التلقين.

CREATE TABLE IF NOT EXISTS public.student_halaqa_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  old_halaqa_id UUID,
  new_halaqa_id UUID,
  changed_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_halaqa_log_student
  ON public.student_halaqa_log (student_id, created_at DESC);

GRANT SELECT ON public.student_halaqa_log TO authenticated;
GRANT ALL ON public.student_halaqa_log TO service_role;

ALTER TABLE public.student_halaqa_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view halaqa log" ON public.student_halaqa_log;
CREATE POLICY "Staff can view halaqa log" ON public.student_halaqa_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- الإدراج يتم عبر التريغر (SECURITY DEFINER) فقط — لا سياسة INSERT للمستخدمين.

CREATE OR REPLACE FUNCTION public.guard_student_halaqa_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_talqeen BOOLEAN;
BEGIN
  IF NEW.halaqa_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT (h.talqeen_curriculum_id IS NOT NULL)
      INTO v_is_talqeen
      FROM public.halaqat h
     WHERE h.id = NEW.halaqa_id;

    IF COALESCE(v_is_talqeen, false) THEN
      RAISE EXCEPTION 'لا يمكن إسناد طالب جديد إلى حلقة تلقين'
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF NEW.halaqa_id IS DISTINCT FROM OLD.halaqa_id THEN
    INSERT INTO public.student_halaqa_log (student_id, old_halaqa_id, new_halaqa_id)
    VALUES (NEW.id, OLD.halaqa_id, NEW.halaqa_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_student_halaqa_assignment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_student_halaqa ON public.students;
CREATE TRIGGER trg_guard_student_halaqa
  BEFORE INSERT OR UPDATE OF halaqa_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.guard_student_halaqa_assignment();
