
-- Create staff_task_comments table
CREATE TABLE public.staff_task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.staff_task_comments ENABLE ROW LEVEL SECURITY;

-- Manager full access
CREATE POLICY "Manager can manage all task comments"
ON public.staff_task_comments FOR ALL
USING (get_staff_role(auth.uid()) = 'manager')
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Staff can view comments on tasks they can see
CREATE POLICY "Staff can view relevant task comments"
ON public.staff_task_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_comments.task_id
    AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid() OR t.assigned_to_role = get_staff_role(auth.uid()))
  )
);

-- Staff can add comments on tasks they can see
CREATE POLICY "Staff can add comments"
ON public.staff_task_comments FOR INSERT
WITH CHECK (
  from_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_comments.task_id
    AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid() OR t.assigned_to_role = get_staff_role(auth.uid()))
  )
);
