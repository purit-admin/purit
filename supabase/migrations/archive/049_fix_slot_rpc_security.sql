-- 049_fix_slot_rpc_security.sql
-- 슬롯 관리 RPC 보안 강화 및 무결성 수정
--
-- 수정 1: decrement_mission_filled_count (migration 043 D-58 수정)
--   문제: app_metadata AND user_metadata OR 패턴 → user_metadata는 사용자가 직접 변조 가능 (D-58)
--   해결: app_metadata 단독 체크로 교체 (migration 026에서 admin app_metadata 설정 완료)
--
-- 수정 2: restore_mission_slot (migration 048 D-58 수정 + 오버플로우 가드)
--   문제 1: 동일 D-58 user_metadata OR 패턴
--   문제 2: filled_count 상한(panel_count) 초과 방지 로직 없음
--            → 동시성 edge case(reject 후 신규 수락과 동시에 restore 실행) 시 filled_count > panel_count 가능
--   해결: app_metadata 단독 + LEAST(panel_count, filled_count+1) 상한 클램프
--
-- 수정 3: reaccept_rejected_feedback (migration 046 구문 오류 안전망)
--   문제: migration 046에 한글 자모(ㅔ) 혼입으로 PostgreSQL parse 오류 발생
--         supabase db push 방식 사용 시 046 실패 → 047 미적용 → 045 버전(소유권 체크 버그) 잔류 가능
--   해결: migration 047과 동일한 함수를 재정의해 DB 적용 상태를 확실히 보장

-- =====================================================================
-- 수정 1: decrement_mission_filled_count (D-58 수정)
-- =====================================================================
CREATE OR REPLACE FUNCTION decrement_mission_filled_count(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt()->'app_metadata'->>'role') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE missions
  SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
  WHERE id = p_mission_id;
END;
$$;

-- =====================================================================
-- 수정 2: restore_mission_slot (D-58 수정 + 오버플로우 가드)
-- =====================================================================
CREATE OR REPLACE FUNCTION restore_mission_slot(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt()->'app_metadata'->>'role') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- LEAST로 panel_count 상한 클램프 — 동시성 경쟁(신규 수락 + restore 동시 실행) 시에도 오버플로우 방지
  UPDATE missions
  SET filled_count = LEAST(panel_count, COALESCE(filled_count, 0) + 1)
  WHERE id = p_mission_id;
END;
$$;

-- =====================================================================
-- 수정 3: reaccept_rejected_feedback (migration 047 내용 재적용 — 046 parse 오류 안전망)
-- =====================================================================
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
