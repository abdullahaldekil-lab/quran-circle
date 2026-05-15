CREATE OR REPLACE FUNCTION public.get_student_portal_data(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_month_ago DATE := (now() - interval '60 days')::date;
  v_result JSONB;
BEGIN
  SELECT id, full_name, student_code, halaqa_id
  INTO v_student
  FROM public.students
  WHERE student_code = _code AND status = 'active'
  LIMIT 1;

  IF v_student.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student.id,
      'full_name', v_student.full_name,
      'student_code', v_student.student_code,
      'halaqa_id', v_student.halaqa_id
    ),
    'halaqa', (
      SELECT jsonb_build_object('name', h.name, 'schedule', h.schedule, 'location', h.location)
      FROM public.halaqat h WHERE h.id = v_student.halaqa_id
    ),
    'plan', (
      SELECT jsonb_build_object(
        'id', p.id,
        'plan_type', p.plan_type,
        'target_memorization', p.total_target_pages,
        'progress', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'month_number', pp.month_number,
            'week_number', pp.week_number,
            'target_pages', pp.target_pages,
            'actual_pages', pp.actual_pages,
            'actual_memorization', pp.actual_memorization,
            'actual_review', pp.actual_review,
            'actual_linking', pp.actual_linking,
            'commitment_percentage', pp.commitment_percentage
          ) ORDER BY pp.month_number DESC, pp.week_number DESC)
          FROM public.student_plan_progress pp WHERE pp.plan_id = p.id
        ), '[]'::jsonb)
      )
      FROM public.student_annual_plans p
      WHERE p.student_id = v_student.id AND p.status = 'active'
      LIMIT 1
    ),
    'attendance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'attendance_date', a.attendance_date,
        'status', a.status
      ) ORDER BY a.attendance_date DESC)
      FROM public.attendance a
      WHERE a.student_id = v_student.id
        AND a.attendance_date >= v_month_ago
    ), '[]'::jsonb),
    'narration', COALESCE((
      SELECT jsonb_agg(row_to_json(n)) FROM (
        SELECT test_date, total_score, narration_score, hizb_number, passed, attempt_number, test_type
        FROM public.narration_test_results
        WHERE student_id = v_student.id
        ORDER BY test_date DESC
        LIMIT 5
      ) n
    ), '[]'::jsonb),
    'programs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'start_date', pa.start_date,
        'curriculum_name', tc.name,
        'curriculum_description', tc.description
      ))
      FROM public.talqeen_program_assignments pa
      LEFT JOIN public.talqeen_curricula tc ON tc.id = pa.curriculum_id
      WHERE pa.halaqa_id = v_student.halaqa_id AND pa.is_active = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_portal_data(TEXT) TO anon, authenticated;