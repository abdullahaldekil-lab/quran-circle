-- Himmah: optional cap on paused time per attempt. 0 keeps the previous behaviour (unlimited pause).
ALTER TABLE public.himmah_days ADD COLUMN IF NOT EXISTS pause_limit_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.himmah_days DROP CONSTRAINT IF EXISTS himmah_days_pause_limit_chk;
ALTER TABLE public.himmah_days ADD CONSTRAINT himmah_days_pause_limit_chk CHECK (pause_limit_seconds BETWEEN 0 AND 3600);

-- Seconds of the current pause that are excluded from the recitation clock; beyond the cap the clock runs again.
CREATE OR REPLACE FUNCTION public.himmah_pause_credit(_a public.himmah_attempts, _pause_limit integer) RETURNS integer LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT CASE WHEN _a.paused_at IS NULL THEN 0 WHEN _pause_limit>0 THEN least(x, greatest(0,_pause_limit-_a.paused_seconds)) ELSE x END
  FROM (SELECT greatest(0,floor(extract(epoch FROM clock_timestamp()-_a.paused_at))::integer) AS x) s $$;
CREATE OR REPLACE FUNCTION public.himmah_elapsed(_a public.himmah_attempts, _limit integer, _pause_limit integer) RETURNS integer LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT least(_limit, greatest(0, floor(extract(epoch FROM clock_timestamp()-_a.started_at))::integer - _a.paused_seconds - public.himmah_pause_credit(_a,_pause_limit))) $$;

