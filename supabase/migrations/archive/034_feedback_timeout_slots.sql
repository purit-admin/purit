-- 034_feedback_timeout_slots.sql
-- 타임아웃 기반 슬롯 해제 시스템
-- submission_deadline : 수락 후 최초 제출 마감 (메인 4h, 서브 2h)
-- rejection_deadline  : 반려 후 재제출 마감   (메인 4h, 서브 2h)
--
-- 슬롯 카운터(filled_count) 흐름 변경:
--   수락(draft INSERT)      → 변동 없음 (기존과 동일)
--   최초 제출(submitted)    → +1 increment_mission_filled_count (기존과 동일)
--   어드민 반려             → -1 decrement_mission_filled_count (신규) + rejection_deadline 설정
--   패널 재제출(new system) → +1 increment_mission_filled_count (신규 — -1 복원)
--   draft 수락 취소(old)    → -1 cancel_panel_feedback (기존 로직 유지)
--   draft 수락 취소(new)    → 0  rejection_deadline IS NOT NULL → decrement 생략 (이미 -1됨)

-- 1. feedbacks 테이블 컬럼 추가
ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_deadline  TIMESTAMPTZ;

-- 2. decrement_mission_filled_count — 어드민 전용
CREATE OR REPLACE FUNCTION decrement_mission_filled_count(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- D-58 패턴: app_metadata 기반 어드민 검증
  IF (auth.jwt()->'app_metadata'->>'role') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE missions
  SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
  WHERE id = p_mission_id;
END;
$$;

-- 3. expire_panel_drafts — 패널 본인 전용
--    만료된 draft / rejected 행 삭제 (filled_count 변동 없음)
--    - 최초 draft 만료: 수락 후 미제출 → 카운터 미증가 상태이므로 그냥 삭제
--    - 재작성 draft 만료: rejection_deadline 초과 → 반려 시 이미 -1 처리됨
--    - rejected 만료: 재작성 시도 없이 기간 종료
CREATE OR REPLACE FUNCTION expire_panel_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id UUID;
  v_deleted  integer;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM feedbacks
  WHERE panel_id = v_panel_id
    AND (
      -- 최초 수락 draft: submission_deadline 만료 (rejection 없는 경우만)
      (status = 'draft'    AND rejection_deadline IS NULL
        AND submission_deadline IS NOT NULL AND submission_deadline < NOW())
      -- 재작성 draft: rejection_deadline 만료
      OR (status = 'draft'    AND rejection_deadline IS NOT NULL AND rejection_deadline < NOW())
      -- 반려 상태(재작성 미시도): rejection_deadline 만료
      OR (status = 'rejected' AND rejection_deadline IS NOT NULL AND rejection_deadline < NOW())
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 4. cancel_panel_feedback 업데이트
--    신 시스템(rejection_deadline IS NOT NULL): 반려 시 이미 -1 처리됨 → 취소 시 decrement 생략
--    구 시스템(rejection_deadline IS NULL)    : 기존 로직 유지 (suggestions IS NOT NULL → -1)
CREATE OR REPLACE FUNCTION cancel_panel_feedback(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id         UUID;
  v_suggestions      TEXT;
  v_rejection_dl     TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RAISE EXCEPTION 'Panel not found for current user';
  END IF;

  SELECT suggestions, rejection_deadline
  INTO v_suggestions, v_rejection_dl
  FROM feedbacks
  WHERE mission_id = p_mission_id
    AND panel_id   = v_panel_id
    AND status     = 'draft';

  DELETE FROM feedbacks
  WHERE mission_id = p_mission_id
    AND panel_id   = v_panel_id
    AND status     = 'draft';

  -- 구 시스템만 decrement: 이전 제출 이력 있음 AND rejection_deadline 없음(반려 시 -1 미처리)
  IF v_suggestions IS NOT NULL AND v_rejection_dl IS NULL THEN
    UPDATE missions
    SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
    WHERE id = p_mission_id;
  END IF;
END;
$$;
