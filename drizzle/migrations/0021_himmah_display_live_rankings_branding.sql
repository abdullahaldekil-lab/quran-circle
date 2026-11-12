CREATE OR REPLACE FUNCTION public.himmah_public_display(_day uuid,_key uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.himmah_days; students jsonb; circles jsonb; overall jsonb; BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day AND display_key=_key;
  IF d.id IS NULL THEN RAISE EXCEPTION 'رابط العرض غير صحيح'; END IF;
  WITH latest AS(
    SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status,a.score
    FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id
    WHERE p.day_id=_day AND a.approved_at IS NOT NULL AND a.status IN ('pass','fail')
    ORDER BY a.participant_id,a.hizb,a.approved_at DESC
  ), per AS(
    SELECT p.student_name,p.halaqa_name,cardinality(p.hizbs) AS total,count(l.attempt_id) AS presented,
      count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed,coalesce(round(avg(l.score),1),0) AS average_score
    FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id
    WHERE p.day_id=_day GROUP BY p.id,p.student_name,p.halaqa_name,p.hizbs
  ), ranked AS(
    SELECT per.*,round(CASE WHEN total>0 THEN passed::numeric/total*100 ELSE 0 END,1) AS completion,
      rank() OVER(ORDER BY CASE WHEN d.ranking_mode='completion' THEN CASE WHEN total>0 THEN passed::numeric/total ELSE 0 END END DESC NULLS LAST,passed DESC,average_score DESC) AS rank
    FROM per WHERE presented>0
  ) SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') INTO students FROM(
    SELECT student_name,halaqa_name,total,presented,passed,average_score,completion,rank FROM ranked
    ORDER BY rank,student_name LIMIT 50
  )s;
  WITH latest AS(
    SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status
    FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id
    WHERE p.day_id=_day AND a.approved_at IS NOT NULL AND a.status IN ('pass','fail')
    ORDER BY a.participant_id,a.hizb,a.approved_at DESC
  ), per AS(
    SELECT p.halaqa_name,count(p.id) AS registered,count(p.id) FILTER(WHERE p.present) AS present,
      coalesce(sum(cardinality(p.hizbs)),0) AS total,count(l.attempt_id) AS presented,count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed
    FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id
    WHERE p.day_id=_day GROUP BY p.halaqa_id,p.halaqa_name
  ), ranked AS(
    SELECT per.*,round(CASE WHEN total>0 THEN passed::numeric/total*100 ELSE 0 END,1) AS completion,
      rank() OVER(ORDER BY CASE WHEN total>0 THEN passed::numeric/total ELSE 0 END DESC,passed DESC) AS rank
    FROM per WHERE presented>0
  ) SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO circles FROM(
    SELECT halaqa_name,registered,present,total,presented,passed,completion,rank FROM ranked ORDER BY rank,halaqa_name LIMIT 20
  )c;
  WITH latest AS(
    SELECT DISTINCT ON(a.participant_id,a.hizb) a.id AS attempt_id,a.participant_id,a.hizb,a.status
    FROM public.himmah_attempts a JOIN public.himmah_participants p ON p.id=a.participant_id
    WHERE p.day_id=_day AND a.approved_at IS NOT NULL AND a.status IN ('pass','fail')
    ORDER BY a.participant_id,a.hizb,a.approved_at DESC
  ), totals AS(
    SELECT count(p.id) AS registered,count(p.id) FILTER(WHERE p.present) AS present,
      coalesce(sum(cardinality(p.hizbs)),0) AS total,count(l.attempt_id) AS presented,count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed
    FROM public.himmah_participants p LEFT JOIN latest l ON l.participant_id=p.id WHERE p.day_id=_day
  ) SELECT jsonb_build_object(
    'circles',(SELECT count(DISTINCT halaqa_id) FROM public.himmah_participants WHERE day_id=_day),
    'registered',registered,'present',present,'total',total,'presented',presented,'passed',passed,
    'failed',presented-passed,'remaining_recitation',total-presented,'remaining_pass',total-passed
  ) INTO overall FROM totals;
  RETURN jsonb_build_object(
    'day',jsonb_build_object('id',d.id,'title',d.title,'day_date',d.day_date,'ranking_mode',d.ranking_mode),
    'stats',overall,'best_student',students->0,'best_halaqa',circles->0,
    'top_students',students,'top_halaqat',circles,'server_now',clock_timestamp()
  );
END $$;
REVOKE ALL ON FUNCTION public.himmah_public_display(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.himmah_public_display(uuid,uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.himmah_public_branding(_day uuid,_key uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; BEGIN
  SELECT jsonb_build_object('logo_url',coalesce(logo_url,'')) INTO result FROM public.himmah_days WHERE id=_day AND display_key=_key;
  IF result IS NULL THEN RAISE EXCEPTION 'رابط العرض غير صحيح'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.himmah_public_branding(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.himmah_public_branding(uuid,uuid) TO anon,authenticated;