-- توثيق التحضير وإعادة التسميع ومنع تزامن الحزب.
ALTER TABLE public.himmah_participants ADD COLUMN IF NOT EXISTS attended_at timestamptz;
ALTER TABLE public.himmah_participants ADD COLUMN IF NOT EXISTS attended_by_name text;
CREATE TABLE IF NOT EXISTS public.himmah_reopenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.himmah_days(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.himmah_participants(id) ON DELETE CASCADE,
  hizb integer NOT NULL CHECK(hizb BETWEEN 1 AND 60),
  reopened_at timestamptz NOT NULL DEFAULT now(),
  reopened_by uuid,
  UNIQUE(participant_id,hizb)
);
GRANT SELECT ON public.himmah_reopenings TO authenticated;
GRANT ALL ON public.himmah_reopenings TO service_role;
ALTER TABLE public.himmah_reopenings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.himmah_days ALTER COLUMN certificate_title SET DEFAULT 'شهادة شكر وتقدير';
ALTER TABLE public.himmah_days ALTER COLUMN certificate_note SET DEFAULT '';
UPDATE public.himmah_days SET certificate_title='شهادة شكر وتقدير' WHERE certificate_title='شهادة إنجاز وتفوق';
UPDATE public.himmah_days SET certificate_note='' WHERE certificate_note='تقديرًا لاجتهاده في تسميع الأحزاب المقررة في يوم السرد – يوم الهمة';

CREATE OR REPLACE FUNCTION public.himmah_attendance(_day uuid,_participant uuid,_present boolean,_token text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.himmah_participants; rid uuid; actor_name text; BEGIN
  SELECT * INTO p FROM public.himmah_participants WHERE id=_participant AND day_id=_day FOR UPDATE; IF p.id IS NULL THEN RAISE EXCEPTION 'الطالب غير موجود في هذا اليوم'; END IF;
  IF _token IS NOT NULL THEN rid:=public.himmah_code_reviewer(_day,_token); IF rid IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF; SELECT full_name INTO actor_name FROM public.himmah_reviewers WHERE id=rid;
  ELSIF NOT public.is_staff(auth.uid()) OR public.get_staff_role(auth.uid()) NOT IN ('manager','teacher','assistant_teacher') THEN RAISE EXCEPTION 'غير مصرح بالتحضير'; END IF;
  IF _token IS NULL THEN IF NOT public.himmah_view_halaqa(p.halaqa_id) THEN RAISE EXCEPTION 'الطالب خارج نطاقك'; END IF; SELECT full_name INTO actor_name FROM public.profiles WHERE id=auth.uid(); END IF;
  UPDATE public.himmah_participants SET present=_present,attended_at=CASE WHEN _present THEN clock_timestamp() ELSE NULL END,attended_by_name=CASE WHEN _present THEN actor_name ELSE NULL END WHERE id=p.id RETURNING * INTO p;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,coalesce(auth.uid(),rid),'attendance',jsonb_build_object('participant_id',p.id,'present',_present,'attended_at',p.attended_at,'attended_by_name',actor_name));
  RETURN to_jsonb(p); END $$;

