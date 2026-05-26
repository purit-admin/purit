-- 057_accept_slot_status_check.sql
-- accept_mission_slot RPC에 패널 status='active' 체크 추가
-- suspended / pending 패널은 NULL 반환 → 클라이언트가 "슬롯이 마감되었습니다" 처리
-- (기존 035 로직 전체 유지 + panels SELECT에 AND status='active' 추가)

CREATE OR REPLACE FUNCTION accept_mission_slot(
  p_mission_id          UUID,
  p_submission_deadline TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id UUID;
  v_rows     INTEGER;
  v_fb_id    UUID;
BEGIN
  -- 패널 조회 + status 체크: suspended/pending 패널이면 NULL 반환
  SELECT id INTO v_panel_id
  FROM panels
  WHERE user_id = auth.uid()
    AND status = 'active';

  IF v_panel_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 중복 참여 방지: 이미 draft/submitted/rejected 상태로 참여 중인지 확인
  IF EXISTS (
    SELECT 1 FROM feedbacks
    WHERE mission_id = p_mission_id
      AND panel_id   = v_panel_id
      AND status IN ('draft', 'submitted', 'rejected')
  ) THEN
    RAISE EXCEPTION 'Already participating in this mission';
  END IF;

  -- 원자적 슬롯 예약: filled_count < panel_count 조건 충족 시에만 증가
  UPDATE missions
  SET filled_count = COALESCE(filled_count, 0) + 1
  WHERE id = p_mission_id
    AND COALESCE(filled_count, 0) < COALESCE(panel_count, 0);

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- 0행 업데이트 = 슬롯 마감 (동시 경쟁 포함)
  IF v_rows = 0 THEN
    RETURN NULL;
  END IF;

  -- 슬롯 확보 성공 → feedbacks INSERT
  v_fb_id := gen_random_uuid();
  INSERT INTO feedbacks (
    id, mission_id, panel_id,
    clarity_score, relevance_score, value_score,
    differentiation_score, trust_score,
    strengths, weaknesses, suggestions,
    purity_passed, status, submission_deadline
  ) VALUES (
    v_fb_id, p_mission_id, v_panel_id,
    NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL,
    false, 'draft', p_submission_deadline
  );

  RETURN v_fb_id;
END;
$$;
