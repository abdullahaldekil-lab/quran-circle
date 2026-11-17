CREATE OR REPLACE FUNCTION public.himmah_plan_hizbs(_student uuid,_hizbs jsonb,_previous integer[] DEFAULT '{}') RETURNS integer[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result integer[]; added integer[]; completed integer[]; missing integer[]; nm text; BEGIN
 SELECT full_name INTO nm FROM public.students WHERE id=_student;
 IF jsonb_typeof(_hizbs) IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(_hizbs)x WHERE x IS NULL OR x !~ '^(?:[1-9]|[1-5][0-9]|60)$') THEN RAISE EXCEPTION 'نطاق أحزاب غير صحيح: %',nm; END IF;
 SELECT coalesce(array_agg(DISTINCT x::integer ORDER BY x::integer),'{}') INTO result FROM jsonb_array_elements_text(_hizbs)x;
 IF cardinality(result)=0 THEN RAISE EXCEPTION 'اختر حزبًا واحدًا على الأقل للطالب: %',nm; END IF;
 SELECT coalesce(array_agg(h),'{}') INTO added FROM unnest(result)h WHERE NOT h=ANY(coalesce(_previous,'{}'));
 IF cardinality(added)>0 THEN
  IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=_student AND status='active') THEN RAISE EXCEPTION 'الطالب غير نشط: %',nm; END IF;
  completed:=public.mem_completed(_student);
  SELECT array_agg(h ORDER BY h) INTO missing FROM unnest(added)h WHERE NOT h=ANY(completed);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'الطالب % — الأحزاب %: الحفظ غير مكتمل أو غير موثق في ملف الطالب',nm,array_to_string(missing,'، '); END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.himmah_plan_hizbs(uuid,jsonb,integer[]) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.himmah_participant_eligibility_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.student_id=OLD.student_id AND NEW.day_id=OLD.day_id THEN
  NEW.hizbs:=public.himmah_plan_hizbs(NEW.student_id,to_jsonb(NEW.hizbs),OLD.hizbs);
  IF EXISTS(SELECT 1 FROM public.himmah_attempts a WHERE a.participant_id=OLD.id AND NOT a.hizb=ANY(NEW.hizbs)) THEN RAISE EXCEPTION 'لا يمكن استبعاد حزب مرتبط بمحاولة محفوظة للطالب: %',NEW.student_name; END IF;
 ELSE NEW.hizbs:=public.himmah_plan_hizbs(NEW.student_id,to_jsonb(NEW.hizbs),'{}'); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.himmah_participant_eligibility_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.himmah_save_plan(_day uuid,_halaqa_ids uuid[],_plan jsonb,_remove uuid[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE newh uuid[]; e jsonb; s public.students; h public.halaqat; previous public.himmah_participants; hs integer[]; saved integer:=0; removed integer:=0; gone uuid[]; issues jsonb:='[]'; validated jsonb:='[]'; msg text; BEGIN
 IF NOT public.himmah_admin() THEN RAISE EXCEPTION 'الإعداد للإدارة فقط'; END IF;
 PERFORM 1 FROM public.himmah_days WHERE id=_day FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'اليوم غير موجود'; END IF;
 IF jsonb_typeof(coalesce(_plan,'[]')) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'بيانات المشاركين غير صحيحة'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_plan)e GROUP BY e->>'student_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'طالب مكرر ضمن طلب الحفظ'; END IF;
 newh:=coalesce((SELECT array_agg(DISTINCT x) FROM unnest(coalesce(_halaqa_ids,'{}'))x WHERE EXISTS(SELECT 1 FROM public.halaqat WHERE id=x)),'{}');
 SELECT coalesce(array_agg(p.id),'{}') INTO gone FROM public.himmah_participants p WHERE p.day_id=_day AND (NOT p.halaqa_id=ANY(newh) OR p.student_id=ANY(coalesce(_remove,'{}')));
 SELECT coalesce(jsonb_agg(jsonb_build_object('student_id',p.student_id,'message','لا يمكن إزالة الطالب '||p.student_name||' من الحلقة '||p.halaqa_name||': له محاولات محفوظة')),'[]') INTO issues FROM public.himmah_participants p WHERE p.id=ANY(gone) AND EXISTS(SELECT 1 FROM public.himmah_attempts a WHERE a.participant_id=p.id);
 FOR e IN SELECT * FROM jsonb_array_elements(coalesce(_plan,'[]')) LOOP
  BEGIN
   SELECT * INTO s FROM public.students WHERE id=(e->>'student_id')::uuid;
   SELECT * INTO h FROM public.halaqat WHERE id=s.halaqa_id;
   SELECT * INTO previous FROM public.himmah_participants WHERE day_id=_day AND student_id=s.id FOR UPDATE;
   IF s.id IS NULL OR h.id IS NULL OR NOT h.id=ANY(newh) THEN RAISE EXCEPTION 'طالب خارج حلقات اليوم: %',coalesce(s.full_name,e->>'student_id'); END IF;
   IF s.id=ANY(coalesce(_remove,'{}')) THEN RAISE EXCEPTION 'طلب متعارض للطالب: %',s.full_name; END IF;
   hs:=public.himmah_plan_hizbs(s.id,e->'hizbs',coalesce(previous.hizbs,'{}'));
   SELECT string_agg(a.hizb::text,'، ' ORDER BY a.hizb) INTO msg FROM (SELECT DISTINCT hizb FROM public.himmah_attempts WHERE participant_id=previous.id AND NOT hizb=ANY(hs))a;
   IF msg IS NOT NULL THEN RAISE EXCEPTION 'الطالب % — لا يمكن استبعاد الأحزاب %: لها محاولات محفوظة',s.full_name,msg; END IF;
   IF previous.id IS NULL OR hs IS DISTINCT FROM previous.hizbs THEN validated:=validated||jsonb_build_object('student_id',s.id,'hizbs',hs); END IF;
  EXCEPTION WHEN OTHERS THEN issues:=issues||jsonb_build_object('student_id',e->>'student_id','message',SQLERRM); END;
 END LOOP;
 IF jsonb_array_length(issues)>0 THEN RAISE EXCEPTION USING MESSAGE='تعذّر حفظ المقررات؛ لم يُغيَّر شيء',DETAIL=issues::text; END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(validated) LOOP
  SELECT * INTO s FROM public.students WHERE id=(e->>'student_id')::uuid; SELECT * INTO h FROM public.halaqat WHERE id=s.halaqa_id;
  SELECT array_agg(x::integer ORDER BY x::integer) INTO hs FROM jsonb_array_elements_text(e->'hizbs')x;
  INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(_day,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs;
  saved:=saved+1;
 END LOOP;
 DELETE FROM public.himmah_participants WHERE id=ANY(gone); GET DIAGNOSTICS removed=ROW_COUNT;
 UPDATE public.himmah_days SET halaqa_ids=newh WHERE id=_day;
 INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,auth.uid(),'plan',jsonb_build_object('halaqa_ids',newh,'saved',saved,'removed',removed));
 RETURN jsonb_build_object('saved',saved,'removed',removed);
END $$;
REVOKE ALL ON FUNCTION public.himmah_save_plan(uuid,uuid[],jsonb,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.himmah_save_plan(uuid,uuid[],jsonb,uuid[]) TO authenticated;