CREATE OR REPLACE FUNCTION public.mem_ayah(_raw text) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE t text:=public.mem_norm(_raw);m text[];n text;a integer;i integer;names text[]:=ARRAY['الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','ابراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبإ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الانسان','المرسلات','النبإ','النازعات','عبس','التكوير','الإنفطار','المطففين','الإنشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس']::text[];base integer;BEGIN
 IF t='' OR t~'صفح[ةه]' THEN RETURN NULL;END IF;m:=regexp_match(t,'^(\d{1,3})\s*[:،/]\s*(\d{1,3})$');
 IF m IS NOT NULL THEN n:=m[1];a:=m[2]::integer;ELSE m:=regexp_match(t,'(\d+)\s*$');IF m IS NULL THEN RETURN NULL;END IF;a:=m[1]::integer;n:=trim(substr(t,1,length(t)-length(m[1])));END IF;
 n:=regexp_replace(n,'^سور[ةه]\s+','');IF n~'^\d+$' THEN i:=n::integer;ELSE SELECT k INTO i FROM unnest(names) WITH ORDINALITY x(name,k) WHERE public.mem_norm(name)=n OR regexp_replace(public.mem_norm(name),'^ال','')=regexp_replace(n,'^ال','') LIMIT 1;END IF;
 IF i NOT BETWEEN 1 AND 114 THEN RETURN NULL;END IF;base:=(public.mem_surah_starts())[i];IF a<1 OR base+a>(public.mem_surah_starts())[i+1] THEN RETURN NULL;END IF;RETURN base+a-1;END $$;

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
    IF EXISTS(SELECT 1 FROM unnest(hs)x WHERE NOT x=ANY(public.mem_completed(s.id))) THEN RAISE EXCEPTION 'لا يمكن إضافة حزب غير مثبت الحفظ للطالب: %',s.full_name; END IF;
    IF EXISTS(SELECT 1 FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=_day AND p.student_id=s.id AND a.status<>'cancelled' AND NOT a.hizb=ANY(hs)) THEN RAISE EXCEPTION 'لا يمكن إزالة حزب له محاولات مسجلة: %',s.full_name; END IF;
    INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(_day,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs;
    saved:=saved+1;
  END LOOP;
  DELETE FROM public.himmah_participants WHERE id=ANY(gone); GET DIAGNOSTICS removed=ROW_COUNT;
  UPDATE public.himmah_days SET halaqa_ids=newh WHERE id=_day;
  INSERT INTO public.himmah_audit(day_id,actor_id,action,new_value) VALUES(_day,auth.uid(),'plan',jsonb_build_object('halaqa_ids',to_jsonb(newh),'saved',saved,'removed',removed));
  RETURN jsonb_build_object('saved',saved,'removed',removed); END $$;