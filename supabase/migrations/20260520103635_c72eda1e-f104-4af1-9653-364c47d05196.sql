
-- staff_attendance
CREATE POLICY "Talqeen supervisor manage staff attendance" ON public.staff_attendance
FOR ALL USING (get_staff_role(auth.uid()) = 'custom_1775663809732')
WITH CHECK (get_staff_role(auth.uid()) = 'custom_1775663809732');

-- staff_tasks
CREATE POLICY "Talqeen supervisor manage staff tasks" ON public.staff_tasks
FOR ALL USING (get_staff_role(auth.uid()) = 'custom_1775663809732')
WITH CHECK (get_staff_role(auth.uid()) = 'custom_1775663809732');

-- staff_task_comments
CREATE POLICY "Talqeen supervisor manage task comments" ON public.staff_task_comments
FOR ALL USING (get_staff_role(auth.uid()) = 'custom_1775663809732')
WITH CHECK (get_staff_role(auth.uid()) = 'custom_1775663809732');

-- internal_requests: view + update all
CREATE POLICY "Talqeen supervisor view internal requests" ON public.internal_requests
FOR SELECT USING (get_staff_role(auth.uid()) = 'custom_1775663809732');

CREATE POLICY "Talqeen supervisor update internal requests" ON public.internal_requests
FOR UPDATE USING (get_staff_role(auth.uid()) = 'custom_1775663809732');

-- internal_request_replies
CREATE POLICY "Talqeen supervisor view internal replies" ON public.internal_request_replies
FOR SELECT USING (get_staff_role(auth.uid()) = 'custom_1775663809732');
