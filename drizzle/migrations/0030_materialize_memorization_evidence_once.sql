CREATE INDEX IF NOT EXISTS madarij_daily_progress_student_mem_idx ON public.madarij_daily_progress(student_id);
CREATE OR REPLACE FUNCTION public.student_memorization_data(_student_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; s public.students; h integer; hs integer[]:=public.mem_hizb_starts(); completed integer[]; partial integer[]; sources jsonb; last timestamptz; needs boolean; result jsonb:='[]'; plan jsonb; evidence jsonb; merged jsonb; seg record; cs integer; ce integer;
BEGIN
 FOREACH sid IN ARRAY coalesce(_student_ids,'{}') LOOP
  SELECT * INTO s FROM public.students WHERE id=sid;
  IF s.id IS NULL OR NOT public.himmah_view_halaqa(s.halaqa_id) THEN RAISE EXCEPTION 'غير مصرح بعرض بيانات المحفوظ'; END IF;
  -- Parse evidence exactly once per student; all subsequent calculations use this local snapshot.
  SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb),coalesce(jsonb_agg(DISTINCT m.source_label),'[]'::jsonb),max(m.recorded_at) INTO evidence,sources,last FROM public.mem_segments(sid)m;
  completed:='{}'; partial:='{}'; merged:='[]'; cs:=NULL; ce:=NULL;
  FOR seg IN SELECT (x->>'start_ayah')::integer a,(x->>'end_ayah')::integer b FROM jsonb_array_elements(evidence)x ORDER BY a,b LOOP
   IF cs IS NULL THEN cs:=seg.a; ce:=seg.b;
   ELSIF seg.a<=ce+1 THEN ce:=greatest(ce,seg.b);
   ELSE merged:=merged||jsonb_build_array(jsonb_build_array(cs,ce)); cs:=seg.a; ce:=seg.b;
   END IF;
  END LOOP;
  IF cs IS NOT NULL THEN merged:=merged||jsonb_build_array(jsonb_build_array(cs,ce)); END IF;
  FOR h IN 1..60 LOOP
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(merged)r WHERE (r->>0)::integer<=hs[h] AND (r->>1)::integer>=hs[h+1]-1) THEN completed:=array_append(completed,h);
   ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(merged)r WHERE (r->>0)::integer<=hs[h+1]-1 AND (r->>1)::integer>=hs[h]) THEN partial:=array_append(partial,h);
   END IF;
  END LOOP;
  SELECT jsonb_build_object('id',p.id,'academic_year',p.academic_year,'term',p.term,'start_date',p.start_date,'end_date',p.end_date,'daily_memorization_pages',p.daily_memorization_pages) INTO plan FROM public.student_annual_plans p WHERE p.student_id=sid AND p.status='active' ORDER BY p.created_at DESC LIMIT 1;
  needs:=(completed='{}' AND partial='{}' AND (coalesce(s.total_memorized_pages,0)>0 OR length(trim(coalesce(s.memorization_amount,'')))>0)) OR (EXISTS(SELECT 1 FROM public.student_annual_plans p WHERE p.student_id=sid AND coalesce(p.previous_memorized_pages,0)>0) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(evidence)m WHERE m->>'source' IN('annual_plan','manual')));
  result:=result||jsonb_build_array(jsonb_build_object('student_id',sid,'student_name',s.full_name,'halaqa_id',s.halaqa_id,'completed',completed,'partial',partial,'sources',sources,'last_updated',last,'needs_completion',needs,'plan',plan,'manual_ranges',(SELECT coalesce(jsonb_agg(jsonb_build_object('from_label',r.from_label,'to_label',r.to_label,'start_ayah',r.start_ayah,'end_ayah',r.end_ayah) ORDER BY r.created_at,r.id),'[]'::jsonb) FROM public.student_memorization_ranges r WHERE r.student_id=sid AND r.active)));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.student_memorization_data(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.student_memorization_data(uuid[]) TO authenticated;