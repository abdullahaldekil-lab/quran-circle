
-- 1. Add late_excused status to attendance
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'late_excused';

-- 2. Add tardiness/absent minute thresholds to preparation_config
ALTER TABLE public.preparation_config
  ADD COLUMN IF NOT EXISTS tardiness_minutes INTEGER DEFAULT 70,
  ADD COLUMN IF NOT EXISTS absent_minutes INTEGER DEFAULT 100;

-- 3. Staff Check-in QR
CREATE TABLE IF NOT EXISTS public.staff_checkin_qr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  radius_meters INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_checkin_qr TO authenticated;
GRANT ALL ON public.staff_checkin_qr TO service_role;
ALTER TABLE public.staff_checkin_qr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active QR" ON public.staff_checkin_qr
  FOR SELECT TO authenticated USING (active = true OR public.get_staff_role(auth.uid()) IN ('manager','supervisor'));
CREATE POLICY "Managers manage QR" ON public.staff_checkin_qr
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IN ('manager','supervisor'))
  WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager','supervisor'));

-- Add source column on staff_attendance if not exists
ALTER TABLE public.staff_attendance
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 4. Summer Program tables
CREATE TABLE IF NOT EXISTS public.summer_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summer_programs TO authenticated;
GRANT ALL ON public.summer_programs TO service_role;
ALTER TABLE public.summer_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read summer programs" ON public.summer_programs
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage summer programs" ON public.summer_programs
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IN ('manager','supervisor'))
  WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager','supervisor'));

CREATE TABLE IF NOT EXISTS public.summer_maqare (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.summer_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  maqra_type TEXT NOT NULL DEFAULT 'hifz',
  teacher_id UUID REFERENCES auth.users(id),
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summer_maqare TO authenticated;
GRANT ALL ON public.summer_maqare TO service_role;
ALTER TABLE public.summer_maqare ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read maqare" ON public.summer_maqare
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage maqare" ON public.summer_maqare
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IN ('manager','supervisor'))
  WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager','supervisor'));

CREATE TABLE IF NOT EXISTS public.summer_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maqra_id UUID NOT NULL REFERENCES public.summer_maqare(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  source_halaqa_id UUID REFERENCES public.halaqat(id),
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(maqra_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summer_students TO authenticated;
GRANT ALL ON public.summer_students TO service_role;
ALTER TABLE public.summer_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read summer students" ON public.summer_students
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage summer students" ON public.summer_students
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IN ('manager','supervisor','teacher'))
  WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager','supervisor','teacher'));

CREATE TABLE IF NOT EXISTS public.summer_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summer_student_id UUID NOT NULL REFERENCES public.summer_students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(summer_student_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summer_attendance TO authenticated;
GRANT ALL ON public.summer_attendance TO service_role;
ALTER TABLE public.summer_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read summer attendance" ON public.summer_attendance
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Teachers manage summer attendance" ON public.summer_attendance
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IN ('manager','supervisor','teacher'))
  WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager','supervisor','teacher'));

-- 5. Program Materials
CREATE TABLE IF NOT EXISTS public.program_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID,
  title TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'book',
  url TEXT,
  file_path TEXT,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_materials TO authenticated;
GRANT ALL ON public.program_materials TO service_role;
ALTER TABLE public.program_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read program materials" ON public.program_materials
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND active = true);
CREATE POLICY "Managers manage program materials" ON public.program_materials
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) IN ('manager','supervisor'))
  WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager','supervisor'));

-- Triggers for updated_at
CREATE TRIGGER trg_summer_programs_updated BEFORE UPDATE ON public.summer_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_summer_maqare_updated BEFORE UPDATE ON public.summer_maqare
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_program_materials_updated BEFORE UPDATE ON public.program_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_staff_checkin_qr_updated BEFORE UPDATE ON public.staff_checkin_qr
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