CREATE OR REPLACE FUNCTION public.himmah_attendance_bulk(_day uuid,_participant_ids uuid[],_present boolean,_token text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; actor_name text; changed integer:=0; BEGIN
  IF _token IS NOT NULL THEN rid:=public.himmah_code_reviewer(_day,_token); IF rid IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF; SELECT full_name INTO actor_name FROM public.himmah_reviewers WHERE id=rid;
  ELSIF NOT public.is_staff(auth.uid()) OR public.get_staff_role(auth.uid()) NOT IN ('manager','teacher','assistant_teacher') THEN RAISE EXCEPTION 'غير مصرح بالتحضير'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(_participant_ids,'{}'))id LEFT JOIN public.himmah_participants p ON p.id=id AND p.day_id=_day WHERE p.id IS NULL OR (_token IS NULL AND NOT public.himmah_view_halaqa(p.halaqa_id))) THEN RAISE EXCEPTION 'أحد الطلاب خارج نطاقك'; END IF;
  UPDATE public.himmah_participants SET present=_present,attended_at=CASE WHEN _present THEN clock_timestamp() ELSE NULL END,attended_by_name=CASE WHEN _present THEN actor_name ELSE NULL END WHERE day_id=_day AND id=ANY(coalesce(_participant_ids,'{}'));
  GET DIAGNOSTICS changed=ROW_COUNT;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,coalesce(auth.uid(),rid),'attendance_bulk',jsonb_build_object('participant_ids',to_jsonb(_participant_ids),'present',_present,'attended_by_name',actor_name,'changed',changed));
  RETURN jsonb_build_object('changed',changed,'present',_present,'attended_at',clock_timestamp(),'attended_by_name',actor_name); END $$;
REVOKE ALL ON FUNCTION public.himmah_attendance_bulk(uuid,uuid[],boolean,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.himmah_attendance_bulk(uuid,uuid[],boolean,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.himmah_reopen_hizb(_day uuid,_participant uuid,_hizb integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.himmah_participants; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'إعادة التسميع للإدارة فقط'; END IF;
  SELECT * INTO p FROM public.himmah_participants WHERE id=_participant AND day_id=_day; IF p.id IS NULL OR NOT _hizb=ANY(p.hizbs) THEN RAISE EXCEPTION 'الحزب غير مقرر'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb AND approved_at IS NOT NULL) THEN RAISE EXCEPTION 'لا توجد نتيجة معتمدة لإعادة تسميعها'; END IF;
  IF EXISTS(SELECT 1 FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb AND status IN('running','ended')) THEN RAISE EXCEPTION 'الحزب مفتوح بالفعل للتسميع'; END IF;
  INSERT INTO public.himmah_reopenings(day_id,participant_id,hizb,reopened_by) VALUES(_day,p.id,_hizb,auth.uid()) ON CONFLICT(participant_id,hizb) DO UPDATE SET reopened_at=clock_timestamp(),reopened_by=auth.uid();
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,auth.uid(),'reopen_hizb',jsonb_build_object('participant_id',p.id,'hizb',_hizb));
  RETURN jsonb_build_object('participant_id',p.id,'hizb',_hizb,'reopened',true); END $$;
REVOKE ALL ON FUNCTION public.himmah_reopen_hizb(uuid,uuid,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.himmah_reopen_hizb(uuid,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.himmah_dashboard_internal(_day uuid,_token text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.himmah_days; ext boolean:=false; rid uuid; adm boolean; result jsonb; BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day; IF d.id IS NULL THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
  IF _token IS NOT NULL THEN rid:=public.himmah_code_reviewer(_day,_token); IF rid IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF; ext:=true; ELSIF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  adm:=public.himmah_admin() AND NOT ext;
  SELECT jsonb_build_object('day',(to_jsonb(d)-'invite_key'-'created_by'-'display_key')||CASE WHEN adm THEN jsonb_build_object('invite_key',d.invite_key,'display_key',d.display_key) ELSE '{}'::jsonb END,'can_manage',adm,'reviewer_id',rid,
    'participants',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.halaqa_name,p.student_name) FROM public.himmah_participants p WHERE p.day_id=_day AND (ext OR public.himmah_view_halaqa(p.halaqa_id))),'[]'::jsonb),
    'reviewers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'full_name',r.full_name,'active',r.active,'status',r.status,'staff',r.user_id IS NOT NULL,'code_issued_at',CASE WHEN adm THEN r.code_issued_at END,'phone',CASE WHEN adm THEN r.phone ELSE '' END) ORDER BY r.created_at) FROM public.himmah_reviewers r WHERE r.day_id=_day AND (NOT ext OR r.id=rid)),'[]'::jsonb),
    'assignments','[]'::jsonb,
    'reopenings',coalesce((SELECT jsonb_agg(jsonb_build_object('participant_id',x.participant_id,'hizb',x.hizb,'reopened_at',x.reopened_at)) FROM public.himmah_reopenings x JOIN public.himmah_participants p ON p.id=x.participant_id WHERE x.day_id=_day AND (ext OR public.himmah_view_halaqa(p.halaqa_id))),'[]'::jsonb),
    'attempts',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.started_at) FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND (ext OR public.himmah_view_halaqa(p.halaqa_id))),'[]'::jsonb),
    'audit',CASE WHEN adm THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.himmah_audit WHERE day_id=_day ORDER BY created_at DESC LIMIT 100)x),'[]'::jsonb) ELSE '[]'::jsonb END) INTO result; RETURN result; END $$;

