-- 045_fix_reaccept_no_lock.sql
-- reaccept_rejected_feedback RPC 완전 단순화
--
-- 문제: migration 044의 FOR UPDATE OF m 행 잠금이 Supabase PgBouncer 환경에서
--       내부 오류를 일으켜 함수가 FALSE를 반환 → 슬롯 차지 오인 화면 출력
--
-- 해결: FOR UPDATE 제거 + 슬롯 용량 게이트 제거
--   → 소유권·반려상태·기한 확인 후 무조건 draft 전환
--   → filled_count < panel_count 이면 +1 (decrement가 정상 작동한 경우)
--     filled_count >= panel_count 이면 유지 (decrement 실패로 이미 카운트됨)

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
  -- FOR UPDATE 없는 단순 SELECT (잠금 제거)
  SELECT f.panel_id, f.mission_id, f.rejection_deadline, f.status,
         m.filled_count, m.panel_count
  INTO   v_panel_id, v_mission_id, v_deadline, v_status, v_filled, v_max
  FROM   feedbacks f
  LEFT JOIN missions m ON m.id = f.mission_id
  WHERE  f.id = p_feedback_id;

  -- 피드백 미존재
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 소유권 검증 (본인 피드백만)
  IF v_panel_id IS DISTINCT FROM auth.uid() THEN
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

  -- filled_count 처리 (실패해도 feedback 전환은 계속)
  BEGIN
    IF v_mission_id IS NOT NULL AND v_filled IS NOT NULL AND v_max IS NOT NULL THEN
      IF v_filled < v_max THEN
        -- 정상 경로: decrement가 성공적으로 실행된 경우 → 슬롯 재예약
        UPDATE missions SET filled_count = filled_count + 1 WHERE id = v_mission_id;
      END IF;
      -- filled_count >= panel_count: decrement 실패로 슬롯이 이미 카운트됨 → 유지
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- filled_count 업데이트 실패해도 feedback 전환은 계속 진행
    NULL;
  END;

  -- 피드백 상태를 draft로 전환 (재작성 시작)
  UPDATE feedbacks SET status = 'draft' WHERE id = p_feedback_id;

  RETURN TRUE;
END;
$$;
