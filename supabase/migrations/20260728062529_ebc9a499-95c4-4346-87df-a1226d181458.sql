ALTER TABLE public.student_levels
  ADD COLUMN IF NOT EXISTS track_kind text NOT NULL DEFAULT 'continuous',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS suspend_reason text,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.student_levels
  DROP CONSTRAINT IF EXISTS student_levels_track_kind_check,
  DROP CONSTRAINT IF EXISTS student_levels_status_check;

ALTER TABLE public.student_levels
  ADD CONSTRAINT student_levels_track_kind_check CHECK (track_kind IN ('annual','continuous')),
  ADD CONSTRAINT student_levels_status_check CHECK (status IN ('active','suspended','completed'));

ALTER TABLE public.student_levels DROP CONSTRAINT IF EXISTS student_levels_student_id_key;
DROP INDEX IF EXISTS public.student_levels_student_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS student_levels_one_active_per_student
  ON public.student_levels (student_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS student_levels_student_idx ON public.student_levels (student_id, status);

DROP TRIGGER IF EXISTS trg_student_levels_updated_at ON public.student_levels;
CREATE TRIGGER trg_student_levels_updated_at
  BEFORE UPDATE ON public.student_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_student_level_change()
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
    VALUES (NEW.student_id, NULL, 'created', 'memorization_track', NULL,
      COALESCE((SELECT name FROM public.level_tracks WHERE id = NEW.level_track_id), '') || ' | جزء ' || COALESCE(NEW.part_number::text,''),
      v_uid, v_name);
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.level_track_id::text,'') IS DISTINCT FROM COALESCE(OLD.level_track_id::text,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NULL, 'updated', 'level_track',
      (SELECT name FROM public.level_tracks WHERE id = OLD.level_track_id),
      (SELECT name FROM public.level_tracks WHERE id = NEW.level_track_id), v_uid, v_name);
  END IF;
  IF COALESCE(NEW.branch_id::text,'') IS DISTINCT FROM COALESCE(OLD.branch_id::text,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NULL, 'updated', 'level_branch', OLD.branch_id::text, NEW.branch_id::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.part_number,0) IS DISTINCT FROM COALESCE(OLD.part_number,0) THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NULL, 'updated', 'level_part', OLD.part_number::text, NEW.part_number::text, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.status,'') IS DISTINCT FROM COALESCE(OLD.status,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NULL, 'updated', 'track_status', OLD.status, NEW.status, v_uid, v_name);
  END IF;
  IF COALESCE(NEW.track_kind,'') IS DISTINCT FROM COALESCE(OLD.track_kind,'') THEN
    INSERT INTO public.student_plan_change_log (student_id, plan_id, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.student_id, NULL, 'updated', 'track_kind', OLD.track_kind, NEW.track_kind, v_uid, v_name);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_student_level_change ON public.student_levels;
CREATE TRIGGER trg_log_student_level_change
  AFTER INSERT OR UPDATE ON public.student_levels
  FOR EACH ROW EXECUTE FUNCTION public.log_student_level_change();