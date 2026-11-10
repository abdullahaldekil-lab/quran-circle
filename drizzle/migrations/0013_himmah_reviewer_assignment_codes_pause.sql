ALTER TABLE public.himmah_reviewers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS code_hash text,
  ADD COLUMN IF NOT EXISTS code_issued_at timestamptz;
ALTER TABLE public.himmah_reviewers ADD CONSTRAINT himmah_reviewers_status_chk CHECK (status IN ('pending','assigned','revoked'));
UPDATE public.himmah_reviewers SET status='revoked' WHERE NOT active;
COMMENT ON COLUMN public.himmah_reviewers.token_hash IS 'DEPRECATED: registration no longer grants access; access uses code_hash';

ALTER TABLE public.himmah_days ADD COLUMN IF NOT EXISTS halaqa_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.himmah_days ADD CONSTRAINT himmah_days_time_limit_chk CHECK (time_limit_seconds BETWEEN 1 AND 540);
ALTER TABLE public.himmah_attempts
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.himmah_attempts ADD CONSTRAINT himmah_attempts_duration_max_chk CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 540) NOT VALID;

CREATE TABLE public.himmah_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.himmah_days(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.himmah_reviewers(id) ON DELETE CASCADE,
  halaqa_id uuid,
  participant_id uuid REFERENCES public.himmah_participants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((halaqa_id IS NULL) <> (participant_id IS NULL))
);
CREATE UNIQUE INDEX himmah_assignments_uniq ON public.himmah_assignments(reviewer_id, coalesce(halaqa_id, participant_id));
GRANT SELECT ON public.himmah_assignments TO authenticated;
GRANT ALL ON public.himmah_assignments TO service_role;
ALTER TABLE public.himmah_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Himmah admins read assignments" ON public.himmah_assignments FOR SELECT TO authenticated USING (public.himmah_admin());

