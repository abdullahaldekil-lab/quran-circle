-- Himmah fixes: legacy circle backfill, cancellable attempts, atomic plan save, lighter dashboard payload, stricter settings validation.

-- 1. Days created before circle-based setup keep their participants when the circle list is saved.
UPDATE public.himmah_days d SET halaqa_ids=(SELECT array_agg(DISTINCT p.halaqa_id) FROM public.himmah_participants p WHERE p.day_id=d.id)
  WHERE EXISTS(SELECT 1 FROM public.himmah_participants p WHERE p.day_id=d.id AND NOT p.halaqa_id=ANY(d.halaqa_ids));

-- 2. Branding images no longer live in the audit trail.
UPDATE public.himmah_audit SET new_value=new_value-'logo_url'-'association_logo_url'-'stamp_url' WHERE action='settings' AND new_value ?| ARRAY['logo_url','association_logo_url','stamp_url'];

-- Grade bounds saved as nulls by the earlier settings action fall back to the defaults.
UPDATE public.himmah_days SET grade_bounds='{"excellent":90,"very_good":80,"good":70,"acceptable":60}'::jsonb
  WHERE (grade_bounds->>'excellent') IS NULL OR (grade_bounds->>'very_good') IS NULL OR (grade_bounds->>'good') IS NULL OR (grade_bounds->>'acceptable') IS NULL;

-- 3. A mistaken or stranded attempt can be cancelled before approval; approved attempts stay immutable.
ALTER TABLE public.himmah_attempts DROP CONSTRAINT IF EXISTS himmah_attempts_status_check;
ALTER TABLE public.himmah_attempts ADD CONSTRAINT himmah_attempts_status_check CHECK (status IN ('running','ended','pass','fail','cancelled'));

