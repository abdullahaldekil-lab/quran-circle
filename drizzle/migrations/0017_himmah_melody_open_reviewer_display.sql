-- يوم الهمة: اللحن، اختيار المسمّع للحلقة، التحضير، نص الشهادة، وشاشة العرض المستقلة.
ALTER TABLE public.himmah_days ADD COLUMN IF NOT EXISTS melody_deduction numeric NOT NULL DEFAULT 2;
ALTER TABLE public.himmah_days ADD COLUMN IF NOT EXISTS certificate_title text NOT NULL DEFAULT 'شهادة إنجاز وتفوق';
ALTER TABLE public.himmah_days ADD COLUMN IF NOT EXISTS certificate_note text NOT NULL DEFAULT 'تقديرًا لاجتهاده في تسميع الأحزاب المقررة في يوم السرد – يوم الهمة';
ALTER TABLE public.himmah_days ADD COLUMN IF NOT EXISTS display_key uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.himmah_attempts ADD COLUMN IF NOT EXISTS melodies integer NOT NULL DEFAULT 0;
ALTER TABLE public.himmah_days DROP CONSTRAINT IF EXISTS himmah_days_melody_deduction_chk;
ALTER TABLE public.himmah_days ADD CONSTRAINT himmah_days_melody_deduction_chk CHECK (melody_deduction >= 0);
ALTER TABLE public.himmah_attempts DROP CONSTRAINT IF EXISTS himmah_attempts_melodies_chk;
ALTER TABLE public.himmah_attempts ADD CONSTRAINT himmah_attempts_melodies_chk CHECK (melodies BETWEEN 0 AND 10000) NOT VALID;
COMMENT ON TABLE public.himmah_assignments IS 'DEPRECATED: retained for historical records; reviewers now choose a circle and student within their authorised day.';

CREATE OR REPLACE FUNCTION public.himmah_score_v2(_m integer, _l integer, _w integer, _cfg jsonb) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT greatest(0,least((_cfg->>'total_score')::numeric,(_cfg->>'total_score')::numeric-_m*(_cfg->>'mistake_deduction')::numeric-_l*(_cfg->>'melody_deduction')::numeric-_w*(_cfg->>'warning_deduction')::numeric)) $$;
REVOKE ALL ON FUNCTION public.himmah_score_v2(integer,integer,integer,jsonb) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.himmah_score_v2(integer,integer,integer,jsonb) TO anon,authenticated;

-- التكليف التفصيلي لم يعد مطلوبًا: الكود يصرح باليوم، ثم يختار المسمّع الحلقة والطالب.
CREATE OR REPLACE FUNCTION public.himmah_in_scope(_reviewer uuid,_participant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.himmah_reviewers r JOIN public.himmah_participants p ON p.day_id=r.day_id WHERE r.id=_reviewer AND p.id=_participant) $$;
CREATE OR REPLACE FUNCTION public.himmah_issue_code(_reviewer uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.himmah_reviewers; c text:=''; b bytea; i int; alphabet text:='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'للإدارة فقط'; END IF;
  SELECT * INTO r FROM public.himmah_reviewers WHERE id=_reviewer FOR UPDATE;
  IF r.id IS NULL OR r.user_id IS NOT NULL OR NOT r.active OR r.status='revoked' THEN RAISE EXCEPTION 'المسمّع غير متاح'; END IF;
  b:=extensions.gen_random_bytes(8); FOR i IN 0..7 LOOP c:=c||substr(alphabet,(get_byte(b,i)%length(alphabet))+1,1); END LOOP;
  UPDATE public.himmah_reviewers SET code_hash=encode(extensions.digest(c,'sha256'),'hex'),code_issued_at=now(),status='assigned' WHERE id=r.id;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(r.day_id,auth.uid(),'issue_code',jsonb_build_object('reviewer_id',r.id));
  RETURN c; END $$;

CREATE OR REPLACE FUNCTION public.himmah_dashboard_internal(_day uuid,_token text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.himmah_days; ext boolean:=false; rid uuid; adm boolean; result jsonb; BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day; IF d.id IS NULL THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
  IF _token IS NOT NULL THEN rid:=public.himmah_code_reviewer(_day,_token); IF rid IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF; ext:=true;
  ELSIF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  adm:=public.himmah_admin() AND NOT ext;
  SELECT jsonb_build_object(
    'day',(to_jsonb(d)-'invite_key'-'created_by'-'display_key')||CASE WHEN adm THEN jsonb_build_object('invite_key',d.invite_key,'display_key',d.display_key) ELSE '{}'::jsonb END,
    'can_manage',adm,'reviewer_id',rid,
    'participants',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.halaqa_name,p.student_name) FROM public.himmah_participants p WHERE p.day_id=_day AND (ext OR public.himmah_view_halaqa(p.halaqa_id))),'[]'::jsonb),
    'reviewers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'full_name',r.full_name,'active',r.active,'status',r.status,'staff',r.user_id IS NOT NULL,'code_issued_at',CASE WHEN adm THEN r.code_issued_at END,'phone',CASE WHEN adm THEN r.phone ELSE '' END) ORDER BY r.created_at) FROM public.himmah_reviewers r WHERE r.day_id=_day AND (NOT ext OR r.id=rid)),'[]'::jsonb),
    'assignments',CASE WHEN adm THEN coalesce((SELECT jsonb_agg(jsonb_build_object('reviewer_id',s.reviewer_id,'halaqa_id',s.halaqa_id,'participant_id',s.participant_id)) FROM public.himmah_assignments s WHERE s.day_id=_day),'[]'::jsonb) ELSE '[]'::jsonb END,
    'attempts',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.started_at) FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND (ext OR public.himmah_view_halaqa(p.halaqa_id))),'[]'::jsonb),
    'audit',CASE WHEN adm THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.himmah_audit WHERE day_id=_day ORDER BY created_at DESC LIMIT 100)x),'[]'::jsonb) ELSE '[]'::jsonb END) INTO result;
  RETURN result; END $$;

