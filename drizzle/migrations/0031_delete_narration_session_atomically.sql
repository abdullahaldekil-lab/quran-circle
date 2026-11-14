CREATE OR REPLACE FUNCTION public.delete_narration_session(_session_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.narration_sessions; d uuid; day_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR public.himmah_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'حذف جلسات السرد متاح للمدير فقط' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM public.narration_sessions WHERE id=_session_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'الجلسة غير موجودة أو سبق حذفها' USING ERRCODE='P0002'; END IF;
  FOR d IN SELECT id FROM public.himmah_days WHERE session_id=_session_id ORDER BY id FOR UPDATE LOOP END LOOP;
  SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO day_ids FROM public.himmah_days WHERE session_id=_session_id;
  INSERT INTO public.admin_audit_log(actor_user_id,action_type,details)
  VALUES(auth.uid(),'delete_narration_session',jsonb_build_object('session_id',s.id,'title',s.title,'session_date',s.session_date,'day_ids',day_ids,'attempt_count',(SELECT count(*) FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id WHERE p.day_id=ANY(day_ids)))::text);
  DELETE FROM public.himmah_audit WHERE day_id=ANY(day_ids);
  DELETE FROM public.himmah_reopenings WHERE day_id=ANY(day_ids);
  DELETE FROM public.himmah_assignments WHERE day_id=ANY(day_ids);
  DELETE FROM public.himmah_attempts WHERE participant_id IN (SELECT id FROM public.himmah_participants WHERE day_id=ANY(day_ids));
  DELETE FROM public.himmah_participants WHERE day_id=ANY(day_ids);
  DELETE FROM public.himmah_reviewers WHERE day_id=ANY(day_ids);
  DELETE FROM public.himmah_days WHERE session_id=_session_id;
  DELETE FROM public.narration_sessions WHERE id=_session_id;
  RETURN _session_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_narration_session(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_narration_session(uuid) TO authenticated;