ALTER TABLE public.staff_tasks
  ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_staff_tasks_due_date ON public.staff_tasks (due_date);

CREATE OR REPLACE FUNCTION public.mark_overdue_staff_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN 0;
  END IF;

  FOR v_rec IN
    SELECT id, title, due_date, assigned_to, assigned_by, overdue_notified_at
    FROM public.staff_tasks
    WHERE due_date IS NOT NULL
      AND due_date < CURRENT_DATE
      AND status IN ('pending', 'in_progress')
  LOOP
    UPDATE public.staff_tasks
    SET status = 'overdue',
        overdue_notified_at = COALESCE(v_rec.overdue_notified_at, now())
    WHERE id = v_rec.id;

    IF v_rec.overdue_notified_at IS NULL THEN
      INSERT INTO public.notifications (user_id, title, body, channel, status, meta_data)
      SELECT COALESCE(v_rec.assigned_to, v_rec.assigned_by),
             'مهمة متأخرة',
             'المهمة "' || v_rec.title || '" تجاوزت تاريخ الاستحقاق (' || v_rec.due_date::text || ') ولم تُنفَّذ بعد.',
             'inApp',
             'sent',
             jsonb_build_object('type', 'staff_task_overdue', 'task_id', v_rec.id, 'link', '/tasks-calendar')
      WHERE COALESCE(v_rec.assigned_to, v_rec.assigned_by) IS NOT NULL;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_overdue_staff_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_overdue_staff_tasks() TO authenticated;