CREATE OR REPLACE FUNCTION public.himmah_cancel_attempt(_day uuid, _attempt uuid, _token text DEFAULT NULL, _reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.himmah_attempts; p public.himmah_participants; rid uuid; BEGIN
  SELECT * INTO a FROM public.himmah_attempts WHERE id=_attempt FOR UPDATE;
  SELECT * INTO p FROM public.himmah_participants WHERE id=a.participant_id AND day_id=_day;
  IF p.id IS NULL THEN RAISE EXCEPTION 'المحاولة غير موجودة'; END IF;
  IF _token IS NOT NULL THEN
    rid := public.himmah_code_reviewer(_day,_token);
    IF rid IS NULL THEN RAISE EXCEPTION 'الكود غير صحيح أو انتهت صلاحيته'; END IF;
    IF a.reviewer_id<>rid THEN RAISE EXCEPTION 'لا يمكنك تعديل محاولة مسمّع آخر'; END IF;
  ELSIF NOT public.himmah_admin() THEN
    SELECT id INTO rid FROM public.himmah_reviewers WHERE id=a.reviewer_id AND user_id=auth.uid() AND active;
    IF rid IS NULL THEN RAISE EXCEPTION 'لا يمكنك تعديل محاولة مسمّع آخر'; END IF;
  END IF;
  IF a.status='cancelled' THEN RETURN to_jsonb(a); END IF;
  IF a.approved_at IS NOT NULL OR a.status NOT IN ('running','ended') THEN RAISE EXCEPTION 'النتيجة معتمدة ولا تُلغى؛ استخدم التصحيح الموثّق'; END IF;
  UPDATE public.himmah_attempts SET status='cancelled', ended_at=coalesce(ended_at,clock_timestamp()), paused_at=NULL WHERE id=a.id RETURNING * INTO a;
  INSERT INTO public.himmah_audit(day_id,attempt_id,actor_id,action,new_value) VALUES(_day,a.id,coalesce(auth.uid(),rid),'cancel_attempt',jsonb_build_object('hizb',a.hizb,'participant_id',a.participant_id,'reason',left(coalesce(_reason,''),300)));
  RETURN to_jsonb(a); END $$;
REVOKE ALL ON FUNCTION public.himmah_cancel_attempt(uuid,uuid,text,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.himmah_cancel_attempt(uuid,uuid,text,text) TO anon,authenticated;

-- 4. One atomic save for the day's circles and participants, with a single audit row.
CREATE OR REPLACE FUNCTION public.himmah_save_plan(_day uuid, _halaqa_ids uuid[], _plan jsonb, _remove uuid[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE newh uuid[]; blocked text; e jsonb; s public.students; h public.halaqat; hs integer[]; saved integer:=0; removed integer:=0; gone uuid[]; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'الإعداد للإدارة فقط'; END IF;
  PERFORM 1 FROM public.himmah_days WHERE id=_day FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
  IF jsonb_typeof(coalesce(_plan,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'بيانات المشاركين غير صحيحة'; END IF;
  newh := coalesce((SELECT array_agg(DISTINCT x) FROM unnest(coalesce(_halaqa_ids,'{}')) x WHERE EXISTS(SELECT 1 FROM public.halaqat WHERE id=x)),'{}');
  SELECT coalesce(array_agg(p.id),'{}') INTO gone FROM public.himmah_participants p WHERE p.day_id=_day AND (NOT p.halaqa_id=ANY(newh) OR p.student_id=ANY(coalesce(_remove,'{}')));
  SELECT string_agg(p.student_name||' ('||p.halaqa_name||')', '، ') INTO blocked FROM public.himmah_participants p WHERE p.id=ANY(gone) AND EXISTS(SELECT 1 FROM public.himmah_attempts a WHERE a.participant_id=p.id);
  IF blocked IS NOT NULL THEN RAISE EXCEPTION 'لا يمكن إزالة طلاب لهم محاولات محفوظة: %', blocked; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(_plan,'[]'::jsonb)) LOOP
    SELECT * INTO s FROM public.students WHERE id=(e->>'student_id')::uuid;
    SELECT * INTO h FROM public.halaqat WHERE id=s.halaqa_id;
    IF s.id IS NULL OR h.id IS NULL OR NOT h.id=ANY(newh) THEN RAISE EXCEPTION 'طالب خارج حلقات اليوم: %', coalesce(s.full_name,e->>'student_id'); END IF;
    IF s.id=ANY(coalesce(_remove,'{}')) THEN RAISE EXCEPTION 'طلب متعارض للطالب: %', s.full_name; END IF;
    IF jsonb_typeof(e->'hizbs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'نطاق أحزاب غير صحيح: %', s.full_name; END IF;
    SELECT array_agg(DISTINCT v.value::integer ORDER BY v.value::integer) INTO hs FROM jsonb_array_elements_text(e->'hizbs') v;
    IF hs IS NULL OR EXISTS(SELECT 1 FROM unnest(hs) x WHERE x<1 OR x>60) THEN RAISE EXCEPTION 'نطاق أحزاب غير صحيح: %', s.full_name; END IF;
    IF EXISTS(SELECT 1 FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND p.student_id=s.id AND a.status<>'cancelled' AND NOT a.hizb=ANY(hs)) THEN RAISE EXCEPTION 'لا يمكن إزالة حزب له محاولات مسجلة: %', s.full_name; END IF;
    INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(_day,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs;
    saved := saved+1;
  END LOOP;
  DELETE FROM public.himmah_assignments WHERE day_id=_day AND (NOT halaqa_id=ANY(newh) OR participant_id=ANY(gone));
  DELETE FROM public.himmah_participants WHERE id=ANY(gone); GET DIAGNOSTICS removed = ROW_COUNT;
  UPDATE public.himmah_reviewers r SET status='pending',code_hash=NULL,code_issued_at=NULL WHERE r.day_id=_day AND r.status='assigned' AND r.user_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.himmah_assignments a WHERE a.reviewer_id=r.id);
  UPDATE public.himmah_days SET halaqa_ids=newh WHERE id=_day;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,auth.uid(),'plan',jsonb_build_object('halaqa_ids',to_jsonb(newh),'saved',saved,'removed',removed));
  RETURN jsonb_build_object('saved',saved,'removed',removed); END $$;
REVOKE ALL ON FUNCTION public.himmah_save_plan(uuid,uuid[],jsonb,uuid[]) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.himmah_save_plan(uuid,uuid[],jsonb,uuid[]) TO authenticated;

-- 5. The polled dashboard no longer carries branding images or audit payloads, and reports server time for the recitation clock.
CREATE OR REPLACE FUNCTION public.himmah_dashboard(_day uuid,_token text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE result jsonb; BEGIN
  IF _token IS NULL AND NOT (public.himmah_admin() OR EXISTS(SELECT 1 FROM public.himmah_participants WHERE day_id=_day AND public.himmah_view_halaqa(halaqa_id))) THEN RAISE EXCEPTION 'هذا اليوم خارج نطاقك'; END IF;
  result := public.himmah_dashboard_internal(_day,_token);
  result := jsonb_set(result,'{day}',(result->'day')-'stamp_url'-'association_logo_url'-'logo_url');
  IF _token IS NOT NULL THEN result := jsonb_set(result,'{day}',(result->'day')-'manager_name'); END IF;
  result := jsonb_set(result,'{audit}',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x->'id','action',x->'action','created_at',x->'created_at')) FROM jsonb_array_elements(result->'audit') x),'[]'::jsonb));
  RETURN result || jsonb_build_object('server_now',clock_timestamp()); END $$;
REVOKE ALL ON FUNCTION public.himmah_dashboard(uuid,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.himmah_dashboard(uuid,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.himmah_branding(_day uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('logo_url',d.logo_url,'association_logo_url',d.association_logo_url,'stamp_url',d.stamp_url) FROM public.himmah_days d
  WHERE d.id=_day AND (public.himmah_admin() OR EXISTS(SELECT 1 FROM public.himmah_participants p WHERE p.day_id=d.id AND public.himmah_view_halaqa(p.halaqa_id))) $$;
REVOKE ALL ON FUNCTION public.himmah_branding(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.himmah_branding(uuid) TO authenticated;

-- 6. Corrections apply to the latest approved result only and respect the 540-second cap.
CREATE OR REPLACE FUNCTION public.himmah_correct(_attempt uuid, _mistakes integer, _warnings integer, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE a public.himmah_attempts; p public.himmah_participants; b public.himmah_attempts; d public.himmah_days; n integer; cfg jsonb; sc numeric; BEGIN IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'التصحيح للإدارة فقط'; END IF; IF _mistakes NOT BETWEEN 0 AND 10000 OR _warnings NOT BETWEEN 0 AND 10000 OR _mistakes IS NULL OR _warnings IS NULL OR length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'أدخل أعدادًا صحيحة وسبب التصحيح'; END IF; SELECT * INTO a FROM public.himmah_attempts WHERE id=_attempt AND approved_at IS NOT NULL; SELECT * INTO p FROM public.himmah_participants WHERE id=a.participant_id FOR UPDATE; IF p.id IS NULL THEN RAISE EXCEPTION 'النتيجة غير موجودة'; END IF; IF EXISTS(SELECT 1 FROM public.himmah_attempts x WHERE x.participant_id=a.participant_id AND x.hizb=a.hizb AND x.approved_at>a.approved_at) THEN RAISE EXCEPTION 'صحّح أحدث نتيجة معتمدة لهذا الحزب'; END IF; SELECT * INTO d FROM public.himmah_days WHERE id=p.day_id;
  cfg := coalesce(a.scoring, jsonb_build_object('total_score',d.total_score,'mistake_deduction',d.mistake_deduction,'warning_deduction',d.warning_deduction,'pass_score',d.pass_score,'time_limit_seconds',d.time_limit_seconds,'reviewer_name',(SELECT full_name FROM public.himmah_reviewers WHERE id=a.reviewer_id)));
  sc := public.himmah_score(_mistakes,_warnings,cfg);
  SELECT coalesce(max(attempt_no),0)+1 INTO n FROM public.himmah_attempts WHERE participant_id=p.id AND hizb=a.hizb; INSERT INTO public.himmah_attempts(participant_id,reviewer_id,hizb,attempt_no,request_id,started_at,ended_at,duration_seconds,mistakes,warnings,error_weight,fail_threshold,equivalent_errors,scoring,score,status,approved_at) VALUES(p.id,a.reviewer_id,a.hizb,n,gen_random_uuid(),a.started_at,a.ended_at,least(a.duration_seconds,540),_mistakes,_warnings,a.error_weight,a.fail_threshold,a.equivalent_errors,cfg,sc,CASE WHEN sc>=(cfg->>'pass_score')::numeric THEN 'pass' ELSE 'fail' END,clock_timestamp()) RETURNING * INTO b; INSERT INTO public.himmah_audit(day_id,attempt_id,actor_id,action,previous_value,new_value) VALUES(p.day_id,b.id,auth.uid(),'correction',to_jsonb(a),to_jsonb(b)||jsonb_build_object('reason',_reason)); RETURN to_jsonb(b); END $function$;

-- 7. Settings: grade bounds must be complete, branding is kept when omitted and never audited; staff reviewers keep their status.
CREATE OR REPLACE FUNCTION public.himmah_manage(_action text, _day uuid DEFAULT NULL::uuid, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE sid uuid; newh uuid[]; blocked text; did uuid:=_day; s public.students; h public.halaqat; hs integer[]; g jsonb; ts numeric; md numeric; wd numeric; ps numeric; tl integer; BEGIN IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'الإعداد للإدارة فقط'; END IF;
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
  SELECT coalesce((_data->>'total_score')::numeric,total_score),coalesce((_data->>'mistake_deduction')::numeric,mistake_deduction),coalesce((_data->>'warning_deduction')::numeric,warning_deduction),coalesce((_data->>'pass_score')::numeric,pass_score),coalesce((_data->>'time_limit_seconds')::integer,time_limit_seconds) INTO ts,md,wd,ps,tl FROM public.himmah_days WHERE id=did;
  IF ts<=0 OR md<0 OR wd<0 OR ps<0 OR ps>ts THEN RAISE EXCEPTION 'إعدادات الاحتساب غير صحيحة: حد النجاح بين صفر والدرجة الكلية والخصومات غير سالبة'; END IF;
  IF tl NOT BETWEEN 1 AND 540 THEN RAISE EXCEPTION 'مدة الحزب لا تتجاوز 540 ثانية'; END IF;
  UPDATE public.himmah_days SET total_score=ts,mistake_deduction=md,warning_deduction=wd,pass_score=ps,time_limit_seconds=tl,ranking_mode=_data->>'ranking_mode',registration_open=(_data->>'registration_open')::boolean,expires_at=(_data->>'expires_at')::timestamptz,manager_name=left(coalesce(_data->>'manager_name',''),120),logo_url=coalesce(_data->>'logo_url',logo_url),association_logo_url=coalesce(_data->>'association_logo_url',association_logo_url),stamp_url=coalesce(_data->>'stamp_url',stamp_url),grade_bounds=CASE WHEN g IS NULL THEN grade_bounds ELSE jsonb_build_object('excellent',(g->>'excellent')::numeric,'very_good',(g->>'very_good')::numeric,'good',(g->>'good')::numeric,'acceptable',(g->>'acceptable')::numeric) END WHERE id=did;
ELSIF _action='correct' THEN RAISE EXCEPTION 'استخدم محاولة جديدة؛ النتائج المعتمدة محفوظة دون استبدال'; ELSE RAISE EXCEPTION 'عملية غير صحيحة'; END IF;
INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(did,auth.uid(),_action,_data-'logo_url'-'association_logo_url'-'stamp_url'); RETURN did; END $function$;
