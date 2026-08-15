CREATE OR REPLACE FUNCTION public.get_student_practice_quizzes(_code TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_student RECORD; v JSONB;
BEGIN
  IF _code IS NULL OR length(_code) < 4 THEN RETURN '[]'::jsonb; END IF;
  SELECT id, halaqa_id INTO v_student FROM public.students
  WHERE student_code = _code AND status = 'active' LIMIT 1;
  IF v_student.id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'topic', q.topic,
    'difficulty', q.difficulty,
    'question_type', q.question_type,
    'questions', q.questions,
    'attempts', (SELECT count(*) FROM public.tarbawi_practice_attempts a
                 WHERE a.quiz_id = q.id AND a.student_id = v_student.id),
    'best_score', (SELECT max(a.score) FROM public.tarbawi_practice_attempts a
                   WHERE a.quiz_id = q.id AND a.student_id = v_student.id)
  ) ORDER BY q.created_at DESC), '[]'::jsonb) INTO v
  FROM public.tarbawi_practice_quizzes q
  WHERE q.active = true
    AND (q.halaqa_id IS NULL OR q.halaqa_id = v_student.halaqa_id);
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_student_practice_quizzes(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_student_practice_attempt(
  _code TEXT, _quiz_id UUID, _answers JSONB, _score NUMERIC, _total INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_student_id UUID;
BEGIN
  IF _code IS NULL OR _quiz_id IS NULL THEN RETURN false; END IF;
  IF _answers IS NULL OR jsonb_typeof(_answers) <> 'array' OR jsonb_array_length(_answers) > 100 THEN RETURN false; END IF;
  IF _score IS NULL OR _score < 0 OR _score > 1000 THEN RETURN false; END IF;
  SELECT id INTO v_student_id FROM public.students
  WHERE student_code = _code AND status = 'active' LIMIT 1;
  IF v_student_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tarbawi_practice_quizzes q WHERE q.id = _quiz_id AND q.active = true) THEN
    RETURN false;
  END IF;
  INSERT INTO public.tarbawi_practice_attempts (quiz_id, student_id, answers, score, total_questions)
  VALUES (_quiz_id, v_student_id, _answers, _score, GREATEST(COALESCE(_total, 0), 0));
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_student_practice_attempt(TEXT, UUID, JSONB, NUMERIC, INTEGER) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_student_pending_surveys(_code TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_student_id UUID; v JSONB;
BEGIN
  IF _code IS NULL OR length(_code) < 4 THEN RETURN '[]'::jsonb; END IF;
  SELECT id INTO v_student_id FROM public.students
  WHERE student_code = _code AND status = 'active' LIMIT 1;
  IF v_student_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'token', i.token,
    'title', s.title,
    'description', s.description,
    'respondent_type', i.respondent_type
  ) ORDER BY i.created_at DESC), '[]'::jsonb) INTO v
  FROM public.tarbawi_survey_invites i
  JOIN public.tarbawi_surveys s ON s.id = i.survey_id
  WHERE i.student_id = v_student_id
    AND i.used_at IS NULL
    AND i.expires_at > now()
    AND s.status = 'active';
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_student_pending_surveys(TEXT) TO anon, authenticated, service_role;