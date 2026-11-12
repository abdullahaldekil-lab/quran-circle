BEGIN;

DO $$
DECLARE
  halaqa_id constant uuid := 'e1934ee8-fd6a-477a-9528-ca575e68b550';
  complete_student constant uuid := 'd00d0000-0000-4000-8000-000000000260';
  gap_student constant uuid := 'd00d0000-0000-4000-8000-000000000261';
  plan_student constant uuid := 'd00d0000-0000-4000-8000-000000000262';
BEGIN
  IF public.mem_ayah('الفاتحة 7') <> 7 THEN RAISE EXCEPTION 'first-surah boundary failed'; END IF;
  IF public.mem_ayah('الناس 6') <> 6236 THEN RAISE EXCEPTION 'last-ayah boundary failed'; END IF;
  IF public.mem_ayah('الناس 7') IS NOT NULL THEN RAISE EXCEPTION 'invalid last-surah ayah accepted'; END IF;
  IF public.mem_ayah('المؤمنون 1') <> 2674 THEN RAISE EXCEPTION 'Arabic normalization failed'; END IF;
  IF (public.mem_segment('صفحة 604', 'صفحة 604')).end_ayah <> 6236 THEN RAISE EXCEPTION 'last-page boundary failed'; END IF;

  INSERT INTO public.students (id, full_name, halaqa_id, status) VALUES
    (complete_student, 'اختبار دمج نطاقات مؤقت', halaqa_id, 'active'),
    (gap_student, 'اختبار فجوة مؤقت', halaqa_id, 'active'),
    (plan_student, 'اختبار مستهدف خطة مؤقت', halaqa_id, 'active');

  -- Two overlapping segments must merge into one uninterrupted Hizb 60.
  INSERT INTO public.student_memorization_ranges (student_id, start_ayah, end_ayah, from_label, to_label) VALUES
    (complete_student, 5949, 6100, 'الأعلى 1', 'موضع متداخل'),
    (complete_student, 6050, 6236, 'موضع متداخل', 'الناس 6'),
    (complete_student, 5673, 5800, 'النبإ 1', 'جزء غير مكتمل'),
    (gap_student, 5949, 6235, 'الأعلى 1', 'الناس 5');

  IF public.mem_completed(complete_student) <> ARRAY[60]::integer[] THEN
    RAISE EXCEPTION 'overlap/partial Hizb aggregation failed: %', public.mem_completed(complete_student);
  END IF;
  IF public.mem_completed(gap_student) <> '{}'::integer[] THEN
    RAISE EXCEPTION 'gap incorrectly completed a Hizb';
  END IF;

  -- Planned pages are targets, not evidence of memorization.
  INSERT INTO public.student_annual_plans (student_id, halaqa_id, total_target_pages, daily_memorization_pages)
  VALUES (plan_student, halaqa_id, 604, 1);
  IF public.mem_completed(plan_student) <> '{}'::integer[] THEN
    RAISE EXCEPTION 'plan target incorrectly counted as memorization';
  END IF;

  UPDATE public.student_annual_plans
  SET previous_memorized_ranges = '[{"from":"الفاتحة 1","to":"البقرة 74","pages":4}]'::jsonb
  WHERE student_id = plan_student;
  IF public.mem_completed(plan_student) <> ARRAY[1]::integer[] THEN
    RAISE EXCEPTION 'documented previous plan range was not counted';
  END IF;
END $$;

ROLLBACK;
