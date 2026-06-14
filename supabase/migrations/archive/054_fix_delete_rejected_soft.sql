-- 패널 지급 거절 피드백 "삭제" → 소프트 딜리트로 변경
-- 이전 구현: 영구 DELETE → 패널이 반려 기록을 지워 신뢰도를 인위적으로 상승시킬 수 있는 보안 이슈
-- 변경 후: dismissed=true SET (DB 레코드 보존, 패널 화면에서만 숨김)

CREATE OR REPLACE FUNCTION delete_rejected_feedback(p_feedback_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM feedbacks
    WHERE id = p_feedback_id
      AND panel_id = (SELECT id FROM panels WHERE user_id = auth.uid())
      AND status = 'rejected'
  ) THEN
    RAISE EXCEPTION 'feedback not found or not yours';
  END IF;

  UPDATE feedbacks SET dismissed = true WHERE id = p_feedback_id;
END;
$$;