CREATE OR REPLACE FUNCTION public.himmah_attempt(_action text, _day uuid, _participant uuid DEFAULT NULL::uuid, _hizb integer DEFAULT NULL::integer, _attempt uuid DEFAULT NULL::uuid, _request uuid DEFAULT NULL::uuid, _mistakes integer DEFAULT 0, _warnings integer DEFAULT 0, _token text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE d public.himmah_days; p public.himmah_participants; r public.himmah_reviewers; a public.himmah_attempts; n integer; cfg jsonb; sc numeric; el integer; BEGIN SELECT * INTO d FROM public.himmah_days WHERE id=_day FOR SHARE; IF d.id IS NULL THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
IF _token IS NOT NULL THEN SELECT * INTO r FROM public.himmah_reviewers WHERE id=public.himmah_code_reviewer(_day,_token); IF r.id IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF;
ELSE IF NOT public.is_staff(auth.uid()) OR public.get_staff_role(auth.uid()) NOT IN ('manager','teacher','assistant_teacher') THEN RAISE EXCEPTION 'غير مصرح بإدخال النتائج'; END IF; INSERT INTO public.himmah_reviewers(day_id,full_name,user_id,status) SELECT _day,full_name,id,'assigned' FROM public.profiles WHERE id=auth.uid() ON CONFLICT(day_id,user_id) DO NOTHING; SELECT * INTO r FROM public.himmah_reviewers WHERE day_id=_day AND user_id=auth.uid() AND active; IF r.id IS NULL THEN RAISE EXCEPTION 'جلسة موقوفة'; END IF; END IF;
IF _action='start' THEN SELECT * INTO p FROM public.himmah_participants WHERE id=_participant AND day_id=_day FOR UPDATE; ELSE SELECT * INTO a FROM public.himmah_attempts WHERE id=_attempt FOR UPDATE; SELECT * INTO p FROM public.himmah_participants WHERE id=a.participant_id AND day_id=_day; IF a.reviewer_id IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'لا يمكنك تعديل محاولة مسمّع آخر'; END IF; END IF;
IF p.id IS NULL OR (_token IS NULL AND NOT public.himmah_view_halaqa(p.halaqa_id)) OR (_token IS NOT NULL AND NOT public.himmah_in_scope(r.id,p.id)) THEN RAISE EXCEPTION 'الطالب خارج نطاقك'; END IF;
IF _mistakes NOT BETWEEN 0 AND 10000 OR _warnings NOT BETWEEN 0 AND 10000 OR _mistakes IS NULL OR _warnings IS NULL THEN RAISE EXCEPTION 'الأعداد يجب أن تكون صحيحة وغير سالبة'; END IF;
-- Hard time limit: a running attempt that reached the limit is stopped before any further action.
IF a.id IS NOT NULL AND a.status='running' AND public.himmah_elapsed(a,d.time_limit_seconds,d.pause_limit_seconds)>=d.time_limit_seconds THEN UPDATE public.himmah_attempts SET duration_seconds=d.time_limit_seconds, ended_at=clock_timestamp(), paused_at=NULL, status='ended' WHERE id=a.id RETURNING * INTO a; END IF;
IF _action='start' THEN IF _request IS NULL OR _hizb IS NULL OR NOT _hizb=ANY(p.hizbs) THEN RAISE EXCEPTION 'الحزب غير مقرر'; END IF; SELECT * INTO a FROM public.himmah_attempts WHERE request_id=_request; IF a.id IS NOT NULL THEN IF a.reviewer_id<>r.id OR a.participant_id<>p.id OR a.hizb<>_hizb THEN RAISE EXCEPTION 'طلب مكرر غير صحيح'; END IF; RETURN to_jsonb(a); END IF; SELECT * INTO a FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb AND reviewer_id=r.id AND status IN ('running','ended'); IF a.id IS NOT NULL THEN RETURN to_jsonb(a); END IF; SELECT coalesce(max(attempt_no),0)+1 INTO n FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb; INSERT INTO public.himmah_attempts(participant_id,reviewer_id,hizb,attempt_no,request_id) VALUES(p.id,r.id,_hizb,n,_request) RETURNING * INTO a;
ELSIF _action='pause' THEN IF a.status='running' AND a.paused_at IS NULL AND d.pause_limit_seconds>0 AND a.paused_seconds>=d.pause_limit_seconds THEN RAISE EXCEPTION 'استُنفد وقت التوقف المسموح لهذا الحزب'; END IF; IF a.status='running' AND a.paused_at IS NULL THEN UPDATE public.himmah_attempts SET paused_at=clock_timestamp(),mistakes=_mistakes,warnings=_warnings WHERE id=a.id RETURNING * INTO a; END IF;
ELSIF _action='resume' THEN IF a.status='running' AND a.paused_at IS NOT NULL THEN UPDATE public.himmah_attempts SET paused_seconds=paused_seconds+public.himmah_pause_credit(a,d.pause_limit_seconds), paused_at=NULL WHERE id=a.id RETURNING * INTO a; END IF;
ELSIF _action IN ('counts','end') THEN IF a.status NOT IN ('running','ended') THEN RAISE EXCEPTION 'النتيجة معتمدة؛ ابدأ محاولة جديدة'; END IF;
  el := public.himmah_elapsed(a,d.time_limit_seconds,d.pause_limit_seconds);
  UPDATE public.himmah_attempts SET mistakes=_mistakes,warnings=_warnings,
    ended_at=CASE WHEN _action='end' THEN coalesce(ended_at,clock_timestamp()) ELSE ended_at END,
    duration_seconds=CASE WHEN _action='end' THEN coalesce(duration_seconds,el) ELSE duration_seconds END,
    paused_seconds=CASE WHEN _action='end' THEN paused_seconds+public.himmah_pause_credit(a,d.pause_limit_seconds) ELSE paused_seconds END,
    paused_at=CASE WHEN _action='end' THEN NULL ELSE paused_at END,
    status=CASE WHEN _action='end' THEN 'ended' ELSE status END WHERE id=a.id RETURNING * INTO a;
ELSIF _action='approve' THEN IF a.status IN ('pass','fail') THEN RETURN to_jsonb(a); END IF; IF a.status<>'ended' THEN RAISE EXCEPTION 'أنهِ الحزب قبل الاعتماد'; END IF;
  cfg := jsonb_build_object('total_score',d.total_score,'mistake_deduction',d.mistake_deduction,'warning_deduction',d.warning_deduction,'pass_score',d.pass_score,'time_limit_seconds',d.time_limit_seconds,'reviewer_name',r.full_name);
  sc := public.himmah_score(a.mistakes,a.warnings,cfg);
  UPDATE public.himmah_attempts SET scoring=cfg,score=sc,status=CASE WHEN sc>=d.pass_score THEN 'pass' ELSE 'fail' END,approved_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
  UPDATE public.himmah_participants SET present=true WHERE id=p.id; INSERT INTO public.himmah_audit(day_id,attempt_id,actor_id,action,new_value) VALUES(_day,a.id,r.id,'approve',to_jsonb(a)); ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF; RETURN to_jsonb(a); END $function$;

DROP FUNCTION IF EXISTS public.himmah_elapsed(public.himmah_attempts, integer);

CREATE OR REPLACE FUNCTION public.himmah_manage(_action text, _day uuid DEFAULT NULL::uuid, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE sid uuid; newh uuid[]; blocked text; did uuid:=_day; s public.students; h public.halaqat; hs integer[]; g jsonb; ts numeric; md numeric; wd numeric; ps numeric; tl integer; pl integer; BEGIN IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'الإعداد للإدارة فقط'; END IF;
IF _action='create' THEN IF length(trim(_data->>'title')) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'اسم اليوم مطلوب'; END IF; INSERT INTO public.narration_sessions(title,session_date,created_by) VALUES(_data->>'title',(_data->>'day_date')::date,auth.uid()) RETURNING id INTO sid; INSERT INTO public.himmah_days(session_id,title,day_date,created_by) VALUES(sid,_data->>'title',(_data->>'day_date')::date,auth.uid()) RETURNING id INTO did;
ELSIF _action='halaqat' THEN
  newh := coalesce((SELECT array_agg(DISTINCT x::uuid) FROM jsonb_array_elements_text(_data->'halaqa_ids') x WHERE EXISTS(SELECT 1 FROM public.halaqat WHERE id=x::uuid)),'{}');
  PERFORM 1 FROM public.himmah_days WHERE id=did FOR UPDATE;
  SELECT string_agg(DISTINCT p.halaqa_name||' ('||p.student_name||')', '، ') INTO blocked FROM public.himmah_participants p WHERE p.day_id=did AND NOT p.halaqa_id=ANY(newh) AND EXISTS(SELECT 1 FROM public.himmah_attempts a WHERE a.participant_id=p.id);
  IF blocked IS NOT NULL THEN RAISE EXCEPTION 'لا يمكن إزالة الحلقة لأن لطلابها محاولات محفوظة: %', blocked; END IF;
  DELETE FROM public.himmah_assignments WHERE day_id=did AND (NOT halaqa_id=ANY(newh) OR participant_id IN (SELECT id FROM public.himmah_participants WHERE day_id=did AND NOT halaqa_id=ANY(newh)));
  DELETE FROM public.himmah_participants WHERE day_id=did AND NOT halaqa_id=ANY(newh);
  UPDATE public.himmah_reviewers r SET status='pending',code_hash=NULL,code_issued_at=NULL WHERE r.day_id=did AND r.status='assigned' AND r.user_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.himmah_assignments a WHERE a.reviewer_id=r.id);
  UPDATE public.himmah_days SET halaqa_ids=newh WHERE id=did;
ELSIF _action='participant' THEN SELECT * INTO s FROM public.students WHERE id=(_data->>'student_id')::uuid; SELECT * INTO h FROM public.halaqat WHERE id=s.halaqa_id; SELECT array_agg(DISTINCT x ORDER BY x) INTO hs FROM jsonb_array_elements_text(_data->'hizbs') v, LATERAL (SELECT v.value::integer x) n; IF s.id IS NULL OR h.id IS NULL OR cardinality(hs)<1 OR cardinality(hs)>60 OR EXISTS(SELECT 1 FROM unnest(hs) x WHERE x<1 OR x>60) THEN RAISE EXCEPTION 'اختر الطالب والأحزاب من 1 إلى 60'; END IF; IF EXISTS(SELECT 1 FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=did AND p.student_id=s.id AND NOT a.hizb=ANY(hs)) THEN RAISE EXCEPTION 'لا يمكن إزالة حزب له محاولات مسجلة'; END IF; INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(did,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs; UPDATE public.himmah_days SET halaqa_ids=array_append(halaqa_ids,h.id) WHERE id=did AND NOT h.id=ANY(halaqa_ids);
ELSIF _action='remove_participant' THEN IF EXISTS(SELECT 1 FROM public.himmah_attempts WHERE participant_id=(_data->>'participant_id')::uuid) THEN RAISE EXCEPTION 'لا يمكن حذف طالب له محاولات'; END IF; DELETE FROM public.himmah_assignments WHERE day_id=did AND participant_id=(_data->>'participant_id')::uuid; DELETE FROM public.himmah_participants WHERE id=(_data->>'participant_id')::uuid AND day_id=did; UPDATE public.himmah_reviewers r SET status='pending',code_hash=NULL,code_issued_at=NULL WHERE r.day_id=did AND r.status='assigned' AND r.user_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.himmah_assignments a WHERE a.reviewer_id=r.id);
ELSIF _action='attendance' THEN UPDATE public.himmah_participants SET present=(_data->>'present')::boolean WHERE id=(_data->>'participant_id')::uuid AND day_id=did;
ELSIF _action='revoke' THEN UPDATE public.himmah_reviewers SET active=false,status='revoked',code_hash=NULL WHERE id=(_data->>'reviewer_id')::uuid AND day_id=did;
ELSIF _action='settings' THEN
  IF greatest(length(coalesce(_data->>'logo_url','')),length(coalesce(_data->>'association_logo_url','')),length(coalesce(_data->>'stamp_url','')))>700000 THEN RAISE EXCEPTION 'حجم الصورة كبير؛ اختر صورة أصغر'; END IF;
  g := _data->'grade_bounds';
  IF g IS NOT NULL AND NOT coalesce((g->>'excellent')::numeric <= 100 AND (g->>'excellent')::numeric > (g->>'very_good')::numeric AND (g->>'very_good')::numeric > (g->>'good')::numeric AND (g->>'good')::numeric > (g->>'acceptable')::numeric AND (g->>'acceptable')::numeric >= 0, false) THEN RAISE EXCEPTION 'حدود التقديرات يجب أن تكون تنازلية بين 0 و100'; END IF;
  SELECT coalesce((_data->>'total_score')::numeric,total_score),coalesce((_data->>'mistake_deduction')::numeric,mistake_deduction),coalesce((_data->>'warning_deduction')::numeric,warning_deduction),coalesce((_data->>'pass_score')::numeric,pass_score),coalesce((_data->>'time_limit_seconds')::integer,time_limit_seconds),coalesce((_data->>'pause_limit_seconds')::integer,pause_limit_seconds) INTO ts,md,wd,ps,tl,pl FROM public.himmah_days WHERE id=did;
  IF ts<=0 OR md<0 OR wd<0 OR ps<0 OR ps>ts THEN RAISE EXCEPTION 'إعدادات الاحتساب غير صحيحة: حد النجاح بين صفر والدرجة الكلية والخصومات غير سالبة'; END IF;
  IF tl NOT BETWEEN 1 AND 540 THEN RAISE EXCEPTION 'مدة الحزب لا تتجاوز 540 ثانية'; END IF;
  IF pl NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'حد التوقف المؤقت بين 0 و3600 ثانية (0 = بلا حد)'; END IF;
  UPDATE public.himmah_days SET total_score=ts,mistake_deduction=md,warning_deduction=wd,pass_score=ps,time_limit_seconds=tl,pause_limit_seconds=pl,ranking_mode=_data->>'ranking_mode',registration_open=(_data->>'registration_open')::boolean,expires_at=(_data->>'expires_at')::timestamptz,manager_name=left(coalesce(_data->>'manager_name',''),120),logo_url=coalesce(_data->>'logo_url',logo_url),association_logo_url=coalesce(_data->>'association_logo_url',association_logo_url),stamp_url=coalesce(_data->>'stamp_url',stamp_url),grade_bounds=CASE WHEN g IS NULL THEN grade_bounds ELSE jsonb_build_object('excellent',(g->>'excellent')::numeric,'very_good',(g->>'very_good')::numeric,'good',(g->>'good')::numeric,'acceptable',(g->>'acceptable')::numeric) END WHERE id=did;
ELSIF _action='correct' THEN RAISE EXCEPTION 'استخدم محاولة جديدة؛ النتائج المعتمدة محفوظة دون استبدال'; ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF;
INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(did,auth.uid(),_action,_data-'logo_url'-'association_logo_url'-'stamp_url'); RETURN did; END $function$;
