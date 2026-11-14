BEGIN;
DO $$
DECLARE actor uuid; sid uuid; did uuid; pid uuid; aid uuid; a public.himmah_attempts; result jsonb; corrected jsonb; sample public.himmah_participants;
BEGIN
  SELECT id INTO actor FROM public.profiles WHERE active AND role='manager' LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'requires manager'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SELECT * INTO sample FROM public.himmah_participants WHERE cardinality(hizbs)>0 LIMIT 1;
  IF sample.id IS NULL THEN RAISE EXCEPTION 'requires linked participant'; END IF;
  did:=public.himmah_manage('create',NULL,jsonb_build_object('title','minimum duration test','day_date',current_date));
  SELECT session_id INTO sid FROM public.himmah_days WHERE id=did;
  UPDATE public.himmah_days SET halaqa_ids=ARRAY[sample.halaqa_id] WHERE id=did;
  INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,hizbs) VALUES(did,sample.student_id,sample.halaqa_id,sample.student_name,sample.halaqa_name,sample.hizbs) RETURNING id INTO pid;
  result:=public.himmah_attempt_v2('start',did,pid,sample.hizbs[1],NULL,gen_random_uuid()); aid:=(result->>'id')::uuid;
  BEGIN
    PERFORM public.himmah_attempt_v2('end',did,NULL,NULL,aid);
    RAISE EXCEPTION 'early completion allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'لا يمكن إنهاء الحزب قبل الحد الأدنى%' THEN RAISE; END IF; END;
  UPDATE public.himmah_attempts SET started_at=clock_timestamp()-interval '12 minutes',paused_seconds=60 WHERE id=aid;
  result:=public.himmah_attempt_v2('counts',did,NULL,NULL,aid,NULL,1,1,1);
  IF result->>'status' IS DISTINCT FROM 'running' OR result->>'duration_seconds' IS NOT NULL THEN RAISE EXCEPTION 'timer auto-stopped'; END IF;
  result:=public.himmah_attempt_v2('end',did,NULL,NULL,aid,NULL,1,1,1);
  IF (result->>'duration_seconds')::integer IS DISTINCT FROM 660 THEN RAISE EXCEPTION 'duration lost %',result; END IF;
  result:=public.himmah_attempt_v2('approve',did,NULL,NULL,aid);
  IF result->'scoring'->>'timing_rule' IS DISTINCT FROM 'minimum' OR (result->'scoring'->>'minimum_duration_seconds')::integer IS DISTINCT FROM 540 THEN RAISE EXCEPTION 'missing minimum snapshot'; END IF;
  IF (result->>'score')::numeric IS DISTINCT FROM public.himmah_score_v2(1,1,1,result->'scoring') THEN RAISE EXCEPTION 'score changed'; END IF;
  corrected:=public.himmah_correct_v2(aid,2,1,1,'test correction');
  IF (corrected->>'duration_seconds')::integer IS DISTINCT FROM 660 THEN RAISE EXCEPTION 'correction truncated time'; END IF;
  a.started_at:=clock_timestamp()-interval '20 minutes'; a.paused_seconds:=120;
  IF public.himmah_elapsed(a,540,0) IS DISTINCT FROM 1080 THEN RAISE EXCEPTION 'uncapped elapsed wrong'; END IF;
  a.duration_seconds:=725;
  IF public.himmah_elapsed(a,540,0) IS DISTINCT FROM 725 THEN RAISE EXCEPTION 'saved time changed'; END IF;
END $$;
ROLLBACK;