-- 020_honor_points_security.sql
-- Honor points RPC 호출자 검증 강화
-- 패널이 타인의 panel_id로 포인트를 직접 조작하는 악용 차단

-- ── RPC 재정의: add_panel_honor_points (호출자 검증 추가) ──────────────────────
-- 허용: 어드민(role=admin) 또는 자신의 panel_id만 호출 가능
CREATE OR REPLACE FUNCTION add_panel_honor_points(
  p_panel_id UUID,
  p_delta    INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid    UUID := auth.uid();
  v_is_admin      BOOLEAN := FALSE;
  v_panel_user_id UUID;
BEGIN
  -- 어드민 여부 확인
  SELECT (raw_user_meta_data ->> 'role') = 'admin'
    INTO v_is_admin
    FROM auth.users
   WHERE id = v_caller_uid;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    -- 자신의 패널인지 확인
    SELECT user_id INTO v_panel_user_id
      FROM panels
     WHERE id = p_panel_id;

    IF v_panel_user_id IS NULL OR v_panel_user_id != v_caller_uid THEN
      RAISE EXCEPTION 'Unauthorized: can only update own honor points';
    END IF;
  END IF;

  UPDATE panels
     SET honor_points = GREATEST(0, honor_points + p_delta)
   WHERE id = p_panel_id;
END;
$$;

-- ── RPC 재정의: apply_honor_decay (자기 자신만 호출 가능) ─────────────────────
CREATE OR REPLACE FUNCTION apply_honor_decay(p_panel_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid     UUID := auth.uid();
  v_panel_user_id  UUID;
  v_is_admin       BOOLEAN := FALSE;
  v_decay_cursor   TIMESTAMPTZ;
  v_honor_points   INT;
  v_now            TIMESTAMPTZ := now();
  v_decay_start    TIMESTAMPTZ;
  v_weeks_pending  INT;
  v_points_removed INT;
BEGIN
  -- 어드민 또는 자기 자신만 허용
  SELECT (raw_user_meta_data ->> 'role') = 'admin'
    INTO v_is_admin
    FROM auth.users
   WHERE id = v_caller_uid;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    SELECT user_id INTO v_panel_user_id
      FROM panels
     WHERE id = p_panel_id;

    IF v_panel_user_id IS NULL OR v_panel_user_id != v_caller_uid THEN
      RAISE EXCEPTION 'Unauthorized: can only apply decay to own panel';
    END IF;
  END IF;

  SELECT
    COALESCE(honor_decay_applied_at, last_mission_date),
    honor_points
  INTO v_decay_cursor, v_honor_points
  FROM panels
  WHERE id = p_panel_id;

  IF v_decay_cursor IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'weeks_decayed', 0, 'points_removed', 0);
  END IF;

  v_decay_start := v_decay_cursor + INTERVAL '30 days';

  IF v_now < v_decay_start THEN
    RETURN jsonb_build_object('applied', false, 'weeks_decayed', 0, 'points_removed', 0);
  END IF;

  v_weeks_pending  := FLOOR(EXTRACT(EPOCH FROM (v_now - v_decay_start)) / (7 * 86400))::INT + 1;
  v_points_removed := LEAST(v_honor_points, v_weeks_pending * 200);

  UPDATE panels
     SET honor_points           = GREATEST(0, honor_points - v_points_removed),
         honor_decay_applied_at = v_now
   WHERE id = p_panel_id;

  RETURN jsonb_build_object(
    'applied',        true,
    'weeks_decayed',  v_weeks_pending,
    'points_removed', v_points_removed
  );
END;
$$;

-- ── RPC 재정의: rate_panel_feedback_helpfulness (company_id 검증 추가) ─────────
CREATE OR REPLACE FUNCTION rate_panel_feedback_helpfulness(
  p_company_id UUID,
  p_panel_id   UUID,
  p_ref_type   TEXT,
  p_ref_id     UUID,
  p_is_helpful BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid       UUID := auth.uid();
  v_company_user_id  UUID;
  v_existing_helpful BOOLEAN;
  v_hp_delta         INT  := 0;
  v_action           TEXT;
BEGIN
  -- p_company_id가 호출자의 회사인지 검증
  SELECT user_id INTO v_company_user_id
    FROM companies
   WHERE id = p_company_id;

  IF v_company_user_id IS NULL OR v_company_user_id != v_caller_uid THEN
    RAISE EXCEPTION 'Unauthorized: company_id does not belong to caller';
  END IF;

  SELECT is_helpful INTO v_existing_helpful
    FROM feedback_helpfulness_ratings
   WHERE company_id = p_company_id
     AND ref_type   = p_ref_type
     AND ref_id     = p_ref_id;

  IF NOT FOUND THEN
    INSERT INTO feedback_helpfulness_ratings
      (company_id, panel_id, ref_type, ref_id, is_helpful)
    VALUES
      (p_company_id, p_panel_id, p_ref_type, p_ref_id, p_is_helpful);

    v_hp_delta := CASE WHEN p_is_helpful THEN 15 ELSE -20 END;
    v_action   := 'inserted';

  ELSIF v_existing_helpful = p_is_helpful THEN
    DELETE FROM feedback_helpfulness_ratings
     WHERE company_id = p_company_id
       AND ref_type   = p_ref_type
       AND ref_id     = p_ref_id;

    v_hp_delta := CASE WHEN p_is_helpful THEN -15 ELSE 20 END;
    v_action   := 'deleted';

  ELSE
    UPDATE feedback_helpfulness_ratings
       SET is_helpful = p_is_helpful, created_at = now()
     WHERE company_id = p_company_id
       AND ref_type   = p_ref_type
       AND ref_id     = p_ref_id;

    v_hp_delta := CASE WHEN p_is_helpful THEN 35 ELSE -35 END;
    v_action   := 'updated_changed';
  END IF;

  IF v_hp_delta <> 0 THEN
    UPDATE panels
       SET honor_points = GREATEST(0, honor_points + v_hp_delta)
     WHERE id = p_panel_id;
  END IF;

  RETURN jsonb_build_object('action', v_action, 'hp_delta', v_hp_delta);
END;
$$;

-- GRANT 유지 (실행 권한은 유지, 내부에서 호출자 검증)
GRANT EXECUTE ON FUNCTION add_panel_honor_points(UUID, INT)                                     TO authenticated;
GRANT EXECUTE ON FUNCTION apply_honor_decay(UUID)                                               TO authenticated;
GRANT EXECUTE ON FUNCTION rate_panel_feedback_helpfulness(UUID, UUID, TEXT, UUID, BOOLEAN)      TO authenticated;
