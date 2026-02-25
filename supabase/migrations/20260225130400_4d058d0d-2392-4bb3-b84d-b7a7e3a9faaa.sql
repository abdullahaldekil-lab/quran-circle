
-- 1) مسارات التميّز
CREATE TABLE public.excellence_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) الطلاب المميزون
CREATE TABLE public.distinguished_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.excellence_tracks(id) ON DELETE CASCADE,
  is_star BOOLEAN NOT NULL DEFAULT true,
  added_by UUID,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(student_id, track_id)
);

-- 3) إعدادات المسار
CREATE TABLE public.excellence_track_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.excellence_tracks(id) ON DELETE CASCADE UNIQUE,
  min_monthly_performance NUMERIC DEFAULT 0,
  min_attendance_rate NUMERIC DEFAULT 0,
  min_hizb_count NUMERIC DEFAULT 0,
  auto_remove_on_failure BOOLEAN DEFAULT false,
  auto_notify_parent BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.excellence_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distinguished_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excellence_track_settings ENABLE ROW LEVEL SECURITY;

-- excellence_tracks policies
CREATE POLICY "Staff can view excellence tracks" ON public.excellence_tracks
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage excellence tracks" ON public.excellence_tracks
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- distinguished_students policies
CREATE POLICY "Staff can view distinguished students" ON public.distinguished_students
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage distinguished students" ON public.distinguished_students
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Teacher can manage distinguished students" ON public.distinguished_students
  FOR ALL USING (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']))
  WITH CHECK (get_staff_role(auth.uid()) = ANY (ARRAY['teacher', 'assistant_teacher']));

-- excellence_track_settings policies
CREATE POLICY "Staff can view track settings" ON public.excellence_track_settings
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);

CREATE POLICY "Manager can manage track settings" ON public.excellence_track_settings
  FOR ALL USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- updated_at triggers
CREATE TRIGGER update_excellence_tracks_updated_at
  BEFORE UPDATE ON public.excellence_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distinguished_students_updated_at
  BEFORE UPDATE ON public.distinguished_students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_excellence_track_settings_updated_at
  BEFORE UPDATE ON public.excellence_track_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
