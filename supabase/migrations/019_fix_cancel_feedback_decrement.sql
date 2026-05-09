-- 패널이 반려된 피드백을 재작성 중 취소할 때 filled_count도 감소시키는 RPC 수정
-- 최초 draft(한 번도 제출 안 한) 취소 시에는 filled_count 변동 없음
-- 재제출 draft(suggestions IS NOT NULL = 이전 제출 이력 있음) 취소 시 filled_count -1
CREATE OR REPLACE FUNCTION cancel_panel_feedback(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_panel_id    UUID;
  v_suggestions TEXT;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RAISE EXCEPTION 'Panel not found for current user';
  END IF;

  -- 삭제 전에 suggestions 확인 (null이면 최초 draft, not null이면 이전 제출 이력 있음)
  SELECT suggestions INTO v_suggestions
  FROM feedbacks
  WHERE mission_id = p_mission_id
    AND panel_id   = v_panel_id
    AND status     = 'draft';

  DELETE FROM feedbacks
  WHERE mission_id = p_mission_id
    AND panel_id   = v_panel_id
    AND status     = 'draft';

  -- 이전에 제출된 적 있는 피드백(반려 후 재작성 중 취소)이면 filled_count 차감
  IF v_suggestions IS NOT NULL THEN
    UPDATE missions
    SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
    WHERE id = p_mission_id;
  END IF;
END;
$$;
