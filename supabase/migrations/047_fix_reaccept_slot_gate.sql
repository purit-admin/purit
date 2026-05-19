-- 047_fix_reaccept_slot_gate.sql
-- reaccept_rejected_feedback 슬롯 초과 허용 버그 수정
--
-- 버그: migration 046에서 filled_count >= panel_count일 때
--   filled_count +1 UPDATE만 건너뛰고 feedbacks.status = 'draft' 전환 + RETURN TRUE는 그대로 실행됨
--   → 슬롯이 꽉 찬 상태에서도 재작성이 허용되어 피드백이 panel_count를 초과해 제출 가능
--
-- 원인: 이전 migration들(044~046)의 주석
--   "filled_count >= panel_count: decrement 실패로 슬롯이 이미 카운트됨 → 유지"
--   → migration 043에서 decrement 인증 버그를 수정한 이후로 이 가정이 틀렸음
--   → 이제 decrement는 정상 작동하므로 슬롯 꽉 참 = 진짜 꽉 참
--
-- 해결: accept_mission_slot(migration 035)과 동일한 atomic UPDATE 게이트 패턴으로 교체
--   UPDATE missions SET filled_count = filled_count + 1
--   WHERE id = v_mission_id AND filled_count < panel_count
--   → 슬롯 없으면 NOT FOUND → RETURN FALSE (클라이언트에 슬롯 마감 안내)

CREATE OR REPLACE FUNCTION reaccept_rejected_feedback(p_feedback_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id   UUID;
  v_mission_id UUID;
  v_deadline   TIMESTAMPTZ;
  v_status     TEXT;
BEGIN
  -- 현재 사용자의 패널 ID 조회 (auth.uid() = auth.users.id → panels.user_id)
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 피드백 조회 + 소유권 검증 (panel_id = v_panel_id 조건으로 본인 것만)
  SELECT f.mission_id, f.rejection_deadline, f.status
  INTO   v_mission_id, v_deadline, v_status
  FROM   feedbacks f
  WHERE  f.id       = p_feedback_id
    AND  f.panel_id = v_panel_id;

  -- 피드백 미존재 또는 소유권 불일치
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 반려 상태 검증
  IF v_status <> 'rejected' THEN
    RETURN FALSE;
  END IF;

  -- 재제출 기한 만료 체크
  IF v_deadline IS NOT NULL AND v_deadline < NOW() THEN
    RETURN FALSE;
  END IF;

  -- 슬롯 재예약 (atomic — filled_count < panel_count 조건 포함, 슬롯 마감 시 NOT FOUND)
  IF v_mission_id IS NOT NULL THEN
    UPDATE missions
    SET    filled_count = filled_count + 1
    WHERE  id           = v_mission_id
      AND  filled_count < panel_count;

    IF NOT FOUND THEN
      -- 슬롯이 모두 찬 경우 → 재작성 불가
      RETURN FALSE;
    END IF;
  END IF;

  -- 피드백 상태를 draft로 전환 (재작성 시작)
  UPDATE feedbacks SET status = 'draft' WHERE id = p_feedback_id;

  RETURN TRUE;
END;
$$;
