-- 017_recalc_mission_consumed.sql
-- 퓨릿 필터 승인/반려 시 missions.credits_consumed 실시간 재계산 RPC

CREATE OR REPLACE FUNCTION recalc_mission_consumed(p_mission_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission_type   TEXT;
  v_mission_factor NUMERIC;
  v_total          INTEGER := 0;
  v_per_credits    INTEGER;
  v_exp            TEXT;
  v_multiplier     NUMERIC;
  v_year_text      TEXT;
  v_years          INTEGER;
  v_panel          RECORD;
BEGIN
  IF (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT type INTO v_mission_type FROM missions WHERE id = p_mission_id;

  v_mission_factor := CASE
    WHEN v_mission_type IS NULL OR v_mission_type = 'landing_page' THEN 1.5
    ELSE 1.0
  END;

  FOR v_panel IN
    SELECT p.experience
    FROM feedbacks f
    JOIN panels p ON p.id = f.panel_id
    WHERE f.mission_id = p_mission_id
      AND f.purity_passed = true
  LOOP
    v_exp := lower(coalesce(v_panel.experience, ''));

    IF v_exp ~ '(c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN
      v_multiplier := 3.0;
    ELSIF v_exp ~ '시니어' THEN
      v_multiplier := 2.0;
    ELSIF v_exp ~ '\d' THEN
      v_year_text := (regexp_match(v_exp, '(\d+)'))[1];
      IF v_year_text IS NOT NULL THEN
        v_years := v_year_text::INTEGER;
        IF v_years >= 8 THEN
          v_multiplier := 2.0;
        ELSIF v_years >= 4 THEN
          v_multiplier := 1.5;
        ELSE
          v_multiplier := 1.0;
        END IF;
      ELSE
        v_multiplier := 1.0;
      END IF;
    ELSIF v_exp ~ '미들' THEN
      v_multiplier := 1.5;
    ELSE
      v_multiplier := 1.0;
    END IF;

    v_per_credits := CEIL(v_multiplier * v_mission_factor)::INTEGER;
    v_total       := v_total + v_per_credits;
  END LOOP;

  UPDATE missions SET credits_consumed = v_total WHERE id = p_mission_id;

  RETURN v_total;
END;
$$;
