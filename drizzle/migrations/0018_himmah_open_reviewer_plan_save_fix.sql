-- حفظ الخطة لا يلغي أكواد المسمّعين بعد إلغاء التوزيع، وإزالة الحلقة تستخدم مرجع الحلقة الصحيح.
CREATE OR REPLACE FUNCTION public.himmah_save_plan(_day uuid,_halaqa_ids uuid[],_plan jsonb,_remove uuid[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE newh uuid[]; blocked text; e jsonb; s public.students; h public.halaqat; hs integer[]; saved integer:=0; removed integer:=0; gone uuid[]; BEGIN
  IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'الإعداد للإدارة فقط'; END IF;
  PERFORM 1 FROM public.himmah_days WHERE id=_day FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
  IF jsonb_typeof(coalesce(_plan,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'بيانات المشاركين غير صحيحة'; END IF;
  newh:=coalesce((SELECT array_agg(DISTINCT x) FROM unnest(coalesce(_halaqa_ids,'{}'))x WHERE EXISTS(SELECT 1 FROM public.halaqat WHERE id=x)),'{}');
  SELECT coalesce(array_agg(p.id),'{}') INTO gone FROM public.himmah_participants p WHERE p.day_id=_day AND (NOT p.halaqa_id=ANY(newh) OR p.student_id=ANY(coalesce(_remove,'{}')));
  SELECT string_agg(p.student_name||' ('||p.halaqa_name||')','، ') INTO blocked FROM public.himmah_participants p WHERE p.id=ANY(gone) AND EXISTS(SELECT 1 FROM public.himmah_attempts a WHERE a.participant_id=p.id);
  IF blocked IS NOT NULL THEN RAISE EXCEPTION 'لا يمكن إزالة طلاب لهم محاولات محفوظة: %',blocked; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(_plan,'[]'::jsonb)) LOOP
    SELECT * INTO s FROM public.students WHERE id=(e->>'student_id')::uuid; SELECT * INTO h FROM public.halaqat WHERE id=s.halaqa_id;
    IF s.id IS NULL OR h.id IS NULL OR NOT h.id=ANY(newh) THEN RAISE EXCEPTION 'طالب خارج حلقات اليوم: %',coalesce(s.full_name,e->>'student_id'); END IF;
    IF s.id=ANY(coalesce(_remove,'{}')) THEN RAISE EXCEPTION 'طلب متعارض للطالب: %',s.full_name; END IF;
    IF jsonb_typeof(e->'hizbs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'نطاق أحزاب غير صحيح: %',s.full_name; END IF;
    SELECT array_agg(DISTINCT v.value::integer ORDER BY v.value::integer) INTO hs FROM jsonb_array_elements_text(e->'hizbs')v;
    IF hs IS NULL OR EXISTS(SELECT 1 FROM unnest(hs)x WHERE x<1 OR x>60) THEN RAISE EXCEPTION 'نطاق أحزاب غير صحيح: %',s.full_name; END IF;
    IF EXISTS(SELECT 1 FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND p.student_id=s.id AND a.status<>'cancelled' AND NOT a.hizb=ANY(hs)) THEN RAISE EXCEPTION 'لا يمكن إزالة حزب له محاولات مسجلة: %',s.full_name; END IF;
    INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(_day,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs;
    saved:=saved+1;
  END LOOP;
  DELETE FROM public.himmah_participants WHERE id=ANY(gone); GET DIAGNOSTICS removed=ROW_COUNT;
  UPDATE public.himmah_days SET halaqa_ids=newh WHERE id=_day;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,auth.uid(),'plan',jsonb_build_object('halaqa_ids',to_jsonb(newh),'saved',saved,'removed',removed));
  RETURN jsonb_build_object('saved',saved,'removed',removed); END $$;

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
    DELETE FROM public.himmah_participants WHERE day_id=did AND NOT halaqa_id=ANY(newh);
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
