
CREATE TABLE public.staff_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'عام',
  priority TEXT NOT NULL DEFAULT 'عادي',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_by UUID,
  assigned_to UUID,
  assigned_to_role TEXT,
  due_date DATE,
  due_time TIME,
  reminder_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  completion_note TEXT,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

-- Manager can do everything
CREATE POLICY "Manager can manage all staff tasks"
ON public.staff_tasks FOR ALL
USING (get_staff_role(auth.uid()) = 'manager')
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Supervisors can view/create/update tasks they assigned or are assigned to
CREATE POLICY "Supervisors can manage relevant tasks"
ON public.staff_tasks FOR ALL
USING (
  get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor')
  AND (assigned_by = auth.uid() OR assigned_to = auth.uid() OR assigned_to_role = get_staff_role(auth.uid()))
)
WITH CHECK (
  get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor')
);

-- Staff can view tasks assigned to them or their role
CREATE POLICY "Staff can view assigned tasks"
ON public.staff_tasks FOR SELECT
USING (
  assigned_to = auth.uid()
  OR assigned_to_role = get_staff_role(auth.uid())
  OR assigned_by = auth.uid()
);

-- Staff can update tasks assigned to them (e.g. mark complete)
CREATE POLICY "Staff can update own assigned tasks"
ON public.staff_tasks FOR UPDATE
USING (assigned_to = auth.uid());

-- Staff can create tasks
CREATE POLICY "Staff can create tasks"
ON public.staff_tasks FOR INSERT
WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL AND assigned_by = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER update_staff_tasks_updated_at
BEFORE UPDATE ON public.staff_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
