
CREATE TABLE public.summer_plan_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  summer_student_id UUID NOT NULL REFERENCES public.summer_students(id) ON DELETE CASCADE,
  old_plan_type TEXT,
  new_plan_type TEXT,
  old_plan_track TEXT,
  new_plan_track TEXT,
  old_plan_goal TEXT,
  new_plan_goal TEXT,
  old_assigned_reciter TEXT,
  new_assigned_reciter TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_summer_plan_change_log_student ON public.summer_plan_change_log(summer_student_id, created_at DESC);

GRANT SELECT ON public.summer_plan_change_log TO authenticated;
GRANT ALL ON public.summer_plan_change_log TO service_role;

ALTER TABLE public.summer_plan_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view summer plan change log"
ON public.summer_plan_change_log FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND p.role IN ('manager','secretary','summer_supervisor','custom_1775663809732'))
);

CREATE OR REPLACE FUNCTION public.log_summer_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT;
BEGIN
  IF (COALESCE(NEW.plan_type,'') IS DISTINCT FROM COALESCE(OLD.plan_type,''))
     OR (COALESCE(NEW.plan_track,'') IS DISTINCT FROM COALESCE(OLD.plan_track,''))
     OR (COALESCE(NEW.plan_goal,'') IS DISTINCT FROM COALESCE(OLD.plan_goal,''))
     OR (COALESCE(NEW.assigned_reciter,'') IS DISTINCT FROM COALESCE(OLD.assigned_reciter,'')) THEN

    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

    INSERT INTO public.summer_plan_change_log (
      summer_student_id,
      old_plan_type, new_plan_type,
      old_plan_track, new_plan_track,
      old_plan_goal, new_plan_goal,
      old_assigned_reciter, new_assigned_reciter,
      changed_by, changed_by_name
    ) VALUES (
      NEW.id,
      OLD.plan_type, NEW.plan_type,
      OLD.plan_track, NEW.plan_track,
      OLD.plan_goal, NEW.plan_goal,
      OLD.assigned_reciter, NEW.assigned_reciter,
      v_uid, v_name
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_summer_plan_change
AFTER UPDATE ON public.summer_students
FOR EACH ROW
EXECUTE FUNCTION public.log_summer_plan_change();
