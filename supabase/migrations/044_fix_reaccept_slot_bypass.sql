-- 044_fix_reaccept_slot_bypass.sql
-- reaccept_rejected_feedback RPC 수정 + stale filled_count 데이터 복구
--
-- 원인: decrement_mission_filled_count 인증 버그(D-43 migration 043 참조)로
--       반려 시 filled_count가 감소되지 않아 reaccept 시 슬롯 마감으로 오인
--
-- 해결:
--   filled_count < panel_count → 정상 경로: filled_count +1 (decrement가 정상 실행된 경우)
--   filled_count >= panel_count → 복구 경로: filled_count 유지 (패널 슬롯이 이미 카운트에 포함됨)
--   두 경우 모두 feedback.status = 'draft' 전환 허용 (재작성 차단 해제)

CREATE OR REPLACE FUNCTION reaccept_rejected_feedback(p_feedback_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_id   UUID;
  v_panel_id     UUID;
  v_filled       INTEGER;
  v_max          INTEGER;
  v_deadline     TIMESTAMPTZ;
  v_status       TEXT;
BEGIN
  -- 피드백 및 미션 정보 조회 (미션 행 잠금)
  SELECT f.mission_id, f.panel_id, f.rejection_deadline, f.status,
         m.filled_count, m.panel_count
  INTO   v_mission_id, v_panel_id, v_deadline, v_status, v_filled, v_max
  FROM   feedbacks f
  JOIN   missions  m ON m.id = f.mission_id
  WHERE  f.id = p_feedback_id
  FOR UPDATE OF m;

  -- 소유권 검증
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

  -- 슬롯 처리
  -- filled_count < panel_count: decrement가 정상 실행된 경우 → 슬롯 재예약 (+1)
  -- filled_count >= panel_count: decrement 실패로 패널 슬롯이 이미 카운트에 포함된 경우
  --   → filled_count 변경 없이 feedback 상태만 draft로 전환 (슬롯은 이미 이 패널의 것)
  IF v_filled < v_max THEN
    UPDATE missions
    SET    filled_count = filled_count + 1
    WHERE  id = v_mission_id;
  END IF;

  -- 피드백 상태를 draft로 전환 (재작성 시작)
  UPDATE feedbacks
  SET    status = 'draft'
  WHERE  id = p_feedback_id;

  RETURN TRUE;
END;
$$;


-- ============================================================
-- 기존 stale filled_count 데이터 수정
-- decrement_mission_filled_count 실패로 과다 계상된 슬롯을 실제 값으로 재조정
-- 대상: 진행 중(active) 미션 중 filled_count가 실제 활성 피드백 수보다 많은 건
-- ============================================================
UPDATE missions m
SET    filled_count = GREATEST(0, (
         SELECT COUNT(*)
         FROM   feedbacks f
         WHERE  f.mission_id = m.id
         AND    f.status <> 'rejected'
       ))
WHERE  m.status = 'active'
AND    m.filled_count > (
         SELECT COUNT(*)
         FROM   feedbacks f
         WHERE  f.mission_id = m.id
         AND    f.status <> 'rejected'
       );
