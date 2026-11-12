CREATE OR REPLACE FUNCTION public.himmah_public_display(_day uuid,_key uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  d public.himmah_days;
  students jsonb;
  circles jsonb;
  overall jsonb;
BEGIN
  SELECT * INTO d FROM public.himmah_days WHERE id=_day AND display_key=_key;
  IF d.id IS NULL THEN RAISE EXCEPTION 'رابط العرض غير صحيح'; END IF;

  WITH participants AS (
    SELECT p.id,p.halaqa_id,p.student_name,p.halaqa_name,p.present,
      cardinality(p.hizbs) AS total
    FROM public.himmah_participants p
    WHERE p.day_id=_day
  ), latest AS (
    SELECT DISTINCT ON(a.participant_id,a.hizb)
      a.id AS attempt_id,a.participant_id,a.hizb,a.status,a.score
    FROM public.himmah_attempts a
    JOIN participants p ON p.id=a.participant_id
    WHERE a.approved_at IS NOT NULL AND a.status IN ('pass','fail')
    ORDER BY a.participant_id,a.hizb,a.approved_at DESC
  ), per_participant AS (
    SELECT p.id,p.halaqa_id,p.student_name,p.halaqa_name,p.present,p.total,
      count(l.attempt_id) AS presented,
      count(l.attempt_id) FILTER(WHERE l.status='pass') AS passed,
      coalesce(round(avg(l.score),1),0) AS average_score
    FROM participants p
    LEFT JOIN latest l ON l.participant_id=p.id
    GROUP BY p.id,p.halaqa_id,p.student_name,p.halaqa_name,p.present,p.total
  ), per_halaqa AS (
    SELECT p.halaqa_id,p.halaqa_name,
      count(*) AS registered,
      count(*) FILTER(WHERE p.present) AS present,
      sum(p.total) AS total,
      sum(p.presented) AS presented,
      sum(p.passed) AS passed
    FROM per_participant p
    GROUP BY p.halaqa_id,p.halaqa_name
  ), ranked_students AS (
    SELECT p.*,
      round(CASE WHEN p.total>0 THEN p.passed::numeric/p.total*100 ELSE 0 END,1) AS completion,
      rank() OVER(
        ORDER BY
          CASE WHEN d.ranking_mode='completion' THEN CASE WHEN p.total>0 THEN p.passed::numeric/p.total ELSE 0 END END DESC NULLS LAST,
          p.passed DESC,p.average_score DESC
      ) AS rank
    FROM per_participant p
    WHERE p.presented>0
  ), ranked_halaqat AS (
    SELECT h.*,
      round(CASE WHEN h.total>0 THEN h.passed::numeric/h.total*100 ELSE 0 END,1) AS completion,
      rank() OVER(
        ORDER BY CASE WHEN h.total>0 THEN h.passed::numeric/h.total ELSE 0 END DESC,h.passed DESC
      ) AS rank
    FROM per_halaqa h
    WHERE h.presented>0
  ), totals AS (
    SELECT count(*) AS registered,
      count(*) FILTER(WHERE p.present) AS present,
      coalesce(sum(p.total),0) AS total,
      coalesce(sum(p.presented),0) AS presented,
      coalesce(sum(p.passed),0) AS passed
    FROM per_participant p
  )
  SELECT
    (SELECT jsonb_build_object(
      'circles',(SELECT count(*) FROM per_halaqa),
      'registered',t.registered,'present',t.present,'total',t.total,
      'presented',t.presented,'passed',t.passed,
      'failed',t.presented-t.passed,
      'remaining_recitation',t.total-t.presented,
      'remaining_pass',t.total-t.passed
    ) FROM totals t),
    coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (
      SELECT student_name,halaqa_name,total,presented,passed,average_score,completion,rank
      FROM ranked_students ORDER BY rank,student_name LIMIT 50
    ) s),'[]'::jsonb),
    coalesce((SELECT jsonb_agg(to_jsonb(h)) FROM (
      SELECT halaqa_name,registered,present,total,presented,passed,completion,rank
      FROM ranked_halaqat ORDER BY rank,halaqa_name LIMIT 20
    ) h),'[]'::jsonb)
  INTO overall,students,circles;

  RETURN jsonb_build_object(
    'day',jsonb_build_object('id',d.id,'title',d.title,'day_date',d.day_date,'ranking_mode',d.ranking_mode),
    'stats',overall,'best_student',students->0,'best_halaqa',circles->0,
    'top_students',students,'top_halaqat',circles,'server_now',clock_timestamp()
  );
END $$;