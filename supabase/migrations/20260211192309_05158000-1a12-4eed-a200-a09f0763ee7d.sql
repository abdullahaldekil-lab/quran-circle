
-- Buses table
CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_name text NOT NULL,
  driver_name text,
  driver_phone text,
  capacity integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

-- Staff can view buses
CREATE POLICY "Staff can view buses"
ON public.buses FOR SELECT
USING (get_staff_role(auth.uid()) IS NOT NULL);

-- Manager can manage buses
CREATE POLICY "Manager can manage buses"
ON public.buses FOR ALL
USING (get_staff_role(auth.uid()) = 'manager')
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Admin staff can insert/update buses
CREATE POLICY "Admin staff can manage buses"
ON public.buses FOR ALL
USING (get_staff_role(auth.uid()) IN ('admin_staff', 'secretary'))
WITH CHECK (get_staff_role(auth.uid()) IN ('admin_staff', 'secretary'));

CREATE TRIGGER update_buses_updated_at
BEFORE UPDATE ON public.buses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Student Bus Assignments
CREATE TABLE public.student_bus_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, active)
);

ALTER TABLE public.student_bus_assignments ENABLE ROW LEVEL SECURITY;

-- Staff can view assignments
CREATE POLICY "Staff can view bus assignments"
ON public.student_bus_assignments FOR SELECT
USING (get_staff_role(auth.uid()) IS NOT NULL);

-- Guardians can view their children's assignment
CREATE POLICY "Guardians can view child bus assignment"
ON public.student_bus_assignments FOR SELECT
USING (student_id IN (SELECT gs.student_id FROM guardian_students gs WHERE gs.guardian_id = auth.uid()));

-- Manager can manage assignments
CREATE POLICY "Manager can manage bus assignments"
ON public.student_bus_assignments FOR ALL
USING (get_staff_role(auth.uid()) = 'manager')
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Admin staff can manage assignments
CREATE POLICY "Admin staff can manage bus assignments"
ON public.student_bus_assignments FOR ALL
USING (get_staff_role(auth.uid()) IN ('admin_staff', 'secretary'))
WITH CHECK (get_staff_role(auth.uid()) IN ('admin_staff', 'secretary'));
