DO $$ DECLARE def text; start_at integer; end_at integer; BEGIN
 def:=pg_get_functiondef('public.himmah_manage(text,uuid,jsonb)'::regprocedure);
 start_at:=strpos(def,'  ELSIF _action=''participant'' THEN');
 end_at:=strpos(def,'  ELSIF _action=''remove_participant'' THEN');
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'Participant branch not found'; END IF;
 def:=substring(def from 1 for start_at-1)||E'  ELSIF _action=''participant'' THEN\n    PERFORM public.himmah_save_plan(did,(SELECT halaqa_ids FROM public.himmah_days WHERE id=did),jsonb_build_array(_data),''{}''::uuid[]);\n'||substring(def from end_at);
 EXECUTE def;
END $$;