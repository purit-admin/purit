-- 046_fix_reaccept_ownership_check.sql
-- reaccept_rejected_feedback RPC 소유권 체크 버그 수정
--
-- 버그: migration 045에서 소유권 검증을 다음과 같이 작성함:
--   v_panel_id := feedbacks.panel_id  (= panels.id, 패널 테이블 PK)
--   IF v_panel_id IS DISTINCT FROM auth.uid() THEN RETURN FALSE
--
--   feedbacks.panel_id는 panels.id(패널 테이블 자체 UUID)이고,
--   auth.uid()는 auth.users.id(인증 시스템 UUID)라 항상 서로 다름
--   → 모든 패널에 대해 항상 RETURN FALSE → "슬롯이 이미 차지됨" 오류 화면
--
-- 해결: migration 035(accept_mission_slot)와 동일한 패턴으로 수정
--   1) panels WHERE user_id = auth.uid() 로 v_panel_id 먼저 조회
--   2) feedbacks WHERE id = p_feedback_id AND panel_id = v_panel_id 로 소유권 동시 검증

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
  v_filled     INTEGER;
  v_max        INTEGER;
BEGIN
  -- 현재 사용자의 패널 ID 조회 (auth.uid() = auth.users.id → panels.user_id)
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 피드백 조회 + 소유권 검증 (panel_id = v_panel_id 조건으로 본인 것만)
  SELECT f.mission_id, f.rejection_deadline, f.status,
         m.filled_count, m.panel_count
  INTO   v_mission_id, v_deadline, v_status, v_filled, v_max
  FROM   feedbacks f
  LEFT JOIN missions m ON m.id = f.mission_id
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

  -- filled_count 처리 (실패해도 feedback 전환은 계속 진행)
  BEGIN
    IF v_mission_id IS NOT NULL AND v_filled IS NOT NULL AND v_max IS NOT NULL THEN
      IF v_filled < v_max THEN
        UPDATE missions SET filled_count = filled_count + 1 WHERE id = v_mission_id;
      END IF;
      -- filled_count >= panel_count: decrement 실패로 슬롯이 이미 카운트됨 → 유지
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 피드백 상태를 draft로 전환 (재작성 시작)
  UPDATE feedbacks SET status = 'draft' WHERE id = p_feedback_id;

  RETURN TRUE;
END;
$$;
