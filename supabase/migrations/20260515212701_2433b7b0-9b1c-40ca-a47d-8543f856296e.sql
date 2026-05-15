ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_code TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_student_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.student_code IS NULL THEN
    LOOP
      NEW.student_code := 'HW' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE student_code = NEW.student_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_student_code ON public.students;
CREATE TRIGGER auto_student_code
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.generate_student_code();

DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.students WHERE student_code IS NULL LOOP
    LOOP
      new_code := 'HW' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE student_code = new_code);
    END LOOP;
    UPDATE public.students SET student_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_code ON public.students(student_code);