BEGIN;
DO $$
DECLARE actor uuid; sid uuid; did uuid; rid uuid; result uuid;
BEGIN
  SELECT id INTO actor FROM public.profiles WHERE active AND role='manager' LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'requires manager'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  INSERT INTO public.narration_sessions(title,session_date,created_by) VALUES('delete test',current_date,actor) RETURNING id INTO sid;
  INSERT INTO public.himmah_days(session_id,title,day_date,created_by) VALUES(sid,'delete test',current_date,actor) RETURNING id INTO did;
  INSERT INTO public.himmah_reviewers(day_id,full_name) VALUES(did,'test reviewer') RETURNING id INTO rid;
  INSERT INTO public.himmah_audit(day_id,action) VALUES(did,'test');
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.delete_narration_session(sid);
    RAISE EXCEPTION 'unauthenticated deletion allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF NOT EXISTS(SELECT 1 FROM public.narration_sessions WHERE id=sid) THEN RAISE EXCEPTION 'denied delete changed data'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  result:=public.delete_narration_session(sid);
  IF result IS DISTINCT FROM sid THEN RAISE EXCEPTION 'wrong session result'; END IF;
  IF EXISTS(SELECT 1 FROM public.narration_sessions WHERE id=sid) OR EXISTS(SELECT 1 FROM public.himmah_days WHERE id=did) OR EXISTS(SELECT 1 FROM public.himmah_reviewers WHERE id=rid) OR EXISTS(SELECT 1 FROM public.himmah_audit WHERE day_id=did) THEN RAISE EXCEPTION 'linked data survived'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.admin_audit_log WHERE actor_user_id=actor AND action_type='delete_narration_session' AND details::jsonb->>'session_id'=sid::text) THEN RAISE EXCEPTION 'missing audit'; END IF;
  BEGIN
    PERFORM public.delete_narration_session(sid);
    RAISE EXCEPTION 'missing session returned success';
  EXCEPTION WHEN no_data_found THEN NULL; END;
END $$;
ROLLBACK;