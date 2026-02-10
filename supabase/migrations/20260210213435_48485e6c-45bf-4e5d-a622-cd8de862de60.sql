
-- Guardian profiles table
CREATE TABLE public.guardian_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guardian_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians can view own profile" ON public.guardian_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Guardians can update own profile" ON public.guardian_profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Staff can view guardian profiles" ON public.guardian_profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Staff can manage guardian profiles" ON public.guardian_profiles
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));

-- Guardian-student linking table
CREATE TABLE public.guardian_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.guardian_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guardian_id, student_id)
);

ALTER TABLE public.guardian_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians can view own links" ON public.guardian_students
  FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "Staff can manage guardian links" ON public.guardian_students
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));

-- Trips table for activity tracking
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  trip_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage trips" ON public.trips
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Guardians can view relevant trips" ON public.trips
  FOR SELECT USING (
    halaqa_id IN (
      SELECT s.halaqa_id FROM public.students s
      JOIN public.guardian_students gs ON gs.student_id = s.id
      WHERE gs.guardian_id = auth.uid()
    )
  );

-- Update trigger for timestamps
CREATE TRIGGER update_guardian_profiles_updated_at
  BEFORE UPDATE ON public.guardian_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user to support guardian signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'user_type' = 'guardian' THEN
    INSERT INTO public.guardian_profiles (id, full_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'ولي أمر'),
      NEW.raw_user_meta_data->>'phone'
    );
  ELSE
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
      NEW.raw_user_meta_data->>'phone'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
