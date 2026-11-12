-- Generated from src/lib/quran-index.ts PAGE_STARTS + SURAH_AYAHS: 604 pages, 605 delimiters.
CREATE OR REPLACE FUNCTION public.mem_page_starts() RETURNS integer[] LANGUAGE sql IMMUTABLE AS $$ SELECT ARRAY[1,8,13,24,32,37,45,56,65,69,77,84,91,96,101,109,113,120,127,134,142,149,153,161,171,177,184,189,194,198,204,210,218,223,227,232,238,241,245,253,256,260,264,267,272,277,282,289,290,294,303,309,316,323,331,339,346,355,364,371,377,385,394,402,409,415,426,434,442,447,451,459,467,474,480,488,494,500,505,508,513,517,520,527,531,538,545,553,559,568,573,580,585,588,595,599,607,615,621,628,634,641,648,656,664,669,672,675,679,683,687,693,701,706,711,715,720,727,734,740,746,752,759,765,773,778,783,790,798,808,817,825,834,842,849,858,863,871,880,884,891,900,908,914,921,927,932,936,941,947,955,966,977,985,992,998,1006,1012,1022,1028,1036,1042,1050,1059,1075,1085,1092,1098,1104,1110,1114,1118,1125,1133,1142,1150,1161,1169,1177,1186,1194,1201,1206,1213,1222,1230,1236,1242,1249,1256,1262,1267,1272,1276,1283,1290,1297,1304,1308,1315,1322,1329,1335,1342,1347,1353,1358,1365,1371,1379,1385,1390,1398,1407,1418,1426,1435,1443,1453,1462,1471,1479,1486,1493,1502,1511,1519,1527,1536,1545,1555,1562,1571,1582,1591,1601,1611,1619,1627,1634,1640,1649,1660,1666,1675,1683,1692,1700,1708,1713,1721,1726,1736,1742,1750,1756,1761,1769,1775,1784,1793,1803,1818,1834,1854,1873,1893,1908,1916,1928,1936,1944,1956,1966,1974,1981,1989,1995,2004,2012,2020,2030,2037,2047,2057,2068,2079,2088,2096,2105,2116,2126,2134,2145,2156,2161,2168,2175,2186,2194,2202,2215,2224,2238,2251,2262,2276,2289,2302,2315,2327,2346,2361,2386,2400,2413,2425,2436,2447,2462,2474,2484,2494,2508,2519,2528,2541,2556,2565,2574,2585,2596,2601,2611,2619,2626,2634,2642,2651,2660,2668,2674,2691,2701,2716,2733,2748,2763,2778,2792,2802,2812,2819,2823,2828,2835,2845,2850,2853,2858,2867,2876,2888,2899,2911,2923,2933,2952,2972,2993,3016,3044,3069,3092,3116,3139,3160,3173,3182,3195,3204,3215,3223,3236,3248,3258,3266,3274,3281,3288,3296,3303,3312,3323,3330,3337,3347,3355,3364,3371,3379,3386,3393,3404,3415,3425,3434,3442,3451,3460,3470,3481,3489,3498,3504,3515,3524,3534,3540,3549,3556,3564,3569,3577,3584,3588,3596,3607,3614,3621,3629,3638,3646,3655,3664,3672,3679,3691,3699,3705,3718,3733,3746,3760,3776,3789,3813,3840,3865,3891,3915,3942,3971,3987,3997,4013,4032,4054,4064,4069,4080,4090,4099,4106,4115,4126,4133,4141,4150,4159,4167,4174,4183,4192,4200,4211,4219,4230,4239,4248,4257,4265,4273,4283,4288,4295,4304,4317,4324,4336,4348,4359,4373,4386,4399,4415,4433,4454,4474,4487,4496,4506,4516,4525,4531,4539,4546,4557,4565,4575,4584,4593,4599,4607,4612,4617,4624,4631,4646,4666,4682,4706,4727,4750,4767,4785,4811,4829,4853,4874,4896,4918,4942,4969,4996,5030,5056,5079,5087,5094,5100,5105,5111,5116,5126,5130,5136,5143,5151,5156,5162,5169,5178,5186,5193,5200,5209,5218,5223,5230,5237,5242,5254,5268,5287,5314,5332,5358,5386,5415,5430,5448,5461,5476,5495,5513,5543,5571,5597,5617,5642,5673,5703,5728,5759,5801,5830,5855,5883,5910,5932,5964,5994,6017,6044,6073,6099,6126,6138,6156,6177,6194,6208,6222,6237]::integer[] $$;

