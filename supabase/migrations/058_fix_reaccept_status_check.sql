-- 058_fix_reaccept_status_check.sql
-- reaccept_rejected_feedback RPC에 패널 status='active' 체크 추가
-- (057이 accept_mission_slot에 체크를 추가한 것과 대칭)
--
-- 문제: 047/049에서 정의된 reaccept_rejected_feedback가 panels를 조회할 때
--   'AND status = 'active'' 조건이 없어 suspended 패널도 RPC 호출 성공
--   → filled_count +1 (슬롯 점유) + feedbacks.status='draft' 전환 → 폼 접근·제출 가능
--
-- 해결: panels SELECT에 AND status = 'active' 추가
--   suspended / pending 패널은 v_panel_id IS NULL → RETURN FALSE
--   클라이언트(ActiveMission.jsx): !reaccepted → deadlineExpired=true 처리 (프론트 수정 불필요)

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
  -- 현재 사용자의 패널 ID 조회 + status 체크 (suspended/pending 차단)
  SELECT id INTO v_panel_id
  FROM panels
  WHERE user_id = auth.uid()
    AND status = 'active';

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
      RETURN FALSE;
    END IF;
  END IF;

  -- 피드백 상태를 draft로 전환 (재작성 시작)
  UPDATE feedbacks SET status = 'draft' WHERE id = p_feedback_id;

  RETURN TRUE;
END;
$$;
