
-- Strategic Goals (Level 1: 3-5 year goals)
CREATE TABLE public.strategic_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  axis TEXT NOT NULL DEFAULT 'memorization_quality',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT '2030-12-31',
  status TEXT NOT NULL DEFAULT 'not_started',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  is_activated BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strategic Objectives (Level 2: 1-2 year objectives linked to goals)
CREATE TABLE public.strategic_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.strategic_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strategic Tasks (Level 3: weeks/months tasks linked to objectives)
CREATE TABLE public.strategic_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.strategic_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  responsible_role TEXT NOT NULL DEFAULT 'manager',
  assigned_to UUID REFERENCES public.profiles(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'not_started',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strategic change log
CREATE TABLE public.strategic_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategic_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_change_log ENABLE ROW LEVEL SECURITY;

-- Goals: Manager full access, others read-only
CREATE POLICY "Manager can manage goals" ON public.strategic_goals
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view goals" ON public.strategic_goals
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

-- Objectives: Manager full, supervisor can create/update
CREATE POLICY "Manager can manage objectives" ON public.strategic_objectives
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Supervisor can manage objectives" ON public.strategic_objectives
  FOR ALL USING (get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor'))
  WITH CHECK (get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor'));

CREATE POLICY "Staff can view objectives" ON public.strategic_objectives
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

-- Tasks: Manager/supervisor full, admin_staff can update assigned
CREATE POLICY "Manager can manage tasks" ON public.strategic_tasks
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Supervisor can manage tasks" ON public.strategic_tasks
  FOR ALL USING (get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor'))
  WITH CHECK (get_staff_role(auth.uid()) IN ('supervisor', 'assistant_supervisor'));

CREATE POLICY "Admin staff can view tasks" ON public.strategic_tasks
  FOR SELECT USING (get_staff_role(auth.uid()) IN ('admin_staff', 'teacher', 'assistant_teacher'));

CREATE POLICY "Admin staff can update assigned tasks" ON public.strategic_tasks
  FOR UPDATE USING (
    get_staff_role(auth.uid()) = 'admin_staff' AND assigned_to = auth.uid()
  );

-- Change log policies
CREATE POLICY "Staff can view change log" ON public.strategic_change_log
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can insert change log" ON public.strategic_change_log
  FOR INSERT WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);

-- Updated at triggers
CREATE TRIGGER update_strategic_goals_updated_at
  BEFORE UPDATE ON public.strategic_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strategic_objectives_updated_at
  BEFORE UPDATE ON public.strategic_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strategic_tasks_updated_at
  BEFORE UPDATE ON public.strategic_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
