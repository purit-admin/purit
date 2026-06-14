-- 032_fix_honor_rpc_app_metadata.sql
-- D-58 패턴: admin 검증을 raw_user_meta_data → raw_app_meta_data로 교체
-- raw_user_meta_data는 사용자가 supabase.auth.updateUser()로 직접 수정 가능 → admin 사칭 가능
-- raw_app_meta_data는 service role만 수정 가능 → 안전

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
  SELECT (raw_app_meta_data ->> 'role') = 'admin'
    INTO v_is_admin
    FROM auth.users
   WHERE id = v_caller_uid;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
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
  SELECT (raw_app_meta_data ->> 'role') = 'admin'
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

GRANT EXECUTE ON FUNCTION add_panel_honor_points(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_honor_decay(UUID) TO authenticated;