-- Resolve an external reviewer from an access code: must be assigned, active, and the day unexpired.
CREATE OR REPLACE FUNCTION public.himmah_code_reviewer(_day uuid, _code text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT r.id FROM public.himmah_reviewers r JOIN public.himmah_days d ON d.id=r.day_id
  WHERE r.day_id=_day AND r.active AND r.status='assigned' AND r.code_hash IS NOT NULL AND d.expires_at>now()
    AND r.code_hash=encode(extensions.digest(upper(trim(coalesce(_code,''))),'sha256'),'hex') LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.himmah_in_scope(_reviewer uuid, _participant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.himmah_assignments s JOIN public.himmah_participants p ON p.id=_participant
    WHERE s.reviewer_id=_reviewer AND s.day_id=p.day_id AND (s.participant_id=p.id OR s.halaqa_id=p.halaqa_id)) $$;
CREATE OR REPLACE FUNCTION public.himmah_elapsed(_a public.himmah_attempts, _limit integer) RETURNS integer LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT least(_limit, greatest(0, floor(extract(epoch FROM coalesce(_a.paused_at, clock_timestamp()) - _a.started_at))::integer - _a.paused_seconds)) $$;
REVOKE ALL ON FUNCTION public.himmah_code_reviewer(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.himmah_in_scope(uuid,uuid) FROM PUBLIC, anon, authenticated;

-- Registration only records name + phone as pending; it never opens student data.
CREATE OR REPLACE FUNCTION public.himmah_register(_invite text, _name text, _phone text, _token text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE d public.himmah_days; r uuid; BEGIN SELECT * INTO d FROM public.himmah_days WHERE invite_key=_invite AND registration_open AND expires_at>now() FOR UPDATE; IF d.id IS NULL THEN RAISE EXCEPTION 'الرابط غير متاح أو انتهت صلاحيته'; END IF; IF _name IS NULL OR _phone IS NULL OR length(trim(_name)) NOT BETWEEN 3 AND 120 OR _phone !~ '^(05[0-9]{8}|9665[0-9]{8})$' THEN RAISE EXCEPTION 'الاسم أو الجوال غير صحيح'; END IF; IF EXISTS(SELECT 1 FROM public.himmah_reviewers WHERE day_id=d.id AND phone=_phone AND status<>'revoked') THEN RAISE EXCEPTION 'هذا الجوال مسجل مسبقًا؛ انتظر كود الدخول من الإدارة'; END IF; IF (SELECT count(*) FROM public.himmah_reviewers WHERE day_id=d.id)>2000 THEN RAISE EXCEPTION 'اكتمل العدد'; END IF; INSERT INTO public.himmah_reviewers(day_id,full_name,phone,status) VALUES(d.id,trim(_name),_phone,'pending') RETURNING id INTO r; RETURN jsonb_build_object('status','pending'); END $function$;

CREATE OR REPLACE FUNCTION public.himmah_issue_code(_reviewer uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.himmah_reviewers; c text:=''; b bytea; i int; alphabet text:='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'للإدارة فقط'; END IF;
  SELECT * INTO r FROM public.himmah_reviewers WHERE id=_reviewer FOR UPDATE;
  IF r.id IS NULL OR r.user_id IS NOT NULL OR NOT r.active OR r.status='revoked' THEN RAISE EXCEPTION 'المسمّع غير متاح'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.himmah_assignments WHERE reviewer_id=r.id) THEN RAISE EXCEPTION 'وزّع حلقات أو طلابًا على المسمّع أولًا'; END IF;
  b := extensions.gen_random_bytes(8);
  FOR i IN 0..7 LOOP c := c || substr(alphabet, (get_byte(b,i) % length(alphabet)) + 1, 1); END LOOP;
  UPDATE public.himmah_reviewers SET code_hash=encode(extensions.digest(c,'sha256'),'hex'), code_issued_at=now(), status='assigned' WHERE id=r.id;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(r.day_id,auth.uid(),'issue_code',jsonb_build_object('reviewer_id',r.id));
  RETURN c; END $$;
REVOKE ALL ON FUNCTION public.himmah_issue_code(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.himmah_issue_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.himmah_dashboard_internal(_day uuid, _token text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE d public.himmah_days; ext boolean:=false; rid uuid; adm boolean; result jsonb; BEGIN SELECT * INTO d FROM public.himmah_days WHERE id=_day; IF d.id IS NULL THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
IF _token IS NOT NULL THEN rid := public.himmah_code_reviewer(_day,_token); IF rid IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF; ext:=true; ELSIF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
adm := public.himmah_admin() AND NOT ext;
SELECT jsonb_build_object('day', (to_jsonb(d)-'invite_key'-'created_by') || CASE WHEN adm THEN jsonb_build_object('invite_key',d.invite_key) ELSE '{}'::jsonb END,'can_manage',adm,'reviewer_id',rid,
'participants',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.halaqa_name,p.student_name) FROM public.himmah_participants p WHERE p.day_id=_day AND CASE WHEN ext THEN public.himmah_in_scope(rid,p.id) ELSE public.himmah_view_halaqa(p.halaqa_id) END),'[]'::jsonb),
'reviewers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'full_name',r.full_name,'active',r.active,'status',r.status,'staff',r.user_id IS NOT NULL,'code_issued_at',CASE WHEN adm THEN r.code_issued_at END,'phone',CASE WHEN adm THEN r.phone ELSE '' END) ORDER BY r.created_at) FROM public.himmah_reviewers r WHERE r.day_id=_day AND (NOT ext OR r.id=rid)),'[]'::jsonb),
'assignments',CASE WHEN adm THEN coalesce((SELECT jsonb_agg(jsonb_build_object('reviewer_id',s.reviewer_id,'halaqa_id',s.halaqa_id,'participant_id',s.participant_id)) FROM public.himmah_assignments s WHERE s.day_id=_day),'[]'::jsonb) ELSE '[]'::jsonb END,
'attempts',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.started_at) FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND CASE WHEN ext THEN public.himmah_in_scope(rid,p.id) ELSE public.himmah_view_halaqa(p.halaqa_id) END),'[]'::jsonb),
'audit',CASE WHEN adm THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.himmah_audit WHERE day_id=_day ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb) ELSE '[]'::jsonb END) INTO result; RETURN result; END $function$;

