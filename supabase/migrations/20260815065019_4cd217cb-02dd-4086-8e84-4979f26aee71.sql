-- ============ 1) PROGRAMS ============
CREATE TABLE public.tarbawi_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  session_weekday SMALLINT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_programs TO authenticated;
GRANT ALL ON public.tarbawi_programs TO service_role;
ALTER TABLE public.tarbawi_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi programs" ON public.tarbawi_programs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi programs" ON public.tarbawi_programs FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE TRIGGER trg_tarbawi_programs_updated BEFORE UPDATE ON public.tarbawi_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2) PROGRAM <-> HALAQAT ============
CREATE TABLE public.tarbawi_program_halaqat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.tarbawi_programs(id) ON DELETE CASCADE,
  halaqa_id UUID NOT NULL REFERENCES public.halaqat(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, halaqa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_program_halaqat TO authenticated;
GRANT ALL ON public.tarbawi_program_halaqat TO service_role;
ALTER TABLE public.tarbawi_program_halaqat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi program halaqat" ON public.tarbawi_program_halaqat FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi program halaqat" ON public.tarbawi_program_halaqat FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));

-- helper: is the current user the teacher (or assistant) of this halaqa?
CREATE OR REPLACE FUNCTION public.is_halaqa_teacher(_halaqa_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.halaqat h
    WHERE h.id = _halaqa_id
      AND (h.teacher_id = auth.uid() OR h.assistant_teacher_id = auth.uid())
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_halaqa_teacher(UUID) TO authenticated, service_role;

-- ============ 3) WEEKLY FOLLOW-UP RECORDS ============
CREATE TABLE public.tarbawi_weekly_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.tarbawi_programs(id) ON DELETE CASCADE,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  session_attendance TEXT,
  reading_pages INTEGER,
  reading_done BOOLEAN,
  listening_minutes INTEGER,
  listening_done BOOLEAN,
  memorization_amount TEXT,
  memorization_done BOOLEAN,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, student_id, week_start)
);
CREATE INDEX idx_tarbawi_weekly_program_week ON public.tarbawi_weekly_records (program_id, week_start);
CREATE INDEX idx_tarbawi_weekly_student ON public.tarbawi_weekly_records (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_weekly_records TO authenticated;
GRANT ALL ON public.tarbawi_weekly_records TO service_role;
ALTER TABLE public.tarbawi_weekly_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supervisors manage tarbawi weekly" ON public.tarbawi_weekly_records FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE POLICY "teachers manage own halaqa weekly" ON public.tarbawi_weekly_records FOR ALL TO authenticated
  USING (public.is_halaqa_teacher(halaqa_id))
  WITH CHECK (public.is_halaqa_teacher(halaqa_id));
CREATE POLICY "guardians read own children weekly" ON public.tarbawi_weekly_records FOR SELECT TO authenticated
  USING (public.is_guardian_of(student_id));
CREATE TRIGGER trg_tarbawi_weekly_updated BEFORE UPDATE ON public.tarbawi_weekly_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 4) EXAMS ============
CREATE TABLE public.tarbawi_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.tarbawi_programs(id) ON DELETE CASCADE,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'monthly',
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  max_score NUMERIC NOT NULL DEFAULT 100,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_exams TO authenticated;
GRANT ALL ON public.tarbawi_exams TO service_role;
ALTER TABLE public.tarbawi_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi exams" ON public.tarbawi_exams FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi exams" ON public.tarbawi_exams FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE POLICY "teachers manage own halaqa exams" ON public.tarbawi_exams FOR ALL TO authenticated
  USING (public.is_halaqa_teacher(halaqa_id))
  WITH CHECK (public.is_halaqa_teacher(halaqa_id));