CREATE OR REPLACE FUNCTION public.himmah_attendance(_day uuid,_participant uuid,_present boolean,_token text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.himmah_participants; rid uuid; BEGIN
  SELECT * INTO p FROM public.himmah_participants WHERE id=_participant AND day_id=_day FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'الطالب غير موجود في هذا اليوم'; END IF;
  IF _token IS NOT NULL THEN rid:=public.himmah_code_reviewer(_day,_token); IF rid IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF;
  ELSIF NOT public.is_staff(auth.uid()) OR public.get_staff_role(auth.uid()) NOT IN ('manager','teacher','assistant_teacher') THEN RAISE EXCEPTION 'غير مصرح بالتحضير'; END IF;
  IF _token IS NULL AND NOT public.himmah_view_halaqa(p.halaqa_id) THEN RAISE EXCEPTION 'الطالب خارج نطاقك'; END IF;
  UPDATE public.himmah_participants SET present=_present WHERE id=p.id RETURNING * INTO p;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,coalesce(auth.uid(),rid),'attendance',jsonb_build_object('participant_id',p.id,'present',_present));
  RETURN to_jsonb(p); END $$;
REVOKE ALL ON FUNCTION public.himmah_attendance(uuid,uuid,boolean,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.himmah_attendance(uuid,uuid,boolean,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.himmah_attempt_v2(_action text,_day uuid,_participant uuid DEFAULT NULL,_hizb integer DEFAULT NULL,_attempt uuid DEFAULT NULL,_request uuid DEFAULT NULL,_mistakes integer DEFAULT 0,_melodies integer DEFAULT 0,_warnings integer DEFAULT 0,_token text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.himmah_days; p public.himmah_participants; r public.himmah_reviewers; a public.himmah_attempts; n integer; cfg jsonb; sc numeric; el integer; BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day FOR SHARE; IF d.id IS NULL THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
  IF _token IS NOT NULL THEN SELECT * INTO r FROM public.himmah_reviewers WHERE id=public.himmah_code_reviewer(_day,_token); IF r.id IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF;
  ELSE
    IF NOT public.is_staff(auth.uid()) OR public.get_staff_role(auth.uid()) NOT IN ('manager','teacher','assistant_teacher') THEN RAISE EXCEPTION 'غير مصرح بإدخال النتائج'; END IF;
    INSERT INTO public.himmah_reviewers(day_id,full_name,user_id,status) SELECT _day,full_name,id,'assigned' FROM public.profiles WHERE id=auth.uid() ON CONFLICT(day_id,user_id) DO NOTHING;
    SELECT * INTO r FROM public.himmah_reviewers WHERE day_id=_day AND user_id=auth.uid() AND active; IF r.id IS NULL THEN RAISE EXCEPTION 'جلسة موقوفة'; END IF;
  END IF;
  IF _action='start' THEN SELECT * INTO p FROM public.himmah_participants WHERE id=_participant AND day_id=_day FOR UPDATE;
  ELSE SELECT * INTO a FROM public.himmah_attempts WHERE id=_attempt FOR UPDATE; SELECT * INTO p FROM public.himmah_participants WHERE id=a.participant_id AND day_id=_day; IF a.reviewer_id IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'لا يمكنك تعديل محاولة مسمّع آخر'; END IF; END IF;
  IF p.id IS NULL OR (_token IS NULL AND NOT public.himmah_view_halaqa(p.halaqa_id)) OR (_token IS NOT NULL AND NOT public.himmah_in_scope(r.id,p.id)) THEN RAISE EXCEPTION 'الطالب خارج نطاقك'; END IF;
  IF _mistakes NOT BETWEEN 0 AND 10000 OR _melodies NOT BETWEEN 0 AND 10000 OR _warnings NOT BETWEEN 0 AND 10000 OR _mistakes IS NULL OR _melodies IS NULL OR _warnings IS NULL THEN RAISE EXCEPTION 'الأعداد يجب أن تكون صحيحة وغير سالبة'; END IF;
  IF a.id IS NOT NULL AND a.status='running' AND public.himmah_elapsed(a,d.time_limit_seconds,d.pause_limit_seconds)>=d.time_limit_seconds THEN
    UPDATE public.himmah_attempts SET duration_seconds=d.time_limit_seconds,ended_at=clock_timestamp(),paused_at=NULL,status='ended' WHERE id=a.id RETURNING * INTO a;
  END IF;
  IF _action='start' THEN
    IF _request IS NULL OR _hizb IS NULL OR NOT _hizb=ANY(p.hizbs) THEN RAISE EXCEPTION 'الحزب غير مقرر'; END IF;
    IF EXISTS(SELECT 1 FROM public.himmah_attempts x WHERE x.participant_id=p.id AND x.hizb=_hizb AND x.approved_at IS NOT NULL) THEN RAISE EXCEPTION 'هذا الحزب مسمّع ومعتمد'; END IF;
    SELECT * INTO a FROM public.himmah_attempts WHERE request_id=_request; IF a.id IS NOT NULL THEN IF a.reviewer_id<>r.id OR a.participant_id<>p.id OR a.hizb<>_hizb THEN RAISE EXCEPTION 'طلب مكرر غير صحيح'; END IF; RETURN to_jsonb(a); END IF;
    SELECT * INTO a FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb AND reviewer_id=r.id AND status IN ('running','ended'); IF a.id IS NOT NULL THEN RETURN to_jsonb(a); END IF;
    SELECT coalesce(max(attempt_no),0)+1 INTO n FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb;
    INSERT INTO public.himmah_attempts(participant_id,reviewer_id,hizb,attempt_no,request_id) VALUES(p.id,r.id,_hizb,n,_request) RETURNING * INTO a;
  ELSIF _action='pause' THEN
    IF a.status='running' AND a.paused_at IS NULL AND d.pause_limit_seconds>0 AND a.paused_seconds>=d.pause_limit_seconds THEN RAISE EXCEPTION 'استُنفد وقت التوقف المسموح لهذا الحزب'; END IF;
    IF a.status='running' AND a.paused_at IS NULL THEN UPDATE public.himmah_attempts SET paused_at=clock_timestamp(),mistakes=_mistakes,melodies=_melodies,warnings=_warnings WHERE id=a.id RETURNING * INTO a; END IF;
  ELSIF _action='resume' THEN
    IF a.status='running' AND a.paused_at IS NOT NULL THEN UPDATE public.himmah_attempts SET paused_seconds=paused_seconds+public.himmah_pause_credit(a,d.pause_limit_seconds),paused_at=NULL WHERE id=a.id RETURNING * INTO a; END IF;
  ELSIF _action IN ('counts','end') THEN
    IF a.status NOT IN ('running','ended') THEN RAISE EXCEPTION 'النتيجة معتمدة؛ ابدأ محاولة جديدة'; END IF;
    el:=public.himmah_elapsed(a,d.time_limit_seconds,d.pause_limit_seconds);
    UPDATE public.himmah_attempts SET mistakes=_mistakes,melodies=_melodies,warnings=_warnings,
      ended_at=CASE WHEN _action='end' THEN coalesce(ended_at,clock_timestamp()) ELSE ended_at END,
      duration_seconds=CASE WHEN _action='end' THEN coalesce(duration_seconds,el) ELSE duration_seconds END,
      paused_seconds=CASE WHEN _action='end' THEN paused_seconds+public.himmah_pause_credit(a,d.pause_limit_seconds) ELSE paused_seconds END,
      paused_at=CASE WHEN _action='end' THEN NULL ELSE paused_at END,status=CASE WHEN _action='end' THEN 'ended' ELSE status END WHERE id=a.id RETURNING * INTO a;
  ELSIF _action='approve' THEN
    IF a.status IN ('pass','fail') THEN RETURN to_jsonb(a); END IF; IF a.status<>'ended' THEN RAISE EXCEPTION 'أنهِ الحزب قبل الاعتماد'; END IF;
    cfg:=jsonb_build_object('total_score',d.total_score,'mistake_deduction',d.mistake_deduction,'melody_deduction',d.melody_deduction,'warning_deduction',d.warning_deduction,'pass_score',d.pass_score,'time_limit_seconds',d.time_limit_seconds,'reviewer_name',r.full_name);
    sc:=public.himmah_score_v2(a.mistakes,a.melodies,a.warnings,cfg);
    UPDATE public.himmah_attempts SET scoring=cfg,score=sc,status=CASE WHEN sc>=d.pass_score THEN 'pass' ELSE 'fail' END,approved_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
    UPDATE public.himmah_participants SET present=true WHERE id=p.id;
    INSERT INTO public.himmah_audit(day_id,attempt_id,actor_id,action,new_value) VALUES(_day,a.id,r.id,'approve',to_jsonb(a));
  ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF;
  RETURN to_jsonb(a); END $$;
REVOKE ALL ON FUNCTION public.himmah_attempt_v2(text,uuid,uuid,integer,uuid,uuid,integer,integer,integer,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.himmah_attempt_v2(text,uuid,uuid,integer,uuid,uuid,integer,integer,integer,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.himmah_correct_v2(_attempt uuid,_mistakes integer,_melodies integer,_warnings integer,_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.himmah_attempts; p public.himmah_participants; b public.himmah_attempts; d public.himmah_days; n integer; cfg jsonb; sc numeric; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'التصحيح للإدارة فقط'; END IF;
  IF _mistakes NOT BETWEEN 0 AND 10000 OR _melodies NOT BETWEEN 0 AND 10000 OR _warnings NOT BETWEEN 0 AND 10000 OR _mistakes IS NULL OR _melodies IS NULL OR _warnings IS NULL OR length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'أدخل أعدادًا صحيحة وسبب التصحيح'; END IF;
  SELECT * INTO a FROM public.himmah_attempts WHERE id=_attempt AND approved_at IS NOT NULL;
  SELECT * INTO p FROM public.himmah_participants WHERE id=a.participant_id FOR UPDATE; IF p.id IS NULL THEN RAISE EXCEPTION 'النتيجة غير موجودة'; END IF;
  IF EXISTS(SELECT 1 FROM public.himmah_attempts x WHERE x.participant_id=a.participant_id AND x.hizb=a.hizb AND x.approved_at>a.approved_at) THEN RAISE EXCEPTION 'صحّح أحدث نتيجة معتمدة لهذا الحزب'; END IF;
  SELECT * INTO d FROM public.himmah_days WHERE id=p.day_id;
  cfg:=coalesce(a.scoring,jsonb_build_object('total_score',d.total_score,'mistake_deduction',d.mistake_deduction,'melody_deduction',d.melody_deduction,'warning_deduction',d.warning_deduction,'pass_score',d.pass_score,'time_limit_seconds',d.time_limit_seconds,'reviewer_name',(SELECT full_name FROM public.himmah_reviewers WHERE id=a.reviewer_id)))||jsonb_build_object('melody_deduction',coalesce((a.scoring->>'melody_deduction')::numeric,d.melody_deduction));
  sc:=public.himmah_score_v2(_mistakes,_melodies,_warnings,cfg);
  SELECT coalesce(max(attempt_no),0)+1 INTO n FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=a.hizb;
  INSERT INTO public.himmah_attempts(participant_id,reviewer_id,hizb,attempt_no,request_id,started_at,ended_at,duration_seconds,mistakes,melodies,warnings,error_weight,fail_threshold,equivalent_errors,scoring,score,status,approved_at)
  VALUES(p.id,a.reviewer_id,a.hizb,n,gen_random_uuid(),a.started_at,a.ended_at,least(a.duration_seconds,540),_mistakes,_melodies,_warnings,a.error_weight,a.fail_threshold,a.equivalent_errors,cfg,sc,CASE WHEN sc>=(cfg->>'pass_score')::numeric THEN 'pass' ELSE 'fail' END,clock_timestamp()) RETURNING * INTO b;
  INSERT INTO public.himmah_audit(day_id,attempt_id,actor_id,action,previous_value,new_value) VALUES(p.day_id,b.id,auth.uid(),'correction',to_jsonb(a),to_jsonb(b)||jsonb_build_object('reason',_reason));
  RETURN to_jsonb(b); END $$;
REVOKE ALL ON FUNCTION public.himmah_correct_v2(uuid,integer,integer,integer,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.himmah_correct_v2(uuid,integer,integer,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.himmah_manage(_action text,_day uuid DEFAULT NULL,_data jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; newh uuid[]; blocked text; did uuid:=_day; s public.students; h public.halaqat; hs integer[]; g jsonb; ts numeric; md numeric; ld numeric; wd numeric; ps numeric; tl integer; pl integer; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'الإعداد للإدارة فقط'; END IF;
  IF _action='create' THEN
    IF length(trim(_data->>'title')) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'اسم اليوم مطلوب'; END IF;
    INSERT INTO public.narration_sessions(title,session_date,created_by) VALUES(_data->>'title',(_data->>'day_date')::date,auth.uid()) RETURNING id INTO sid;
    INSERT INTO public.himmah_days(session_id,title,day_date,created_by) VALUES(sid,_data->>'title',(_data->>'day_date')::date,auth.uid()) RETURNING id INTO did;
  ELSIF _action='halaqat' THEN
    newh:=coalesce((SELECT array_agg(DISTINCT x::uuid) FROM jsonb_array_elements_text(_data->'halaqa_ids')x WHERE EXISTS(SELECT 1 FROM public.halaqat WHERE id=x::uuid)),'{}');
    PERFORM 1 FROM public.himmah_days WHERE id=did FOR UPDATE;
    SELECT string_agg(DISTINCT p.halaqa_name||' ('||p.student_name||')','، ') INTO blocked FROM public.himmah_participants p WHERE p.day_id=did AND NOT p.halaqa_id=ANY(newh) AND EXISTS(SELECT 1 FROM public.himmah_attempts a WHERE a.participant_id=p.id);
    IF blocked IS NOT NULL THEN RAISE EXCEPTION 'لا يمكن إزالة الحلقة لأن لطلابها محاولات محفوظة: %',blocked; END IF;
    DELETE FROM public.himmah_assignments WHERE day_id=did AND (NOT halaqa_id=ANY(newh) OR participant_id IN(SELECT id FROM public.himmah_participants WHERE day_id=did AND NOT halaqa_id=ANY(newh)));
    DELETE FROM public.himmah_participants WHERE day_id=did AND NOT p.halaqa_id=ANY(newh);
    UPDATE public.himmah_reviewers r SET status='pending',code_hash=NULL,code_issued_at=NULL WHERE r.day_id=did AND r.status='assigned' AND r.user_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.himmah_assignments a WHERE a.reviewer_id=r.id);
    UPDATE public.himmah_days SET halaqa_ids=newh WHERE id=did;
  ELSIF _action='participant' THEN
    SELECT * INTO s FROM public.students WHERE id=(_data->>'student_id')::uuid; SELECT * INTO h FROM public.halaqat WHERE id=s.halaqa_id;
    SELECT array_agg(DISTINCT x ORDER BY x) INTO hs FROM jsonb_array_elements_text(_data->'hizbs')v,LATERAL(SELECT v.value::integer x)n;
    IF s.id IS NULL OR h.id IS NULL OR cardinality(hs)<1 OR cardinality(hs)>60 OR EXISTS(SELECT 1 FROM unnest(hs)x WHERE x<1 OR x>60) THEN RAISE EXCEPTION 'اختر الطالب والأحزاب من 1 إلى 60'; END IF;
    IF EXISTS(SELECT 1 FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=did AND p.student_id=s.id AND NOT a.hizb=ANY(hs)) THEN RAISE EXCEPTION 'لا يمكن إزالة حزب له محاولات مسجلة'; END IF;
    INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(did,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs;
    UPDATE public.himmah_days SET halaqa_ids=array_append(halaqa_ids,h.id) WHERE id=did AND NOT h.id=ANY(halaqa_ids);
  ELSIF _action='remove_participant' THEN
    IF EXISTS(SELECT 1 FROM public.himmah_attempts WHERE participant_id=(_data->>'participant_id')::uuid) THEN RAISE EXCEPTION 'لا يمكن حذف طالب له محاولات'; END IF;
    DELETE FROM public.himmah_assignments WHERE day_id=did AND participant_id=(_data->>'participant_id')::uuid;
    DELETE FROM public.himmah_participants WHERE id=(_data->>'participant_id')::uuid AND day_id=did;
  ELSIF _action='attendance' THEN UPDATE public.himmah_participants SET present=(_data->>'present')::boolean WHERE id=(_data->>'participant_id')::uuid AND day_id=did;
  ELSIF _action='revoke' THEN UPDATE public.himmah_reviewers SET active=false,status='revoked',code_hash=NULL WHERE id=(_data->>'reviewer_id')::uuid AND day_id=did;
  ELSIF _action='settings' THEN
    IF greatest(length(coalesce(_data->>'logo_url','')),length(coalesce(_data->>'association_logo_url','')),length(coalesce(_data->>'stamp_url','')))>700000 THEN RAISE EXCEPTION 'حجم الصورة كبير؛ اختر صورة أصغر'; END IF;
    g:=_data->'grade_bounds';
    IF g IS NOT NULL AND NOT coalesce((g->>'excellent')::numeric<=100 AND (g->>'excellent')::numeric>(g->>'very_good')::numeric AND (g->>'very_good')::numeric>(g->>'good')::numeric AND (g->>'good')::numeric>(g->>'acceptable')::numeric AND (g->>'acceptable')::numeric>=0,false) THEN RAISE EXCEPTION 'حدود التقديرات يجب أن تكون تنازلية بين 0 و100'; END IF;
    SELECT coalesce((_data->>'total_score')::numeric,total_score),coalesce((_data->>'mistake_deduction')::numeric,mistake_deduction),coalesce((_data->>'melody_deduction')::numeric,melody_deduction),coalesce((_data->>'warning_deduction')::numeric,warning_deduction),coalesce((_data->>'pass_score')::numeric,pass_score),coalesce((_data->>'time_limit_seconds')::integer,time_limit_seconds),coalesce((_data->>'pause_limit_seconds')::integer,pause_limit_seconds) INTO ts,md,ld,wd,ps,tl,pl FROM public.himmah_days WHERE id=did;
    IF ts<=0 OR md<0 OR ld<0 OR wd<0 OR ps<0 OR ps>ts THEN RAISE EXCEPTION 'إعدادات الاحتساب غير صحيحة'; END IF;
    IF tl NOT BETWEEN 1 AND 540 THEN RAISE EXCEPTION 'مدة الحزب لا تتجاوز 540 ثانية'; END IF;
    IF pl NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'حد التوقف المؤقت بين 0 و3600 ثانية (0 = بلا حد)'; END IF;
    UPDATE public.himmah_days SET total_score=ts,mistake_deduction=md,melody_deduction=ld,warning_deduction=wd,pass_score=ps,time_limit_seconds=tl,pause_limit_seconds=pl,ranking_mode=_data->>'ranking_mode',registration_open=(_data->>'registration_open')::boolean,expires_at=(_data->>'expires_at')::timestamptz,manager_name=left(coalesce(_data->>'manager_name',''),120),logo_url=coalesce(_data->>'logo_url',logo_url),association_logo_url=coalesce(_data->>'association_logo_url',association_logo_url),stamp_url=coalesce(_data->>'stamp_url',stamp_url),certificate_title=left(coalesce(_data->>'certificate_title',certificate_title),150),certificate_note=left(coalesce(_data->>'certificate_note',certificate_note),500),grade_bounds=CASE WHEN g IS NULL THEN grade_bounds ELSE jsonb_build_object('excellent',(g->>'excellent')::numeric,'very_good',(g->>'very_good')::numeric,'good',(g->>'good')::numeric,'acceptable',(g->>'acceptable')::numeric) END WHERE id=did;
  ELSIF _action='correct' THEN RAISE EXCEPTION 'استخدم محاولة جديدة؛ النتائج المعتمدة محفوظة دون استبدال'; ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(did,auth.uid(),_action,_data-'logo_url'-'association_logo_url'-'stamp_url'); RETURN did; END $$;

-- شاشة مستقلة لا تكشف إلا الإحصاءات وأسماء المتصدرين، ولا تعمل إلا بمفتاح عرض منفصل عن كود المسمّع.
CREATE OR REPLACE FUNCTION public.himmah_public_display(_day uuid,_key uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.himmah_days; students jsonb; circles jsonb; overall jsonb; BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day AND display_key=_key; IF d.id IS NULL THEN RAISE EXCEPTION 'رابط العرض غير صحيح'; END IF;
  WITH latest AS(SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status,a.score FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND a.approved_at IS NOT NULL ORDER BY a.participant_id,a.hizb,a.approved_at DESC),
  per AS(SELECT p.student_name,p.halaqa_name,cardinality(p.hizbs) AS total,count(l.attempt_id) AS presented,count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed,coalesce(round(avg(l.score),1),0) AS average_score FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id WHERE p.day_id=_day GROUP BY p.id,p.student_name,p.halaqa_name,p.hizbs)
  SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') INTO students FROM(SELECT student_name,halaqa_name,total,presented,passed,average_score,round(CASE WHEN total>0 THEN passed::numeric/total*100 ELSE 0 END,1) AS completion FROM per ORDER BY passed DESC,average_score DESC,student_name LIMIT 5)s;
  WITH latest AS(SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND a.approved_at IS NOT NULL ORDER BY a.participant_id,a.hizb,a.approved_at DESC),
  per AS(SELECT p.halaqa_name,count(p.id) AS registered,count(p.id) FILTER(WHERE p.present) AS present,coalesce(sum(cardinality(p.hizbs)),0) AS total,count(l.attempt_id) AS presented,count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id WHERE p.day_id=_day GROUP BY p.halaqa_id,p.halaqa_name)
  SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO circles FROM(SELECT halaqa_name,registered,present,total,presented,passed,round(CASE WHEN total>0 THEN passed::numeric/total*100 ELSE 0 END,1) AS completion FROM per ORDER BY CASE WHEN total>0 THEN passed::numeric/total ELSE 0 END DESC,passed DESC,halaqa_name LIMIT 5)c;
  WITH latest AS(SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND a.approved_at IS NOT NULL ORDER BY a.participant_id,a.hizb,a.approved_at DESC)
  SELECT jsonb_build_object('registered',count(p.id),'present',count(p.id) FILTER(WHERE p.present),'total',coalesce(sum(cardinality(p.hizbs)),0),'presented',count(l.attempt_id),'passed',count(l.attempt_id) FILTER(WHERE l.status='pass')) INTO overall FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id WHERE p.day_id=_day;
  RETURN jsonb_build_object('day',jsonb_build_object('id',d.id,'title',d.title,'day_date',d.day_date,'logo_url',d.logo_url),'stats',overall,'best_student',students->0,'best_halaqa',circles->0,'top_students',students,'top_halaqat',circles,'server_now',clock_timestamp()); END $$;
REVOKE ALL ON FUNCTION public.himmah_public_display(uuid,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.himmah_public_display(uuid,uuid) TO anon,authenticated;