CREATE OR REPLACE FUNCTION public.himmah_attempt(_action text, _day uuid, _participant uuid DEFAULT NULL::uuid, _hizb integer DEFAULT NULL::integer, _attempt uuid DEFAULT NULL::uuid, _request uuid DEFAULT NULL::uuid, _mistakes integer DEFAULT 0, _warnings integer DEFAULT 0, _token text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE d public.himmah_days; p public.himmah_participants; r public.himmah_reviewers; a public.himmah_attempts; n integer; cfg jsonb; sc numeric; el integer; BEGIN SELECT * INTO d FROM public.himmah_days WHERE id=_day FOR SHARE; IF d.id IS NULL THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
IF _token IS NOT NULL THEN SELECT * INTO r FROM public.himmah_reviewers WHERE id=public.himmah_code_reviewer(_day,_token); IF r.id IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF;
ELSE IF NOT public.is_staff(auth.uid()) OR public.get_staff_role(auth.uid()) NOT IN ('manager','teacher','assistant_teacher') THEN RAISE EXCEPTION 'غير مصرح بإدخال النتائج'; END IF; INSERT INTO public.himmah_reviewers(day_id,full_name,user_id,status) SELECT _day,full_name,id,'assigned' FROM public.profiles WHERE id=auth.uid() ON CONFLICT(day_id,user_id) DO NOTHING; SELECT * INTO r FROM public.himmah_reviewers WHERE day_id=_day AND user_id=auth.uid() AND active; IF r.id IS NULL THEN RAISE EXCEPTION 'جلسة موقوفة'; END IF; END IF;
IF _action='start' THEN SELECT * INTO p FROM public.himmah_participants WHERE id=_participant AND day_id=_day FOR UPDATE; ELSE SELECT * INTO a FROM public.himmah_attempts WHERE id=_attempt FOR UPDATE; SELECT * INTO p FROM public.himmah_participants WHERE id=a.participant_id AND day_id=_day; IF a.reviewer_id IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'لا يمكنك تعديل محاولة مسمّع آخر'; END IF; END IF;
IF p.id IS NULL OR (_token IS NULL AND NOT public.himmah_view_halaqa(p.halaqa_id)) OR (_token IS NOT NULL AND NOT public.himmah_in_scope(r.id,p.id)) THEN RAISE EXCEPTION 'الطالب خارج نطاقك'; END IF;
IF _mistakes NOT BETWEEN 0 AND 10000 OR _warnings NOT BETWEEN 0 AND 10000 OR _mistakes IS NULL OR _warnings IS NULL THEN RAISE EXCEPTION 'الأعداد يجب أن تكون صحيحة وغير سالبة'; END IF;
-- Hard time limit: a running attempt that reached the limit is stopped before any further action.
IF a.id IS NOT NULL AND a.status='running' AND public.himmah_elapsed(a,d.time_limit_seconds)>=d.time_limit_seconds THEN UPDATE public.himmah_attempts SET duration_seconds=d.time_limit_seconds, ended_at=clock_timestamp(), paused_at=NULL, status='ended' WHERE id=a.id RETURNING * INTO a; END IF;
IF _action='start' THEN IF _request IS NULL OR _hizb IS NULL OR NOT _hizb=ANY(p.hizbs) THEN RAISE EXCEPTION 'الحزب غير مقرر'; END IF; SELECT * INTO a FROM public.himmah_attempts WHERE request_id=_request; IF a.id IS NOT NULL THEN IF a.reviewer_id<>r.id OR a.participant_id<>p.id OR a.hizb<>_hizb THEN RAISE EXCEPTION 'طلب مكرر غير صحيح'; END IF; RETURN to_jsonb(a); END IF; SELECT * INTO a FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb AND reviewer_id=r.id AND status IN ('running','ended'); IF a.id IS NOT NULL THEN RETURN to_jsonb(a); END IF; SELECT coalesce(max(attempt_no),0)+1 INTO n FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=_hizb; INSERT INTO public.himmah_attempts(participant_id,reviewer_id,hizb,attempt_no,request_id) VALUES(p.id,r.id,_hizb,n,_request) RETURNING * INTO a;
ELSIF _action='pause' THEN IF a.status='running' AND a.paused_at IS NULL THEN UPDATE public.himmah_attempts SET paused_at=clock_timestamp(),mistakes=_mistakes,warnings=_warnings WHERE id=a.id RETURNING * INTO a; END IF;
ELSIF _action='resume' THEN IF a.status='running' AND a.paused_at IS NOT NULL THEN UPDATE public.himmah_attempts SET paused_seconds=paused_seconds+floor(extract(epoch FROM clock_timestamp()-paused_at))::integer, paused_at=NULL WHERE id=a.id RETURNING * INTO a; END IF;
ELSIF _action IN ('counts','end') THEN IF a.status NOT IN ('running','ended') THEN RAISE EXCEPTION 'النتيجة معتمدة؛ ابدأ محاولة جديدة'; END IF;
  el := public.himmah_elapsed(a,d.time_limit_seconds);
  UPDATE public.himmah_attempts SET mistakes=_mistakes,warnings=_warnings,
    ended_at=CASE WHEN _action='end' THEN coalesce(ended_at,clock_timestamp()) ELSE ended_at END,
    duration_seconds=CASE WHEN _action='end' THEN coalesce(duration_seconds,el) ELSE duration_seconds END,
    paused_at=CASE WHEN _action='end' THEN NULL ELSE paused_at END,
    status=CASE WHEN _action='end' THEN 'ended' ELSE status END WHERE id=a.id RETURNING * INTO a;
ELSIF _action='approve' THEN IF a.status IN ('pass','fail') THEN RETURN to_jsonb(a); END IF; IF a.status<>'ended' THEN RAISE EXCEPTION 'أنهِ الحزب قبل الاعتماد'; END IF;
  cfg := jsonb_build_object('total_score',d.total_score,'mistake_deduction',d.mistake_deduction,'warning_deduction',d.warning_deduction,'pass_score',d.pass_score,'time_limit_seconds',d.time_limit_seconds,'reviewer_name',r.full_name);
  sc := public.himmah_score(a.mistakes,a.warnings,cfg);
  UPDATE public.himmah_attempts SET scoring=cfg,score=sc,status=CASE WHEN sc>=d.pass_score THEN 'pass' ELSE 'fail' END,approved_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
  UPDATE public.himmah_participants SET present=true WHERE id=p.id; INSERT INTO public.himmah_audit(day_id,attempt_id,actor_id,action,new_value) VALUES(_day,a.id,r.id,'approve',to_jsonb(a)); ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF; RETURN to_jsonb(a); END $function$;

CREATE OR REPLACE FUNCTION public.himmah_assign(_reviewer uuid, _halaqat uuid[], _participants uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.himmah_reviewers; n integer; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'للإدارة فقط'; END IF;
  SELECT * INTO r FROM public.himmah_reviewers WHERE id=_reviewer FOR UPDATE; IF r.id IS NULL OR r.status='revoked' THEN RAISE EXCEPTION 'المسمّع غير متاح'; END IF;
  DELETE FROM public.himmah_assignments WHERE reviewer_id=r.id;
  INSERT INTO public.himmah_assignments(day_id,reviewer_id,halaqa_id) SELECT DISTINCT r.day_id,r.id,h FROM unnest(coalesce(_halaqat,'{}')) h WHERE EXISTS(SELECT 1 FROM public.himmah_participants p WHERE p.day_id=r.day_id AND p.halaqa_id=h);
  INSERT INTO public.himmah_assignments(day_id,reviewer_id,participant_id) SELECT DISTINCT r.day_id,r.id,x FROM unnest(coalesce(_participants,'{}')) x WHERE EXISTS(SELECT 1 FROM public.himmah_participants p WHERE p.day_id=r.day_id AND p.id=x);
  SELECT count(*) INTO n FROM public.himmah_assignments WHERE reviewer_id=r.id;
  IF n=0 AND r.status='assigned' AND r.user_id IS NULL THEN UPDATE public.himmah_reviewers SET status='pending', code_hash=NULL WHERE id=r.id; END IF;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(r.day_id,auth.uid(),'assign',jsonb_build_object('reviewer_id',r.id,'halaqat',_halaqat,'participants',_participants));
  RETURN n; END $$;
REVOKE ALL ON FUNCTION public.himmah_assign(uuid,uuid[],uuid[]) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.himmah_assign(uuid,uuid[],uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.himmah_manage(_action text, _day uuid DEFAULT NULL::uuid, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE sid uuid; did uuid:=_day; s public.students; h public.halaqat; hs integer[]; g jsonb; ts numeric; md numeric; wd numeric; ps numeric; tl integer; BEGIN IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'الإعداد للإدارة فقط'; END IF;
IF _action='create' THEN IF length(trim(_data->>'title')) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'اسم اليوم مطلوب'; END IF; INSERT INTO public.narration_sessions(title,session_date,created_by) VALUES(_data->>'title',(_data->>'day_date')::date,auth.uid()) RETURNING id INTO sid; INSERT INTO public.himmah_days(session_id,title,day_date,created_by) VALUES(sid,_data->>'title',(_data->>'day_date')::date,auth.uid()) RETURNING id INTO did;
ELSIF _action='halaqat' THEN UPDATE public.himmah_days SET halaqa_ids=coalesce((SELECT array_agg(DISTINCT x::uuid) FROM jsonb_array_elements_text(_data->'halaqa_ids') x WHERE EXISTS(SELECT 1 FROM public.halaqat WHERE id=x::uuid)),'{}') WHERE id=did;
ELSIF _action='participant' THEN SELECT * INTO s FROM public.students WHERE id=(_data->>'student_id')::uuid; SELECT * INTO h FROM public.halaqat WHERE id=s.halaqa_id; SELECT array_agg(DISTINCT x ORDER BY x) INTO hs FROM jsonb_array_elements_text(_data->'hizbs') v, LATERAL (SELECT v.value::integer x) n; IF s.id IS NULL OR h.id IS NULL OR cardinality(hs)<1 OR cardinality(hs)>60 OR EXISTS(SELECT 1 FROM unnest(hs) x WHERE x<1 OR x>60) THEN RAISE EXCEPTION 'اختر الطالب والأحزاب من 1 إلى 60'; END IF; IF EXISTS(SELECT 1 FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=did AND p.student_id=s.id AND NOT a.hizb=ANY(hs)) THEN RAISE EXCEPTION 'لا يمكن إزالة حزب له محاولات مسجلة'; END IF; INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(did,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs;
ELSIF _action='remove_participant' THEN IF EXISTS(SELECT 1 FROM public.himmah_attempts WHERE participant_id=(_data->>'participant_id')::uuid) THEN RAISE EXCEPTION 'لا يمكن حذف طالب له محاولات'; END IF; DELETE FROM public.himmah_participants WHERE id=(_data->>'participant_id')::uuid AND day_id=did;
ELSIF _action='attendance' THEN UPDATE public.himmah_participants SET present=(_data->>'present')::boolean WHERE id=(_data->>'participant_id')::uuid AND day_id=did;
ELSIF _action='revoke' THEN UPDATE public.himmah_reviewers SET active=false,status='revoked',code_hash=NULL WHERE id=(_data->>'reviewer_id')::uuid AND day_id=did;
ELSIF _action='settings' THEN
  g := _data->'grade_bounds';
  IF g IS NOT NULL AND NOT ((g->>'excellent')::numeric <= 100 AND (g->>'excellent')::numeric > (g->>'very_good')::numeric AND (g->>'very_good')::numeric > (g->>'good')::numeric AND (g->>'good')::numeric > (g->>'acceptable')::numeric AND (g->>'acceptable')::numeric >= 0) THEN RAISE EXCEPTION 'حدود التقديرات يجب أن تكون تنازلية بين 0 و100'; END IF;
  SELECT coalesce((_data->>'total_score')::numeric,total_score),coalesce((_data->>'mistake_deduction')::numeric,mistake_deduction),coalesce((_data->>'warning_deduction')::numeric,warning_deduction),coalesce((_data->>'pass_score')::numeric,pass_score),coalesce((_data->>'time_limit_seconds')::integer,time_limit_seconds) INTO ts,md,wd,ps,tl FROM public.himmah_days WHERE id=did;
  IF ts<=0 OR md<0 OR wd<0 OR ps<0 OR ps>ts THEN RAISE EXCEPTION 'إعدادات الاحتساب غير صحيحة: حد النجاح بين صفر والدرجة الكلية والخصومات غير سالبة'; END IF;
  IF tl NOT BETWEEN 1 AND 540 THEN RAISE EXCEPTION 'مدة الحزب لا تتجاوز 540 ثانية'; END IF;
  UPDATE public.himmah_days SET total_score=ts,mistake_deduction=md,warning_deduction=wd,pass_score=ps,time_limit_seconds=tl,ranking_mode=_data->>'ranking_mode',registration_open=(_data->>'registration_open')::boolean,expires_at=(_data->>'expires_at')::timestamptz,manager_name=left(coalesce(_data->>'manager_name',''),120),logo_url=coalesce(_data->>'logo_url',''),association_logo_url=coalesce(_data->>'association_logo_url',''),stamp_url=coalesce(_data->>'stamp_url',''),grade_bounds=coalesce(jsonb_build_object('excellent',(g->>'excellent')::numeric,'very_good',(g->>'very_good')::numeric,'good',(g->>'good')::numeric,'acceptable',(g->>'acceptable')::numeric),grade_bounds) WHERE id=did;
ELSIF _action='correct' THEN RAISE EXCEPTION 'استخدم محاولة جديدة؛ النتائج المعتمدة محفوظة دون استبدال'; ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF;
INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(did,auth.uid(),_action,_data); RETURN did; END $function$;