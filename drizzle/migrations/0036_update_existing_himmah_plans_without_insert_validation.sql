DO $$ DECLARE def text; old_sql text; new_sql text; BEGIN
 def:=pg_get_functiondef('public.himmah_save_plan(uuid,uuid[],jsonb,uuid[])'::regprocedure);
 old_sql:='INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(_day,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''''),hs) ON CONFLICT(day_id,student_id) DO UPDATE SET hizbs=excluded.hizbs;';
 new_sql:=E'UPDATE public.himmah_participants SET hizbs=hs WHERE day_id=_day AND student_id=s.id;\n  IF NOT FOUND THEN INSERT INTO public.himmah_participants(day_id,student_id,halaqa_id,student_name,halaqa_name,teacher_name,hizbs) VALUES(_day,s.id,h.id,s.full_name,h.name,coalesce((SELECT full_name FROM public.profiles WHERE id=h.teacher_id),''''),hs); END IF;';
 IF strpos(def,old_sql)=0 THEN RAISE EXCEPTION 'Plan write branch not found'; END IF;
 EXECUTE replace(def,old_sql,new_sql);
END $$;