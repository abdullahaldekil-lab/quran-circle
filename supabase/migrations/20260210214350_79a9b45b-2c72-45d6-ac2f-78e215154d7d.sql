
-- Add new columns to trips table for full activity management
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS trip_type text NOT NULL DEFAULT 'recreational',
ADD COLUMN IF NOT EXISTS start_time time,
ADD COLUMN IF NOT EXISTS end_time time,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS capacity integer,
ADD COLUMN IF NOT EXISTS supervising_teacher_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS estimated_return_time time;

-- Create trip_attendance table
CREATE TABLE IF NOT EXISTS public.trip_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, student_id)
);

ALTER TABLE public.trip_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage trip attendance"
ON public.trip_attendance FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Guardians can view trip attendance"
ON public.trip_attendance FOR SELECT
USING (student_id IN (
  SELECT gs.student_id FROM guardian_students gs WHERE gs.guardian_id = auth.uid()
));

-- Create trip_halaqat junction table
CREATE TABLE IF NOT EXISTS public.trip_halaqat (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  halaqa_id uuid NOT NULL REFERENCES public.halaqat(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, halaqa_id)
);

ALTER TABLE public.trip_halaqat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage trip halaqat"
ON public.trip_halaqat FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Guardians can view trip halaqat"
ON public.trip_halaqat FOR SELECT
USING (EXISTS (
  SELECT 1 FROM guardian_students gs
  JOIN students s ON s.id = gs.student_id
  JOIN trip_halaqat th ON th.halaqa_id = s.halaqa_id
  WHERE gs.guardian_id = auth.uid() AND th.trip_id = trip_halaqat.trip_id
));

-- Create trip_status_log for tracking status changes
CREATE TABLE IF NOT EXISTS public.trip_status_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.trip_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage trip status logs"
ON public.trip_status_log FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Guardians can view trip status logs"
ON public.trip_status_log FOR SELECT
USING (trip_id IN (
  SELECT t.id FROM trips t
  JOIN trip_halaqat th ON th.trip_id = t.id
  JOIN students s ON s.halaqa_id = th.halaqa_id
  JOIN guardian_students gs ON gs.student_id = s.id
  WHERE gs.guardian_id = auth.uid()
));

-- Update trips RLS to also allow guardians to see trips via trip_halaqat
CREATE POLICY "Guardians can view trips via halaqat"
ON public.trips FOR SELECT
USING (id IN (
  SELECT th.trip_id FROM trip_halaqat th
  JOIN students s ON s.halaqa_id = th.halaqa_id
  JOIN guardian_students gs ON gs.student_id = s.id
  WHERE gs.guardian_id = auth.uid()
));
