-- 050_dismiss_rejected_feedback.sql
-- 패널이 재작성 불가 반려 피드백을 처리하기 위한 두 가지 RPC
--
-- 1. dismiss_rejected_feedback: [수정 필요] 탭에서 숨김 (dismissed=true)
--    - 지급 거절 탭에는 그대로 유지
-- 2. delete_rejected_feedback: [지급 거절] 탭에서 완전 삭제
--    - DB에서 영구 제거

-- feedbacks 테이블에 dismissed 컬럼 추가
ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- 숨김 처리 RPC (dismissed = true)
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
  SET dismissed = TRUE
  WHERE id       = p_feedback_id
    AND panel_id = v_panel_id
    AND status   = 'rejected';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback not found or not authorized';
  END IF;
END;
$$;

-- 완전 삭제 RPC (진짜 DELETE)
CREATE OR REPLACE FUNCTION delete_rejected_feedback(p_feedback_id UUID)
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

  DELETE FROM feedbacks
  WHERE id       = p_feedback_id
    AND panel_id = v_panel_id
    AND status   = 'rejected';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback not found or not authorized';
  END IF;
END;
$$;
