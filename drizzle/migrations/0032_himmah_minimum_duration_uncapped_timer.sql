ALTER TABLE public.himmah_days ADD COLUMN minimum_duration_seconds integer NOT NULL DEFAULT 540 CHECK (minimum_duration_seconds >= 540);
UPDATE public.himmah_days SET minimum_duration_seconds=greatest(540,time_limit_seconds);
COMMENT ON COLUMN public.himmah_days.time_limit_seconds IS 'DEPRECATED: replaced by minimum_duration_seconds; recitation has no maximum duration.';
ALTER TABLE public.himmah_attempts DROP CONSTRAINT himmah_attempts_duration_max_chk;
ALTER TABLE public.himmah_attempts ADD CONSTRAINT himmah_attempts_duration_nonnegative_chk CHECK (duration_seconds IS NULL OR duration_seconds >= 0) NOT VALID;
CREATE OR REPLACE FUNCTION public.himmah_elapsed(_a public.himmah_attempts,_limit integer,_pause_limit integer) RETURNS integer LANGUAGE sql STABLE SET search_path=public AS $$ SELECT coalesce(_a.duration_seconds,greatest(0,floor(extract(epoch FROM clock_timestamp()-_a.started_at))::integer-coalesce(_a.paused_seconds,0)-public.himmah_pause_credit(_a,_pause_limit))) $$;
DO $migration$
DECLARE fn text; def text; old text;
BEGIN
FOREACH fn IN ARRAY ARRAY['himmah_attempt','himmah_attempt_v2'] LOOP
 SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=fn;
 IF def IS NULL THEN RAISE EXCEPTION 'Missing function %',fn; END IF;
 def:=regexp_replace(def,'IF a.id IS NOT NULL AND a.status=''running'' AND public.himmah_elapsed\(a,d.time_limit_seconds,d.pause_limit_seconds\)>=d.time_limit_seconds THEN UPDATE public.himmah_attempts SET duration_seconds=d.time_limit_seconds,[^;]+; END IF;','','g');
 IF position('duration_seconds=d.time_limit_seconds' in def)>0 THEN RAISE EXCEPTION 'Auto-stop not removed %',fn; END IF;
 def:=replace(def,'d.time_limit_seconds','d.minimum_duration_seconds');
 old:=CASE WHEN fn='himmah_attempt_v2' THEN 'el:=public.himmah_elapsed(a,d.minimum_duration_seconds,d.pause_limit_seconds);' ELSE 'el := public.himmah_elapsed(a,d.minimum_duration_seconds,d.pause_limit_seconds);' END;
 IF position(old in def)=0 THEN RAISE EXCEPTION 'Missing elapsed statement %',fn; END IF;
 def:=replace(def,old,old||E'\n IF _action=''end'' AND el<d.minimum_duration_seconds THEN RAISE EXCEPTION ''لا يمكن إنهاء الحزب قبل الحد الأدنى: % ثانية'',d.minimum_duration_seconds; END IF;');
 def:=replace(def,'cfg := jsonb_build_object(',E'IF coalesce(a.duration_seconds,0)<d.minimum_duration_seconds THEN RAISE EXCEPTION ''مدة الحزب أقل من الحد الأدنى''; END IF;\n cfg := jsonb_build_object(');
 def:=replace(def,'cfg:=jsonb_build_object(',E'IF coalesce(a.duration_seconds,0)<d.minimum_duration_seconds THEN RAISE EXCEPTION ''مدة الحزب أقل من الحد الأدنى''; END IF;\n cfg:=jsonb_build_object(');
 def:=replace(def,'''time_limit_seconds'',d.minimum_duration_seconds','''minimum_duration_seconds'',d.minimum_duration_seconds,''timing_rule'',''minimum''');
 EXECUTE def;
END LOOP;
FOREACH fn IN ARRAY ARRAY['himmah_correct','himmah_correct_v2'] LOOP
 SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=fn;
 IF position('least(a.duration_seconds,540)' in def)=0 THEN RAISE EXCEPTION 'Missing correction duration %',fn; END IF;
 def:=replace(def,'least(a.duration_seconds,540)','a.duration_seconds');
 EXECUTE def;
END LOOP;
SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='himmah_manage';
def:=replace(def,'time_limit_seconds','minimum_duration_seconds');
def:=replace(def,'IF tl NOT BETWEEN 1 AND 540 THEN RAISE EXCEPTION ''مدة الحزب لا تتجاوز 540 ثانية''; END IF;','IF tl IS NULL OR tl < 540 THEN RAISE EXCEPTION ''الحد الأدنى للحزب لا يقل عن 540 ثانية (9 دقائق)''; END IF;');
IF position('NOT BETWEEN 1 AND 540' in def)>0 THEN RAISE EXCEPTION 'Old settings limit remains'; END IF;
EXECUTE def;
END $migration$;