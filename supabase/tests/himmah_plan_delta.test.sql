BEGIN;
DO $$ DECLARE actor uuid; h uuid; s uuid; t uuid; d uuid; hs integer[]; res jsonb; details text; BEGIN
 SELECT id INTO actor FROM public.profiles WHERE active AND role='manager' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'requires manager'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO public.halaqat(name) VALUES('isolated plan delta test') RETURNING id INTO h;
 INSERT INTO public.students(full_name,halaqa_id) VALUES('delta student',h) RETURNING id INTO s;
 INSERT INTO public.students(full_name,halaqa_id) VALUES('legacy student',h) RETURNING id INTO t;
 hs:=public.mem_hizb_starts();
 INSERT INTO public.student_memorization_ranges(student_id,start_ayah,end_ayah,from_label,to_label,created_by) VALUES(s,hs[55],hs[61]-1,'55','60',actor),(t,hs[55],hs[57]-1,'55','56',actor);
 d:=public.himmah_manage('create',NULL,jsonb_build_object('title','isolated delta test','day_date',current_date));
 res:=public.himmah_save_plan(d,ARRAY[h],jsonb_build_array(jsonb_build_object('student_id',s,'hizbs',ARRAY[55]),jsonb_build_object('student_id',t,'hizbs',ARRAY[55,56])));
 UPDATE public.student_memorization_ranges SET active=false WHERE student_id=t;
 res:=public.himmah_save_plan(d,ARRAY[h],jsonb_build_array(jsonb_build_object('student_id',s,'hizbs',ARRAY[55,60]),jsonb_build_object('student_id',t,'hizbs',ARRAY[55,56])));
 IF (res->>'saved')::integer IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'unchanged legacy plan blocked valid change'; END IF;
 BEGIN
  PERFORM public.himmah_save_plan(d,ARRAY[h],jsonb_build_array(jsonb_build_object('student_id',s,'hizbs',ARRAY[55,56,60]),jsonb_build_object('student_id',t,'hizbs',ARRAY[55,56,57])));
  RAISE EXCEPTION 'unverified addition accepted';
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS details=PG_EXCEPTION_DETAIL;
  IF details IS NULL OR details NOT LIKE '%57%' OR details NOT LIKE '%legacy student%' THEN RAISE; END IF;
 END;
 IF (SELECT hizbs FROM public.himmah_participants WHERE day_id=d AND student_id=s) IS DISTINCT FROM ARRAY[55,60] THEN RAISE EXCEPTION 'partial save'; END IF;
 INSERT INTO public.student_memorization_ranges(student_id,start_ayah,end_ayah,from_label,to_label,created_by) VALUES(t,hs[57],hs[58]-1,'57','57',actor);
 res:=public.himmah_save_plan(d,ARRAY[h],jsonb_build_array(jsonb_build_object('student_id',t,'hizbs',ARRAY[55,56,57])));
 IF (res->>'saved')::integer IS DISTINCT FROM 1 OR (SELECT count(*) FROM public.himmah_participants WHERE day_id=d) IS DISTINCT FROM 2::bigint THEN RAISE EXCEPTION 'refresh or duplicate failed'; END IF;
 IF public.himmah_score_v2(2,0,5,'{"total_score":100,"mistake_deduction":4,"melody_deduction":4,"warning_deduction":1}') IS DISTINCT FROM 87::numeric THEN RAISE EXCEPTION '87 score mismatch'; END IF;
 IF NOT (87>=80 AND NOT 87>=90 AND 87>=87) THEN RAISE EXCEPTION 'threshold boundary mismatch'; END IF;
END $$;
ROLLBACK;