CREATE TRIGGER trg_tarbawi_exams_updated BEFORE UPDATE ON public.tarbawi_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tarbawi_exam_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.tarbawi_exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score NUMERIC,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_exam_scores TO authenticated;
GRANT ALL ON public.tarbawi_exam_scores TO service_role;
ALTER TABLE public.tarbawi_exam_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supervisors manage tarbawi exam scores" ON public.tarbawi_exam_scores FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE POLICY "teachers manage own halaqa exam scores" ON public.tarbawi_exam_scores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tarbawi_exams e WHERE e.id = exam_id AND public.is_halaqa_teacher(e.halaqa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tarbawi_exams e WHERE e.id = exam_id AND public.is_halaqa_teacher(e.halaqa_id)));
CREATE POLICY "guardians read own children exam scores" ON public.tarbawi_exam_scores FOR SELECT TO authenticated
  USING (public.is_guardian_of(student_id));
CREATE TRIGGER trg_tarbawi_exam_scores_updated BEFORE UPDATE ON public.tarbawi_exam_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 5) AI PRACTICE QUIZZES ============
CREATE TABLE public.tarbawi_practice_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.tarbawi_programs(id) ON DELETE SET NULL,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE SET NULL,
  material_id UUID REFERENCES public.program_materials(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_practice_quizzes TO authenticated;
GRANT ALL ON public.tarbawi_practice_quizzes TO service_role;
ALTER TABLE public.tarbawi_practice_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi practice quizzes" ON public.tarbawi_practice_quizzes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi practice quizzes" ON public.tarbawi_practice_quizzes FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE POLICY "teachers manage own halaqa practice quizzes" ON public.tarbawi_practice_quizzes FOR ALL TO authenticated
  USING (public.is_halaqa_teacher(halaqa_id))
  WITH CHECK (public.is_halaqa_teacher(halaqa_id));
CREATE TRIGGER trg_tarbawi_practice_quizzes_updated BEFORE UPDATE ON public.tarbawi_practice_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tarbawi_practice_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.tarbawi_practice_quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score NUMERIC,
  total_questions INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarbawi_attempts_student ON public.tarbawi_practice_attempts (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_practice_attempts TO authenticated;
GRANT ALL ON public.tarbawi_practice_attempts TO service_role;
ALTER TABLE public.tarbawi_practice_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi practice attempts" ON public.tarbawi_practice_attempts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi practice attempts" ON public.tarbawi_practice_attempts FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE POLICY "guardians read own children attempts" ON public.tarbawi_practice_attempts FOR SELECT TO authenticated
  USING (public.is_guardian_of(student_id));

-- ============ 6) SURVEYS ============
CREATE TABLE public.tarbawi_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.tarbawi_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  audience TEXT NOT NULL DEFAULT 'both',
  phase TEXT NOT NULL DEFAULT 'after',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_surveys TO authenticated;
GRANT ALL ON public.tarbawi_surveys TO service_role;
ALTER TABLE public.tarbawi_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi surveys" ON public.tarbawi_surveys FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi surveys" ON public.tarbawi_surveys FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE TRIGGER trg_tarbawi_surveys_updated BEFORE UPDATE ON public.tarbawi_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tarbawi_survey_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.tarbawi_surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'scale',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_survey_questions TO authenticated;
GRANT ALL ON public.tarbawi_survey_questions TO service_role;
ALTER TABLE public.tarbawi_survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi survey questions" ON public.tarbawi_survey_questions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi survey questions" ON public.tarbawi_survey_questions FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));