CREATE OR REPLACE FUNCTION public.himmah_attempt_v2(_action text,_day uuid,_participant uuid DEFAULT NULL,_hizb integer DEFAULT NULL,_attempt uuid DEFAULT NULL,_request uuid DEFAULT NULL,_mistakes integer DEFAULT 0,_melodies integer DEFAULT 0,_warnings integer DEFAULT 0,_token text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.himmah_days; p public.himmah_participants; r public.himmah_reviewers; a public.himmah_attempts; n integer; cfg jsonb; sc numeric; el integer; BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day FOR SHARE; IF d.id IS NULL THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
  IF _token IS NOT NULL THEN SELECT * INTO r FROM public.himmah_reviewers WHERE id=public.himmah_code_reviewer(_day,_token); IF r.id IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF;
  ELSE
    IF NOT public.is_staff(auth.uid()) OR public.get_staff_role(auth.uid()) NOT IN('manager','teacher','assistant_teacher') THEN RAISE EXCEPTION 'غير مصرح بإدخال النتائج'; END IF;
    INSERT INTO public.himmah_reviewers(day_id,full_name,user_id,status) SELECT _day,full_name,id,'assigned' FROM public.profiles WHERE id=auth.uid() ON CONFLICT(day_id,user_id) DO NOTHING;
    SELECT * INTO r FROM public.himmah_reviewers WHERE day_id=_day AND user_id=auth.uid() AND active; IF r.id IS NULL THEN RAISE EXCEPTION 'جلسة موقوفة'; END IF;
  END IF;
  IF _action='start' THEN SELECT * INTO p FROM public.himmah_participants WHERE id=_participant AND day_id=_day FOR UPDATE;
  ELSE SELECT * INTO a FROM public.himmah_attempts WHERE id=_attempt FOR UPDATE; SELECT * INTO p FROM public.himmah_participants WHERE id=a.participant_id AND day_id=_day; IF a.reviewer_id IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'لا يمكنك تعديل محاولة مسمّع آخر'; END IF; END IF;
  IF p.id IS NULL OR (_token IS NULL AND NOT public.himmah_view_halaqa(p.halaqa_id)) OR (_token IS NOT NULL AND NOT public.himmah_in_scope(r.id,p.id)) THEN RAISE EXCEPTION 'الطالب خارج نطاقك'; END IF;
  IF _mistakes NOT BETWEEN 0 AND 10000 OR _melodies NOT BETWEEN 0 AND 10000 OR _warnings NOT BETWEEN 0 AND 10000 OR _mistakes IS NULL OR _melodies IS NULL OR _warnings IS NULL THEN RAISE EXCEPTION 'الأعداد يجب أن تكون صحيحة وغير سالبة'; END IF;
  IF a.id IS NOT NULL AND a.status='running' AND public.himmah_elapsed(a,d.time_limit_seconds,d.pause_limit_seconds)>=d.time_limit_seconds THEN UPDATE public.himmah_attempts SET duration_seconds=d.time_limit_seconds,ended_at=clock_timestamp(),paused_at=NULL,status='ended' WHERE id=a.id RETURNING * INTO a; END IF;
  IF _action='start' THEN
    IF _request IS NULL OR _hizb IS NULL OR NOT _hizb=ANY(p.hizbs) THEN RAISE EXCEPTION 'الحزب غير مقرر'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p.id::text||':'||_hizb,0));
    SELECT * INTO a FROM public.himmah_attempts WHERE request_id=_request; IF a.id IS NOT NULL THEN IF a.reviewer_id<>r.id OR a.participant_id<>p.id OR a.hizb<>_hizb THEN RAISE EXCEPTION 'طلب مكرر غير صحيح'; END IF; RETURN to_jsonb(a); END IF;
    SELECT * INTO a FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb AND status IN('running','ended');
    IF a.id IS NOT NULL THEN IF a.reviewer_id=r.id THEN RETURN to_jsonb(a); ELSE RAISE EXCEPTION 'هذا الحزب قيد التسميع لدى مسمّع آخر'; END IF; END IF;
    IF EXISTS(SELECT 1 FROM public.himmah_attempts x WHERE x.participant_id=p.id AND x.hizb=_hizb AND x.approved_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.himmah_reopenings x WHERE x.participant_id=p.id AND x.hizb=_hizb) THEN RAISE EXCEPTION 'هذا الحزب مسمّع ومعتمد؛ تتم إعادة فتحه من الإدارة عند الحاجة'; END IF;
    SELECT coalesce(max(attempt_no),0)+1 INTO n FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb;
    INSERT INTO public.himmah_attempts(participant_id,reviewer_id,hizb,attempt_no,request_id) VALUES(p.id,r.id,_hizb,n,_request) RETURNING * INTO a;
  ELSIF _action='pause' THEN
    IF a.status='running' AND a.paused_at IS NULL AND d.pause_limit_seconds>0 AND a.paused_seconds>=d.pause_limit_seconds THEN RAISE EXCEPTION 'استُنفد وقت التوقف المسموح لهذا الحزب'; END IF;
    IF a.status='running' AND a.paused_at IS NULL THEN UPDATE public.himmah_attempts SET paused_at=clock_timestamp(),mistakes=_mistakes,melodies=_melodies,warnings=_warnings WHERE id=a.id RETURNING * INTO a; END IF;
  ELSIF _action='resume' THEN IF a.status='running' AND a.paused_at IS NOT NULL THEN UPDATE public.himmah_attempts SET paused_seconds=paused_seconds+public.himmah_pause_credit(a,d.pause_limit_seconds),paused_at=NULL WHERE id=a.id RETURNING * INTO a; END IF;
  ELSIF _action IN('counts','end') THEN
    IF a.status NOT IN('running','ended') THEN RAISE EXCEPTION 'النتيجة معتمدة؛ ابدأ محاولة جديدة'; END IF;
    el:=public.himmah_elapsed(a,d.time_limit_seconds,d.pause_limit_seconds);
    UPDATE public.himmah_attempts SET mistakes=_mistakes,melodies=_melodies,warnings=_warnings,ended_at=CASE WHEN _action='end' THEN coalesce(ended_at,clock_timestamp()) ELSE ended_at END,duration_seconds=CASE WHEN _action='end' THEN coalesce(duration_seconds,el) ELSE duration_seconds END,paused_seconds=CASE WHEN _action='end' THEN paused_seconds+public.himmah_pause_credit(a,d.pause_limit_seconds) ELSE paused_seconds END,paused_at=CASE WHEN _action='end' THEN NULL ELSE paused_at END,status=CASE WHEN _action='end' THEN 'ended' ELSE status END WHERE id=a.id RETURNING * INTO a;
  ELSIF _action='approve' THEN
    IF a.status IN('pass','fail') THEN RETURN to_jsonb(a); END IF; IF a.status<>'ended' THEN RAISE EXCEPTION 'أنهِ الحزب قبل الاعتماد'; END IF;
    cfg:=jsonb_build_object('total_score',d.total_score,'mistake_deduction',d.mistake_deduction,'melody_deduction',d.melody_deduction,'warning_deduction',d.warning_deduction,'pass_score',d.pass_score,'time_limit_seconds',d.time_limit_seconds,'reviewer_name',r.full_name);
    sc:=public.himmah_score_v2(a.mistakes,a.melodies,a.warnings,cfg);
    UPDATE public.himmah_attempts SET scoring=cfg,score=sc,status=CASE WHEN sc>=d.pass_score THEN 'pass' ELSE 'fail' END,approved_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
    DELETE FROM public.himmah_reopenings WHERE participant_id=p.id AND hizb=a.hizb;
    UPDATE public.himmah_participants SET present=true,attended_at=coalesce(attended_at,clock_timestamp()),attended_by_name=coalesce(attended_by_name,r.full_name) WHERE id=p.id;
    INSERT INTO public.himmah_audit(day_id,attempt_id,actor_id,action,new_value) VALUES(_day,a.id,r.id,'approve',to_jsonb(a));
  ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF; RETURN to_jsonb(a); END $$;

