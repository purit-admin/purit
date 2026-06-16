-- 104_split_revision_dismissed.sql
-- 버그 수정: dismiss_rejected_feedback([수정 필요] 탭 '삭제')와
--   delete_rejected_feedback(정산 [지급 거절] 탭 삭제)가 동일한 dismissed 플래그를 공유 →
--   [수정 필요]에서 삭제하면 [지급 거절] 탭에서도 함께 사라져,
--   삭제 확인 모달의 "정산 내역 [지급 거절] 탭에서는 계속 확인할 수 있습니다" 약속을 위반하고
--   migration 050 설계 의도("dismiss → 지급 거절 탭에는 그대로 유지")도 깨짐.
--
-- 해결: feedbacks.revision_dismissed 신규 컬럼으로 두 삭제의 의미를 분리.
--   · revision_dismissed=TRUE → [수정 필요] 탭에서만 숨김 ([지급 거절] 탭 유지)  ← dismiss_rejected_feedback
--   · dismissed=TRUE          → [지급 거절] 탭에서 숨김 (패널 화면 전체 숨김)      ← delete_rejected_feedback (불변)

ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS revision_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- [수정 필요] 탭 숨김 RPC — dismissed → revision_dismissed 로 변경
-- (CREATE OR REPLACE라 기존 GRANT EXECUTE 유지)
CREATE OR REPLACE FUNCTION dismiss_rejected_feedback(p_feedback_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id UUID;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE feedbacks
  SET revision_dismissed = TRUE
  WHERE id       = p_feedback_id
    AND panel_id = v_panel_id
    AND status   = 'rejected';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback not found or not authorized';
  END IF;
END;
$$;

-- delete_rejected_feedback(정산 [지급 거절] 탭 삭제, dismissed=TRUE)는 변경 없음 (migration 054 유지)
