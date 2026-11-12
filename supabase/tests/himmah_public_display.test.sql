-- Database acceptance tests for public.himmah_public_display.
-- Run as a privileged SQL script. Every fixture is rolled back.
BEGIN;

DO $test$
DECLARE
  day_one uuid := gen_random_uuid();
  day_two uuid := gen_random_uuid();
  key_one uuid := gen_random_uuid();
  key_two uuid := gen_random_uuid();
  session_id uuid;
  owner_id uuid;
  student_one uuid;
  student_two uuid;
  halaqa_one uuid;
  halaqa_two uuid;
  student_name_one text;
  student_name_two text;
  halaqa_name_one text;
  halaqa_name_two text;
  participant_one uuid := gen_random_uuid();
  participant_two uuid := gen_random_uuid();
  participant_three uuid := gen_random_uuid();
  reviewer_one uuid := gen_random_uuid();
  reviewer_two uuid := gen_random_uuid();
  result jsonb;
  h integer;
BEGIN
  SELECT s.id,s.created_by INTO session_id,owner_id
  FROM public.narration_sessions s
  WHERE s.created_by IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1;
  IF session_id IS NULL THEN
    RAISE EXCEPTION 'Test fixture requires an existing narration session owner';
  END IF;

  SELECT s.id,s.halaqa_id,s.full_name,h.name
  INTO student_one,halaqa_one,student_name_one,halaqa_name_one
  FROM public.students s
  JOIN public.halaqat h ON h.id=s.halaqa_id
  ORDER BY s.id
  LIMIT 1;
  SELECT s.id,s.halaqa_id,s.full_name,h.name
  INTO student_two,halaqa_two,student_name_two,halaqa_name_two
  FROM public.students s
  JOIN public.halaqat h ON h.id=s.halaqa_id
  WHERE s.halaqa_id<>halaqa_one
  ORDER BY s.id
  LIMIT 1;
  IF student_one IS NULL OR student_two IS NULL THEN
    RAISE EXCEPTION 'Test fixture requires students in two different halaqat';
  END IF;

  INSERT INTO public.himmah_days(id,session_id,title,day_date,created_by,display_key,ranking_mode)
  VALUES
    (day_one,session_id,'اختبار تجميع طالب',current_date,owner_id,key_one,'completion'),
    (day_two,session_id,'اختبار ترتيب الحلقات',current_date,owner_id,key_two,'completion');

  INSERT INTO public.himmah_participants(id,day_id,student_id,halaqa_id,student_name,halaqa_name,hizbs,present)
  VALUES(participant_one,day_one,student_one,halaqa_one,student_name_one,halaqa_name_one,ARRAY[1,2,3],true);
  INSERT INTO public.himmah_reviewers(id,day_id,full_name)
  VALUES(reviewer_one,day_one,'مسمّع اختبار التجميع');
  FOR h IN 1..3 LOOP
    INSERT INTO public.himmah_attempts(
      participant_id,reviewer_id,hizb,attempt_no,request_id,started_at,ended_at,
      duration_seconds,mistakes,warnings,score,status,approved_at
    ) VALUES(
      participant_one,reviewer_one,h,1,gen_random_uuid(),now(),now(),
      60,0,0,100,'pass',now()
    );
  END LOOP;

  result := public.himmah_public_display(day_one,key_one);
  IF (result->'stats'->>'registered')::integer<>1
    OR (result->'stats'->>'present')::integer<>1
    OR (result->'stats'->>'total')::integer<>3
    OR (result->'stats'->>'presented')::integer<>3
    OR (result->'stats'->>'passed')::integer<>3
    OR (result->'stats'->>'failed')::integer<>0
    OR (result->'stats'->>'remaining_recitation')::integer<>0
    OR (result->'stats'->>'remaining_pass')::integer<>0 THEN
    RAISE EXCEPTION 'Participant totals are incorrect: %',result->'stats';
  END IF;
  IF jsonb_array_length(result->'top_students')<>1
    OR (result->'top_students'->0->>'total')::integer<>3
    OR (result->'top_students'->0->>'presented')::integer<>3
    OR (result->'top_students'->0->>'passed')::integer<>3
    OR (result->'top_students'->0->>'completion')::numeric<>100 THEN
    RAISE EXCEPTION 'Student aggregation is incorrect: %',result->'top_students';
  END IF;
  IF result->'best_halaqa'->>'halaqa_name'<>halaqa_name_one
    OR (result->'best_halaqa'->>'registered')::integer<>1
    OR (result->'best_halaqa'->>'present')::integer<>1
    OR (result->'best_halaqa'->>'total')::integer<>3
    OR (result->'best_halaqa'->>'completion')::numeric<>100 THEN
    RAISE EXCEPTION 'Single-halaqa aggregation is incorrect: %',result->'best_halaqa';
  END IF;
  RAISE NOTICE 'PASS: one present student, three planned/presented/passed hizbs, zero remaining, 100 percent';

  INSERT INTO public.himmah_participants(id,day_id,student_id,halaqa_id,student_name,halaqa_name,hizbs,present)
  VALUES
    (participant_two,day_two,student_one,halaqa_one,student_name_one,halaqa_name_one,ARRAY[1],true),
    (participant_three,day_two,student_two,halaqa_two,student_name_two,halaqa_name_two,ARRAY[1,2],true);
  INSERT INTO public.himmah_reviewers(id,day_id,full_name)
  VALUES(reviewer_two,day_two,'مسمّع اختبار الترتيب');
  INSERT INTO public.himmah_attempts(
    participant_id,reviewer_id,hizb,attempt_no,request_id,started_at,ended_at,
    duration_seconds,mistakes,warnings,score,status,approved_at
  ) VALUES
    (participant_two,reviewer_two,1,1,gen_random_uuid(),now(),now(),60,0,0,100,'pass',now()),
    (participant_three,reviewer_two,1,1,gen_random_uuid(),now(),now(),60,0,0,100,'pass',now());

  result := public.himmah_public_display(day_two,key_two);
  IF result->'best_halaqa'->>'halaqa_name'<>halaqa_name_one
    OR (result->'best_halaqa'->>'completion')::numeric<>100
    OR (result->'top_halaqat'->1->>'halaqa_name')<>halaqa_name_two
    OR (result->'top_halaqat'->1->>'completion')::numeric<>50 THEN
    RAISE EXCEPTION 'Halaqa ranking is incorrect: %',result->'top_halaqat';
  END IF;
  IF (result->'top_halaqat'->0->>'registered')::integer<>1
    OR (result->'top_halaqat'->0->>'present')::integer<>1
    OR (result->'top_halaqat'->0->>'total')::integer<>1
    OR (result->'top_halaqat'->1->>'registered')::integer<>1
    OR (result->'top_halaqat'->1->>'present')::integer<>1
    OR (result->'top_halaqat'->1->>'total')::integer<>2 THEN
    RAISE EXCEPTION 'Halaqa participants or planned hizbs were duplicated: %',result->'top_halaqat';
  END IF;
  RAISE NOTICE 'PASS: best halaqa ranks 100 percent above 50 percent without duplicated participants or plans';
END
$test$;

ROLLBACK;