CREATE OR REPLACE FUNCTION public.himmah_public_display(_day uuid,_key uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.himmah_days; students jsonb; circles jsonb; overall jsonb; BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day AND display_key=_key; IF d.id IS NULL THEN RAISE EXCEPTION 'رابط العرض غير صحيح'; END IF;
  WITH latest AS(SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status,a.score FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND a.approved_at IS NOT NULL ORDER BY a.participant_id,a.hizb,a.approved_at DESC),
  per AS(SELECT p.student_name,p.halaqa_name,cardinality(p.hizbs) AS total,count(l.attempt_id) AS presented,count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed,coalesce(round(avg(l.score),1),0) AS average_score FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id WHERE p.day_id=_day GROUP BY p.id,p.student_name,p.halaqa_name,p.hizbs)
  SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') INTO students FROM(SELECT student_name,halaqa_name,total,presented,passed,average_score,round(CASE WHEN total>0 THEN passed::numeric/total*100 ELSE 0 END,1) AS completion FROM per ORDER BY CASE WHEN d.ranking_mode='completion' THEN CASE WHEN total>0 THEN passed::numeric/total ELSE 0 END END DESC NULLS LAST,passed DESC,average_score DESC,student_name LIMIT 5)s;
  WITH latest AS(SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND a.approved_at IS NOT NULL ORDER BY a.participant_id,a.hizb,a.approved_at DESC),
  per AS(SELECT p.halaqa_name,count(p.id) AS registered,count(p.id) FILTER(WHERE p.present) AS present,coalesce(sum(cardinality(p.hizbs)),0) AS total,count(l.attempt_id) AS presented,count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id WHERE p.day_id=_day GROUP BY p.halaqa_id,p.halaqa_name)
  SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO circles FROM(SELECT halaqa_name,registered,present,total,presented,passed,round(CASE WHEN total>0 THEN passed::numeric/total*100 ELSE 0 END,1) AS completion FROM per ORDER BY CASE WHEN total>0 THEN passed::numeric/total ELSE 0 END DESC,passed DESC,halaqa_name LIMIT 5)c;
  WITH latest AS(SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND a.approved_at IS NOT NULL ORDER BY a.participant_id,a.hizb,a.approved_at DESC)
  SELECT jsonb_build_object('registered',count(p.id),'present',count(p.id) FILTER(WHERE p.present),'total',coalesce(sum(cardinality(p.hizbs)),0),'presented',count(l.attempt_id),'passed',count(l.attempt_id) FILTER(WHERE l.status='pass')) INTO overall FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id WHERE p.day_id=_day;
  RETURN jsonb_build_object('day',jsonb_build_object('id',d.id,'title',d.title,'day_date',d.day_date,'logo_url',d.logo_url,'ranking_mode',d.ranking_mode),'stats',overall,'best_student',students->0,'best_halaqa',circles->0,'top_students',students,'top_halaqat',circles,'server_now',clock_timestamp()); END $$;
