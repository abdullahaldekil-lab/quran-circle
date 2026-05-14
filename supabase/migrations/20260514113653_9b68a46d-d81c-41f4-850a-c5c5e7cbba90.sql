
-- 1) Guardian messages
CREATE TABLE public.guardian_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardian_id UUID NOT NULL REFERENCES public.guardian_profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  recipient_role TEXT NOT NULL DEFAULT 'admin',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT,
  replied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_guardian_messages_guardian ON public.guardian_messages(guardian_id);
CREATE INDEX idx_guardian_messages_status ON public.guardian_messages(status);

ALTER TABLE public.guardian_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians view own messages" ON public.guardian_messages
  FOR SELECT USING (guardian_id = auth.uid());
CREATE POLICY "Guardians create own messages" ON public.guardian_messages
  FOR INSERT WITH CHECK (guardian_id = auth.uid());
CREATE POLICY "Staff view all messages" ON public.guardian_messages
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Staff reply to messages" ON public.guardian_messages
  FOR UPDATE USING (get_staff_role(auth.uid()) = ANY(ARRAY['manager','secretary','admin_staff','supervisor']));

CREATE TRIGGER update_guardian_messages_updated_at BEFORE UPDATE ON public.guardian_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Excuse requests
CREATE TABLE public.student_excuse_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardian_id UUID NOT NULL REFERENCES public.guardian_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_excuse_requests_guardian ON public.student_excuse_requests(guardian_id);
CREATE INDEX idx_excuse_requests_student ON public.student_excuse_requests(student_id);
CREATE INDEX idx_excuse_requests_status ON public.student_excuse_requests(status);

ALTER TABLE public.student_excuse_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians view own excuse requests" ON public.student_excuse_requests
  FOR SELECT USING (guardian_id = auth.uid());
CREATE POLICY "Guardians create own excuse requests" ON public.student_excuse_requests
  FOR INSERT WITH CHECK (
    guardian_id = auth.uid()
    AND student_id IN (SELECT student_id FROM public.guardian_students WHERE guardian_id = auth.uid())
  );
CREATE POLICY "Staff view all excuse requests" ON public.student_excuse_requests
  FOR SELECT USING (get_staff_role(auth.uid()) IS NOT NULL);
CREATE POLICY "Staff manage excuse requests" ON public.student_excuse_requests
  FOR UPDATE USING (get_staff_role(auth.uid()) = ANY(ARRAY['manager','secretary','admin_staff','supervisor']));

CREATE TRIGGER update_excuse_requests_updated_at BEFORE UPDATE ON public.student_excuse_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when an excuse request becomes "approved", insert excused attendance for each weekday in the range
CREATE OR REPLACE FUNCTION public.apply_approved_excuse()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d DATE;
  v_halaqa_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT halaqa_id INTO v_halaqa_id FROM public.students WHERE id = NEW.student_id;
    d := NEW.date_from;
    WHILE d <= NEW.date_to LOOP
      -- Skip Friday (5) and Saturday (6)
      IF EXTRACT(DOW FROM d) NOT IN (5, 6) THEN
        INSERT INTO public.attendance (student_id, halaqa_id, attendance_date, status, notes)
        VALUES (NEW.student_id, v_halaqa_id, d, 'excused', 'استئذان مسبق: ' || NEW.reason)
        ON CONFLICT (student_id, attendance_date) DO UPDATE
          SET status = 'excused', notes = COALESCE(public.attendance.notes,'') || ' | استئذان مسبق';
      END IF;
      d := d + INTERVAL '1 day';
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_approved_excuse
  AFTER UPDATE ON public.student_excuse_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_approved_excuse();

-- 3) Teacher evaluations
CREATE TABLE public.teacher_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardian_id UUID NOT NULL REFERENCES public.guardian_profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  term TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM'),
  rating_treatment SMALLINT NOT NULL CHECK (rating_treatment BETWEEN 1 AND 5),
  rating_performance SMALLINT NOT NULL CHECK (rating_performance BETWEEN 1 AND 5),
  rating_communication SMALLINT NOT NULL CHECK (rating_communication BETWEEN 1 AND 5),
  rating_commitment SMALLINT NOT NULL CHECK (rating_commitment BETWEEN 1 AND 5),
  rating_development SMALLINT NOT NULL CHECK (rating_development BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teacher_eval_teacher ON public.teacher_evaluations(teacher_id);
CREATE INDEX idx_teacher_eval_term ON public.teacher_evaluations(term);

ALTER TABLE public.teacher_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians create own evaluations" ON public.teacher_evaluations
  FOR INSERT WITH CHECK (guardian_id = auth.uid());
CREATE POLICY "Guardians view own evaluations" ON public.teacher_evaluations
  FOR SELECT USING (guardian_id = auth.uid());
CREATE POLICY "Manager views all evaluations" ON public.teacher_evaluations
  FOR SELECT USING (get_staff_role(auth.uid()) = 'manager');
