-- 035_redesign_slot_on_accept.sql
-- 슬롯 예약 시점 재설계: 수락/재수락 클릭 시 filled_count 증가
--                        제출(submit) 시에는 filled_count 변동 없음
--
-- filled_count 생애주기:
--   수락(accept_mission_slot)          → +1  (원자적)
--   재작성 클릭(reaccept_rejected_feedback) → +1  (반려 시 -1 복원, 원자적)
--   반려(decrement_mission_filled_count, 034) → -1
--   취소(cancel_panel_feedback)         → -1  (draft 삭제 시 항상)
--   만료(expire_panel_drafts)           → draft -1+삭제 / rejected 삭제만
--
-- 동시성 처리:
--   UPDATE missions SET filled_count = filled_count + 1
--     WHERE id = X AND filled_count < panel_count
--   PostgreSQL 행 잠금으로 동시 수락이 직렬화됨.
--   ROW_COUNT = 0 → 슬롯 마감 (클라이언트에 NULL / false 반환)


-- ═══════════════════════════════════════════════════════════════
-- 1. accept_mission_slot — 수락 시 원자적 슬롯 예약 + feedbacks INSERT
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION accept_mission_slot(
  p_mission_id          UUID,
  p_submission_deadline TIMESTAMPTZ
)
RETURNS UUID  -- 성공: 새 feedback UUID / 슬롯 마감: NULL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id UUID;
  v_rows     INTEGER;
  v_fb_id    UUID;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RAISE EXCEPTION 'Panel not found for current user';
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


-- ═══════════════════════════════════════════════════════════════
-- 2. reaccept_rejected_feedback — 재작성 클릭 시 원자적 슬롯 재예약
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reaccept_rejected_feedback(p_feedback_id UUID)
RETURNS BOOLEAN  -- true: 성공 / false: 슬롯 마감 또는 기간 만료
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id   UUID;
  v_mission_id UUID;
  v_rej_dl     TIMESTAMPTZ;
  v_rows       INTEGER;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RAISE EXCEPTION 'Panel not found for current user';
  END IF;

  -- 반려 피드백 조회: 본인 것이고 status='rejected'인지 확인
  SELECT mission_id, rejection_deadline
  INTO   v_mission_id, v_rej_dl
  FROM feedbacks
  WHERE id       = p_feedback_id
    AND panel_id = v_panel_id
    AND status   = 'rejected';

  IF v_mission_id IS NULL THEN
    RAISE EXCEPTION 'Rejected feedback not found';
  END IF;

  -- 재제출 기간 만료 체크
  IF v_rej_dl IS NOT NULL AND v_rej_dl < NOW() THEN
    RETURN FALSE;
  END IF;

  -- 원자적 슬롯 재예약
  UPDATE missions
  SET filled_count = COALESCE(filled_count, 0) + 1
  WHERE id = v_mission_id
    AND COALESCE(filled_count, 0) < COALESCE(panel_count, 0);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN FALSE;
  END IF;

  -- 슬롯 재확보 → feedbacks를 draft로 복원
  UPDATE feedbacks SET status = 'draft' WHERE id = p_feedback_id;

  RETURN TRUE;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 3. cancel_panel_feedback 재정의 — 단순화
--    draft 삭제 시 항상 decrement (구/신 시스템 분기 제거)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION cancel_panel_feedback(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id UUID;
  v_deleted  INTEGER;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RAISE EXCEPTION 'Panel not found for current user';
  END IF;

  DELETE FROM feedbacks
  WHERE mission_id = p_mission_id
    AND panel_id   = v_panel_id
    AND status     = 'draft';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- 수락 시점에 +1됐으므로 취소 시 항상 -1
  IF v_deleted > 0 THEN
    UPDATE missions
    SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
    WHERE id = p_mission_id;
  END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 4. expire_panel_drafts 재정의
--    draft 만료: decrement + 삭제  (수락 시 +1됐으므로)
--    rejected 만료: 삭제만         (반려 시 이미 -1됨)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION expire_panel_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id       UUID;
  v_draft_deleted  INTEGER := 0;
  v_reject_deleted INTEGER;
  rec              RECORD;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN RETURN 0; END IF;

  -- draft 만료 처리: 수락 시 +1됐으므로 삭제 시 -1
  FOR rec IN
    SELECT id, mission_id FROM feedbacks
    WHERE panel_id = v_panel_id
      AND status   = 'draft'
      AND (
        -- 최초 수락 draft: submission_deadline 만료
        (rejection_deadline IS NULL
          AND submission_deadline IS NOT NULL
          AND submission_deadline < NOW())
        -- 재작성 draft: rejection_deadline 만료
        OR (rejection_deadline IS NOT NULL AND rejection_deadline < NOW())
      )
  LOOP
    DELETE FROM feedbacks WHERE id = rec.id;
    UPDATE missions
    SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
    WHERE id = rec.mission_id;
    v_draft_deleted := v_draft_deleted + 1;
  END LOOP;

  -- rejected 만료 처리: 반려 시 이미 decrement됐으므로 삭제만
  DELETE FROM feedbacks
  WHERE panel_id = v_panel_id
    AND status   = 'rejected'
    AND rejection_deadline IS NOT NULL
    AND rejection_deadline < NOW();
  GET DIAGNOSTICS v_reject_deleted = ROW_COUNT;

  RETURN v_draft_deleted + v_reject_deleted;
END;
$$;
