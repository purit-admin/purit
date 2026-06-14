-- 패널이 수락 취소 시 draft 피드백을 삭제하는 SECURITY DEFINER RPC
-- RLS에 feedbacks DELETE 정책이 없으므로 RPC로 처리
CREATE OR REPLACE FUNCTION cancel_panel_feedback(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_panel_id UUID;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN
    RAISE EXCEPTION 'Panel not found for current user';
  END IF;

  DELETE FROM feedbacks
  WHERE mission_id = p_mission_id
    AND panel_id   = v_panel_id
    AND status     = 'draft';
END;
$$;
