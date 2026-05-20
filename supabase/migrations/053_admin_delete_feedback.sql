-- 어드민 전용: 반려됨 피드백 영구 삭제 RPC
-- 패널이 재제출 기한 내 미제출로 만료된 반려 피드백을 어드민이 직접 정리할 수 있도록 허용

CREATE OR REPLACE FUNCTION admin_delete_feedback(p_feedback_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt()->'app_metadata'->>'role') <> 'admin' THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- 반려됨 상태인 경우에만 삭제 허용
  IF NOT EXISTS (
    SELECT 1 FROM feedbacks WHERE id = p_feedback_id AND status = 'rejected'
  ) THEN
    RAISE EXCEPTION 'feedback not found or not in rejected status';
  END IF;

  -- 연결된 어노테이션 먼저 삭제
  DELETE FROM feedback_annotations WHERE feedback_id = p_feedback_id;

  -- 피드백 삭제
  DELETE FROM feedbacks WHERE id = p_feedback_id AND status = 'rejected';
END;
$$;
