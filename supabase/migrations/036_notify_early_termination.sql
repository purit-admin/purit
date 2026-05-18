-- 기업 조기 종료 시 어드민 전원에게 알림 발송 RPC
-- action_url에 missionId 쿼리 파라미터 포함 → 어드민 미션관리 취소 탭 딥링크

CREATE OR REPLACE FUNCTION notify_early_termination(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_title TEXT;
  v_admin_id UUID;
BEGIN
  SELECT title INTO v_mission_title FROM missions WHERE id = p_mission_id;

  FOR v_admin_id IN
    SELECT id FROM auth.users
    WHERE raw_app_meta_data->>'role' = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
    VALUES (
      v_admin_id,
      'warning',
      '⚠️',
      '조기 종료 의뢰 발생',
      '[' || COALESCE(v_mission_title, '의뢰') || '] 기업이 의뢰를 조기 종료했습니다. 피드백을 검토하고 완료 처리해 주세요.',
      '/admin/missions?missionId=' || p_mission_id::TEXT,
      'admin'
    );
  END LOOP;
END;
$$;
