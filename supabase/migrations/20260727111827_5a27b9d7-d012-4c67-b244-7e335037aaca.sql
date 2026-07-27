CREATE TABLE public.student_plan_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  plan_id uuid,
  action text NOT NULL DEFAULT 'updated',
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.student_plan_change_log TO authenticated;
GRANT ALL ON public.student_plan_change_log TO service_role;

ALTER TABLE public.student_plan_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view plan change log"
ON public.student_plan_change_log FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_guardian_of(student_id));

CREATE POLICY "Staff can insert plan change log"
ON public.student_plan_change_log FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_student_plan_change_log_student ON public.student_plan_change_log(student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_student_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'created', 'plan', NULL,
      COALESCE(NEW.plan_type,'') || ' | ' || COALESCE(NEW.academic_year,'') || ' | ' || COALESCE(NEW.total_target_pages::text,''),
      v_uid, v_name);
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.plan_type,'') IS DISTINCT FROM COALESCE(OLD.plan_type,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'plan_type', OLD.plan_type, NEW.plan_type, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.status,'') IS DISTINCT FROM COALESCE(OLD.status,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'status', OLD.status, NEW.status, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.academic_year,'') IS DISTINCT FROM COALESCE(OLD.academic_year,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'academic_year', OLD.academic_year, NEW.academic_year, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.total_target_pages,0) IS DISTINCT FROM COALESCE(OLD.total_target_pages,0) THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'total_target_pages', OLD.total_target_pages::text, NEW.total_target_pages::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.daily_memorization_pages,0) IS DISTINCT FROM COALESCE(OLD.daily_memorization_pages,0) THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'daily_memorization_pages', OLD.daily_memorization_pages::text, NEW.daily_memorization_pages::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.daily_review_pages,0) IS DISTINCT FROM COALESCE(OLD.daily_review_pages,0) THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'daily_review_pages', OLD.daily_review_pages::text, NEW.daily_review_pages::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.daily_linking_pages,0) IS DISTINCT FROM COALESCE(OLD.daily_linking_pages,0) THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'daily_linking_pages', OLD.daily_linking_pages::text, NEW.daily_linking_pages::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.start_date::text,'') IS DISTINCT FROM COALESCE(OLD.start_date::text,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'start_date', OLD.start_date::text, NEW.start_date::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.end_date::text,'') IS DISTINCT FROM COALESCE(OLD.end_date::text,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'end_date', OLD.end_date::text, NEW.end_date::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.halaqa_id::text,'') IS DISTINCT FROM COALESCE(OLD.halaqa_id::text,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NEW.id, 'updated', 'halaqa_id', OLD.halaqa_id::text, NEW.halaqa_id::text, v_uid, v_name);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_student_plan_insert
AFTER INSERT ON public.student_annual_plans
FOR EACH ROW EXECUTE FUNCTION public.log_student_plan_change();

CREATE TRIGGER trg_log_student_plan_update
AFTER UPDATE ON public.student_annual_plans
FOR EACH ROW EXECUTE FUNCTION public.log_student_plan_change();