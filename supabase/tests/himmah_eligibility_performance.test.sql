BEGIN;
DO $$
DECLARE
  day_id uuid := '05e5a457-b38e-4a10-a20c-aa5ceaab27b2';
  circle_id uuid := '9f316b7b-5f57-4aed-9bcf-74a442b142b1';
  actor uuid;
  started timestamptz;
  rows jsonb;
  row jsonb;
  expected integer[];
  actual integer[];
  expected_partial integer[];
  boundaries integer[] := public.mem_hizb_starts();
BEGIN
  SELECT id INTO actor FROM public.profiles WHERE active AND role='manager' LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'test requires a manager'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  started:=clock_timestamp();
  rows:=public.himmah_eligible_students(day_id,ARRAY[circle_id]);
  IF jsonb_array_length(rows) IS DISTINCT FROM (SELECT count(*)::integer FROM public.students WHERE halaqa_id=circle_id AND status='active') THEN
    RAISE EXCEPTION 'circle summary omitted students';
  END IF;
  IF clock_timestamp()-started >= interval '5 seconds' THEN RAISE EXCEPTION 'eligibility exceeds five-second budget'; END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(rows) LOOP
    expected:=public.mem_completed((row->>'student_id')::uuid);
    SELECT coalesce(array_agg(value::integer ORDER BY value::integer),'{}') INTO actual FROM jsonb_array_elements_text(row->'completed');
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'complete hizbs changed during optimization'; END IF;
    SELECT coalesce(array_agg(h ORDER BY h),'{}') INTO expected_partial FROM generate_series(1,60)h
      WHERE NOT h=ANY(expected) AND EXISTS(SELECT 1 FROM public.mem_segments((row->>'student_id')::uuid)m WHERE m.start_ayah<=boundaries[h+1]-1 AND m.end_ayah>=boundaries[h]);
    SELECT coalesce(array_agg(value::integer ORDER BY value::integer),'{}') INTO actual FROM jsonb_array_elements_text(row->'partial');
    IF actual IS DISTINCT FROM expected_partial THEN RAISE EXCEPTION 'partial hizbs changed during optimization'; END IF;
  END LOOP;
END $$;
ROLLBACK;