CREATE OR REPLACE FUNCTION public.himmah_validated_hizbs(_student uuid,_hizbs jsonb) RETURNS integer[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE student_name text; completed integer[]; result integer[]:='{}'; v text; n integer; BEGIN
 SELECT full_name INTO student_name FROM public.students WHERE id=_student AND status='active';
 IF student_name IS NULL THEN RAISE EXCEPTION 'الطالب غير موجود أو غير نشط'; END IF;
 IF jsonb_typeof(coalesce(_hizbs,'null'::jsonb)) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'نطاق أحزاب غير صحيح: %',student_name; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements_text(_hizbs) LOOP
  IF v !~ '^(?:[1-9]|[1-5][0-9]|60)$' THEN RAISE EXCEPTION 'نطاق أحزاب غير صحيح: %',student_name; END IF;
  n:=v::integer; IF NOT n=ANY(result) THEN result:=array_append(result,n); END IF;
 END LOOP;
 IF cardinality(result)<1 THEN RAISE EXCEPTION 'اختر حزبًا واحدًا على الأقل للطالب: %',student_name; END IF;
 completed:=public.mem_completed(_student);
 IF EXISTS(SELECT 1 FROM unnest(result)x WHERE NOT x=ANY(completed)) THEN RAISE EXCEPTION 'لا يمكن إضافة حزب غير مثبت الحفظ للطالب: %',student_name; END IF;
 RETURN coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(result)x),'{}'::integer[]); END $$;
REVOKE ALL ON FUNCTION public.himmah_validated_hizbs(uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.himmah_participant_eligibility_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN NEW.hizbs:=public.himmah_validated_hizbs(NEW.student_id,to_jsonb(NEW.hizbs)); RETURN NEW; END $$;
CREATE TRIGGER himmah_participant_verified_memorization BEFORE INSERT OR UPDATE OF student_id,hizbs ON public.himmah_participants FOR EACH ROW EXECUTE FUNCTION public.himmah_participant_eligibility_guard();

CREATE OR REPLACE FUNCTION public.student_memorization_data(_student_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;s public.students;h integer;hs integer[]:=public.mem_hizb_starts();completed integer[];partial integer[];sources jsonb;last timestamptz;needs boolean;result jsonb:='[]';plan jsonb;BEGIN
 FOREACH sid IN ARRAY coalesce(_student_ids,'{}') LOOP SELECT * INTO s FROM public.students WHERE id=sid;IF s.id IS NULL OR NOT public.himmah_view_halaqa(s.halaqa_id) THEN RAISE EXCEPTION 'غير مصرح بعرض بيانات المحفوظ';END IF;completed:=public.mem_completed(sid);partial:='{}';
  FOR h IN 1..60 LOOP IF NOT h=ANY(completed) AND EXISTS(SELECT 1 FROM public.mem_segments(sid)m WHERE m.start_ayah<=hs[h+1]-1 AND m.end_ayah>=hs[h]) THEN partial:=array_append(partial,h);END IF;END LOOP;
  SELECT coalesce(jsonb_agg(DISTINCT source_label),'[]'),max(recorded_at) INTO sources,last FROM public.mem_segments(sid);
  SELECT jsonb_build_object('id',p.id,'academic_year',p.academic_year,'term',p.term,'start_date',p.start_date,'end_date',p.end_date,'daily_memorization_pages',p.daily_memorization_pages) INTO plan FROM public.student_annual_plans p WHERE p.student_id=sid AND p.status='active' ORDER BY p.created_at DESC LIMIT 1;
  needs:=(completed='{}' AND partial='{}' AND (coalesce(s.total_memorized_pages,0)>0 OR length(trim(coalesce(s.memorization_amount,'')))>0)) OR (EXISTS(SELECT 1 FROM public.student_annual_plans p WHERE p.student_id=sid AND coalesce(p.previous_memorized_pages,0)>0) AND NOT EXISTS(SELECT 1 FROM public.mem_segments(sid)m WHERE m.source IN('annual_plan','manual')));
  result:=result||jsonb_build_object('student_id',sid,'student_name',s.full_name,'halaqa_id',s.halaqa_id,'completed',completed,'partial',partial,'sources',sources,'last_updated',last,'needs_completion',needs,'plan',plan,'manual_ranges',(SELECT coalesce(jsonb_agg(jsonb_build_object('from_label',r.from_label,'to_label',r.to_label,'start_ayah',r.start_ayah,'end_ayah',r.end_ayah) ORDER BY r.created_at,r.id),'[]'::jsonb) FROM public.student_memorization_ranges r WHERE r.student_id=sid AND r.active));END LOOP;RETURN result;END $$;

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
    hs:=public.himmah_validated_hizbs(s.id,e->'hizbs');
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
    IF s.id IS NULL OR h.id IS NULL THEN RAISE EXCEPTION 'اختر طالبًا مرتبطًا بحلقة'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.himmah_days d WHERE d.id=did AND h.id=ANY(d.halaqa_ids)) THEN RAISE EXCEPTION 'حلقة الطالب غير مضافة إلى هذا اليوم: %',h.name; END IF;
    hs:=public.himmah_validated_hizbs(s.id,_data->'hizbs');
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