CREATE TABLE public.tarbawi_survey_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.tarbawi_surveys(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  respondent_type TEXT NOT NULL DEFAULT 'student',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarbawi_invites_survey ON public.tarbawi_survey_invites (survey_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_survey_invites TO authenticated;
GRANT ALL ON public.tarbawi_survey_invites TO service_role;
ALTER TABLE public.tarbawi_survey_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi survey invites" ON public.tarbawi_survey_invites FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi survey invites" ON public.tarbawi_survey_invites FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE POLICY "guardians read own children invites" ON public.tarbawi_survey_invites FOR SELECT TO authenticated
  USING (student_id IS NOT NULL AND public.is_guardian_of(student_id));

CREATE TABLE public.tarbawi_survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.tarbawi_surveys(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES public.tarbawi_survey_invites(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  respondent_type TEXT NOT NULL DEFAULT 'student',
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarbawi_responses_survey ON public.tarbawi_survey_responses (survey_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_survey_responses TO authenticated;
GRANT ALL ON public.tarbawi_survey_responses TO service_role;
ALTER TABLE public.tarbawi_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tarbawi survey responses" ON public.tarbawi_survey_responses FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage tarbawi survey responses" ON public.tarbawi_survey_responses FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE POLICY "guardians submit for own children" ON public.tarbawi_survey_responses FOR INSERT TO authenticated
  WITH CHECK (student_id IS NOT NULL AND public.is_guardian_of(student_id));

-- public (token-based) survey access
CREATE OR REPLACE FUNCTION public.get_tarbawi_survey_by_token(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 10 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'invite_id', i.id,
    'survey_id', s.id,
    'title', s.title,
    'description', s.description,
    'respondent_type', i.respondent_type,
    'used_at', i.used_at,
    'student_name', st.full_name,
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'question_text', q.question_text, 'question_type', q.question_type,
        'options', q.options, 'required', q.required
      ) ORDER BY q.order_index)
      FROM public.tarbawi_survey_questions q WHERE q.survey_id = s.id
    ), '[]'::jsonb)
  ) INTO v
  FROM public.tarbawi_survey_invites i
  JOIN public.tarbawi_surveys s ON s.id = i.survey_id
  LEFT JOIN public.students st ON st.id = i.student_id
  WHERE i.token = _token AND i.expires_at > now() AND s.status = 'active'
  LIMIT 1;
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_tarbawi_survey_by_token(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_tarbawi_survey(_token TEXT, _answers JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite RECORD;
BEGIN
  IF _token IS NULL OR length(_token) < 10 THEN RETURN false; END IF;
  IF _answers IS NULL OR jsonb_typeof(_answers) <> 'array' OR jsonb_array_length(_answers) > 100 THEN RETURN false; END IF;
  SELECT i.id, i.survey_id, i.student_id, i.respondent_type INTO v_invite
  FROM public.tarbawi_survey_invites i
  JOIN public.tarbawi_surveys s ON s.id = i.survey_id
  WHERE i.token = _token AND i.expires_at > now() AND i.used_at IS NULL AND s.status = 'active'
  LIMIT 1;
  IF v_invite.id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.tarbawi_survey_responses (survey_id, invite_id, student_id, respondent_type, answers)
  VALUES (v_invite.survey_id, v_invite.id, v_invite.student_id, v_invite.respondent_type, _answers);
  UPDATE public.tarbawi_survey_invites SET used_at = now() WHERE id = v_invite.id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_tarbawi_survey(TEXT, JSONB) TO anon, authenticated, service_role;

-- ============ 7) EVENTS CALENDAR ============
CREATE TABLE public.tarbawi_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.tarbawi_programs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'program',
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  description TEXT,
  visible_to_guardians BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarbawi_events_date ON public.tarbawi_events (event_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarbawi_events TO authenticated;
GRANT ALL ON public.tarbawi_events TO service_role;
ALTER TABLE public.tarbawi_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read tarbawi events" ON public.tarbawi_events FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "supervisors manage tarbawi events" ON public.tarbawi_events FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));
CREATE TRIGGER trg_tarbawi_events_updated BEFORE UPDATE ON public.tarbawi_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 8) MATERIAL ASSIGNMENTS ============
CREATE TABLE public.program_material_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.program_materials(id) ON DELETE CASCADE,
  teacher_id UUID,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE CASCADE,
  tarbawi_program_id UUID REFERENCES public.tarbawi_programs(id) ON DELETE CASCADE,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_assignments_material ON public.program_material_assignments (material_id);
CREATE INDEX idx_material_assignments_teacher ON public.program_material_assignments (teacher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_material_assignments TO authenticated;
GRANT ALL ON public.program_material_assignments TO service_role;
ALTER TABLE public.program_material_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read material assignments" ON public.program_material_assignments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supervisors manage material assignments" ON public.program_material_assignments FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor']));