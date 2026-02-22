
-- Function: check narration achievements after each attempt
CREATE OR REPLACE FUNCTION public.check_narration_achievements()
RETURNS TRIGGER AS $$
DECLARE
  v_total_hizb NUMERIC;
  v_consecutive INTEGER := 0;
  v_avg_grade NUMERIC;
  v_attempt_count INTEGER;
  v_rec RECORD;
  v_session_creator UUID;
BEGIN
  -- 1) Total passed hizb
  SELECT COALESCE(SUM(total_hizb_count), 0) INTO v_total_hizb
  FROM narration_attempts WHERE student_id = NEW.student_id AND status = 'passed';

  -- Award hizb milestone badges
  IF v_total_hizb >= 10 THEN
    INSERT INTO student_badges (student_id, badge_id, source_detail)
    SELECT NEW.student_id, b.id, 'مجموع: ' || v_total_hizb || ' حزب'
    FROM badges b WHERE b.criteria_type = 'hizb_10' AND b.category = 'narration'
    ON CONFLICT (student_id, badge_id) DO NOTHING;
  END IF;

  IF v_total_hizb >= 20 THEN
    INSERT INTO student_badges (student_id, badge_id, source_detail)
    SELECT NEW.student_id, b.id, 'مجموع: ' || v_total_hizb || ' حزباً'
    FROM badges b WHERE b.criteria_type = 'hizb_20' AND b.category = 'narration'
    ON CONFLICT (student_id, badge_id) DO NOTHING;
  END IF;

  IF v_total_hizb >= 30 THEN
    INSERT INTO student_badges (student_id, badge_id, source_detail)
    SELECT NEW.student_id, b.id, 'مجموع: ' || v_total_hizb || ' حزباً'
    FROM badges b WHERE b.criteria_type = 'hizb_30' AND b.category = 'narration'
    ON CONFLICT (student_id, badge_id) DO NOTHING;
  END IF;

  IF v_total_hizb >= 50 THEN
    INSERT INTO student_badges (student_id, badge_id, source_detail)
    SELECT NEW.student_id, b.id, 'مجموع: ' || v_total_hizb || ' حزباً'
    FROM badges b WHERE b.criteria_type = 'hizb_50' AND b.category = 'narration'
    ON CONFLICT (student_id, badge_id) DO NOTHING;
  END IF;

  -- 2) Consecutive passes (from most recent backwards)
  FOR v_rec IN
    SELECT status FROM narration_attempts
    WHERE student_id = NEW.student_id
    ORDER BY created_at DESC
  LOOP
    IF v_rec.status = 'passed' THEN
      v_consecutive := v_consecutive + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  IF v_consecutive >= 3 THEN
    INSERT INTO student_badges (student_id, badge_id, source_detail)
    SELECT NEW.student_id, b.id, v_consecutive || ' جلسات متتالية'
    FROM badges b WHERE b.criteria_type = 'consecutive_3' AND b.category = 'narration'
    ON CONFLICT (student_id, badge_id) DO NOTHING;
  END IF;

  IF v_consecutive >= 5 THEN
    INSERT INTO student_badges (student_id, badge_id, source_detail)
    SELECT NEW.student_id, b.id, v_consecutive || ' جلسات متتالية'
    FROM badges b WHERE b.criteria_type = 'consecutive_5' AND b.category = 'narration'
    ON CONFLICT (student_id, badge_id) DO NOTHING;
  END IF;

  -- 3) Average grade >= 90 (min 5 attempts)
  SELECT COUNT(*), AVG(grade) INTO v_attempt_count, v_avg_grade
  FROM narration_attempts WHERE student_id = NEW.student_id;

  IF v_attempt_count >= 5 AND v_avg_grade >= 90 THEN
    INSERT INTO student_badges (student_id, badge_id, source_detail)
    SELECT NEW.student_id, b.id, 'متوسط: ' || ROUND(v_avg_grade, 1)
    FROM badges b WHERE b.criteria_type = 'avg_grade_90' AND b.category = 'narration'
    ON CONFLICT (student_id, badge_id) DO NOTHING;
  END IF;

  -- 4) Auto-nominate for narration reward if grade >= 95
  IF NEW.status = 'passed' AND NEW.grade >= 95 THEN
    SELECT created_by INTO v_session_creator
    FROM narration_sessions WHERE id = NEW.session_id;

    IF v_session_creator IS NOT NULL THEN
      INSERT INTO reward_nominations (student_id, reward_id, nominated_by, status, note)
      SELECT NEW.student_id, r.id, v_session_creator, 'pending',
             'ترشيح تلقائي - درجة سرد: ' || NEW.grade
      FROM rewards r WHERE r.reward_type = 'narration' AND r.active = true
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on narration_attempts
DROP TRIGGER IF EXISTS trg_check_narration_achievements ON public.narration_attempts;
CREATE TRIGGER trg_check_narration_achievements
  AFTER INSERT OR UPDATE ON public.narration_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_narration_achievements();
