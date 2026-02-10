
-- Create roles enum
CREATE TYPE public.staff_role AS ENUM (
  'manager', 'secretary', 'supervisor', 'assistant_supervisor', 
  'admin_staff', 'teacher', 'assistant_teacher'
);

CREATE TYPE public.student_status AS ENUM ('active', 'inactive', 'graduated', 'suspended');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE public.instruction_status AS ENUM ('new', 'in_progress', 'completed');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role staff_role NOT NULL DEFAULT 'teacher',
  position_title TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Halaqat table
CREATE TABLE public.halaqat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id),
  assistant_teacher_id UUID REFERENCES public.profiles(id),
  location TEXT,
  schedule TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.halaqat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view halaqat" ON public.halaqat FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage halaqat" ON public.halaqat FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  halaqa_id UUID REFERENCES public.halaqat(id),
  guardian_name TEXT,
  guardian_phone TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_level TEXT DEFAULT 'مبتدئ',
  total_memorized_pages INTEGER DEFAULT 0,
  status student_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recitation records
CREATE TABLE public.recitation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id),
  teacher_id UUID REFERENCES public.profiles(id),
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memorized_from TEXT,
  memorized_to TEXT,
  review_from TEXT,
  review_to TEXT,
  memorization_quality INTEGER CHECK (memorization_quality BETWEEN 0 AND 50),
  tajweed_score INTEGER CHECK (tajweed_score BETWEEN 0 AND 30),
  mistakes_count INTEGER DEFAULT 0,
  total_score NUMERIC(5,2),
  notes TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recitation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view records" ON public.recitation_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage records" ON public.recitation_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, attendance_date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Manager instructions
CREATE TABLE public.instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_manager_id UUID NOT NULL REFERENCES public.profiles(id),
  to_teacher_id UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  body TEXT,
  priority TEXT DEFAULT 'normal',
  status instruction_status NOT NULL DEFAULT 'new',
  teacher_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view instructions" ON public.instructions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage instructions" ON public.instructions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_instructions_updated_at BEFORE UPDATE ON public.instructions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
