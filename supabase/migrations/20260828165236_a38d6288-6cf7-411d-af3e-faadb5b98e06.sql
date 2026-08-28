-- Purge targets registry
CREATE OR REPLACE FUNCTION public.student_purge_targets()
RETURNS TABLE(tbl text, col text, label_ar text)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT * FROM (VALUES
    ('attendance','student_id','الحضور والغياب'),
    ('attendance_audit_log','student_id','سجل تدقيق الحضور'),
    ('student_excuse_requests','student_id','طلبات الاستئذان'),
    ('recitation_records','student_id','سجلات التسميع'),
    ('narration_attempts','student_id','محاولات السرد'),
    ('narration_results','student_id','نتائج السرد'),
    ('narration_test_results','student_id','نتائج اختبار السرد'),
    ('madarij_daily_progress','student_id','مدارج: المتابعة اليومية'),
    ('madarij_hizb_exams','student_id','مدارج: اختبارات الأحزاب'),
    ('madarij_mistakes','student_id','مدارج: الأخطاء'),
    ('madarij_level_changes','student_id','مدارج: تغييرات المستوى'),
    ('madarij_enrollments','student_id','مدارج: التسجيلات'),
    ('student_plan_progress','student_id','تقدم الخطة'),
    ('student_plan_change_log','student_id','سجل تغييرات الخطة'),
    ('student_annual_plans','student_id','الخطط السنوية'),
    ('student_levels','student_id','مستويات الحفظ (قديم)'),
    ('student_quizzes','student_id','الاختبارات الذكية'),
    ('program_quiz_results','student_id','نتائج اختبارات البرامج'),
    ('program_material_views','student_id','مشاهدات مواد البرامج'),
    ('tarbawi_weekly_records','student_id','التربوي: السجلات الأسبوعية'),
    ('tarbawi_exam_scores','student_id','التربوي: درجات الاختبارات'),
    ('tarbawi_practice_attempts','student_id','التربوي: محاولات التدريب'),
    ('tarbawi_survey_responses','student_id','التربوي: ردود الاستبيانات'),
    ('tarbawi_survey_invites','student_id','التربوي: دعوات الاستبيانات'),
    ('teacher_evaluations','student_id','تقييمات المعلم'),
    ('talqeen_session_attendance','student_id','التلقين: حضور الجلسات'),
    ('talqeen_student_tests','student_id','التلقين: اختبارات الطلاب'),
    ('talqeen_student_curricula','student_id','التلقين: المناهج المرتبطة'),
    ('summer_students','student_id','البرنامج الصيفي'),
    ('trip_attendance','student_id','حضور الرحلات'),
    ('student_points','student_id','النقاط'),
    ('student_badges','student_id','الأوسمة'),
    ('reward_nominations','student_id','ترشيحات المكافآت'),
    ('distinguished_students','student_id','الطلاب المتميزون'),
    ('student_bus_assignments','student_id','تعيينات الباصات'),
    ('student_status_log','student_id','سجل حالة الطالب')
  ) AS v(tbl, col, label_ar);
$$;

REVOKE ALL ON FUNCTION public.student_purge_targets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_purge_targets() TO authenticated, service_role;

-- Authorization helper
CREATE OR REPLACE FUNCTION public.can_purge_students()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_staff_role(auth.uid()) IN ('manager','secretary');
$$;

REVOKE ALL ON FUNCTION public.can_purge_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_purge_students() TO authenticated, service_role;

-- Preview counts (single student when _student_id given, otherwise all students)
CREATE OR REPLACE FUNCTION public.preview_student_purge(_student_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  cnt bigint;
  out jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_purge_students() THEN
    RAISE EXCEPTION 'غير مصرح: التصفير للمدير والسكرتير فقط';
  END IF;

  FOR r IN SELECT * FROM public.student_purge_targets() LOOP
    IF _student_id IS NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NOT NULL', r.tbl, r.col) INTO cnt;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.tbl, r.col) INTO cnt USING _student_id;
    END IF;
    out := out || jsonb_build_object('table', r.tbl, 'label', r.label_ar, 'count', cnt);
  END LOOP;

  RETURN out;
END $$;

REVOKE ALL ON FUNCTION public.preview_student_purge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_student_purge(uuid) TO authenticated, service_role;

-- Purge records for one student or all students
CREATE OR REPLACE FUNCTION public.purge_student_records(_student_id uuid DEFAULT NULL, _tables text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  cnt bigint;
  _total bigint := 0;
  _stats jsonb := '{}'::jsonb;
  sel text[] := _tables;
BEGIN
  IF NOT public.can_purge_students() THEN
    RAISE EXCEPTION 'غير مصرح: التصفير للمدير والسكرتير فقط';
  END IF;

  IF sel IS NOT NULL AND array_length(sel, 1) IS NULL THEN
    RAISE EXCEPTION 'يجب اختيار نوع بيانات واحد على الأقل';
  END IF;

  FOR r IN SELECT * FROM public.student_purge_targets() LOOP
    IF sel IS NOT NULL AND NOT (r.tbl = ANY(sel)) THEN
      CONTINUE;
    END IF;

    IF _student_id IS NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE %I IS NOT NULL', r.tbl, r.col);
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col) USING _student_id;
    END IF;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    _stats := _stats || jsonb_build_object(r.tbl, cnt);
    _total := _total + cnt;
  END LOOP;

  INSERT INTO public.admin_audit_log (actor_user_id, action_type, details)
  VALUES (
    auth.uid(),
    CASE WHEN _student_id IS NULL THEN 'purge_all_student_records' ELSE 'purge_student_records' END,
    jsonb_build_object('student_id', _student_id, 'total', _total, 'stats', _stats)::text
  );

  RETURN jsonb_build_object('total', _total, 'stats', _stats);
END $$;

REVOKE ALL ON FUNCTION public.purge_student_records(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_student_records(uuid, text[]) TO authenticated, service_role;

-- Permanent student deletion
CREATE OR REPLACE FUNCTION public.delete_student_permanently(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_code text;
  v_purged jsonb;
BEGIN
  IF NOT public.can_purge_students() THEN
    RAISE EXCEPTION 'غير مصرح: الحذف النهائي للمدير والسكرتير فقط';
  END IF;

  SELECT full_name, student_code INTO v_name, v_code
  FROM public.students WHERE id = _student_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'الطالب غير موجود';
  END IF;

  -- remove all dependent records first (handles non-cascading FKs)
  v_purged := public.purge_student_records(_student_id, NULL);

  UPDATE public.enrollment_requests SET converted_student_id = NULL WHERE converted_student_id = _student_id;
  UPDATE public.pre_registrations SET converted_student_id = NULL WHERE converted_student_id = _student_id;
  UPDATE public.guardian_link_requests SET matched_student_id = NULL WHERE matched_student_id = _student_id;
  UPDATE public.guardian_messages SET student_id = NULL WHERE student_id = _student_id;
  DELETE FROM public.guardian_students WHERE student_id = _student_id;

  DELETE FROM public.students WHERE id = _student_id;

  INSERT INTO public.admin_audit_log (actor_user_id, action_type, details)
  VALUES (
    auth.uid(),
    'delete_student_permanently',
    jsonb_build_object('student_id', _student_id, 'full_name', v_name, 'student_code', v_code, 'purged', v_purged)::text
  );

  RETURN jsonb_build_object('deleted', true, 'student_id', _student_id, 'full_name', v_name, 'purged', v_purged);
END $$;

REVOKE ALL ON FUNCTION public.delete_student_permanently(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_student_permanently(uuid) TO authenticated, service_role;