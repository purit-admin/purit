-- 073: 알림 추가 6종
-- 1. notify_admin_on_feedback_submitted  : 패널 피드백 제출/재제출 시 어드민 전원 알림
-- 2. notify_company_first_panel_accepted : 첫 패널 수락 시 기업 오너 알림
-- 3. notify_owner_team_member_joined     : 팀원 초대 수락 시 기업 오너 알림
-- (심사 거절/활동 정지 알림은 client-side sendNotification으로 처리 — PanelManagement.jsx)

-- ──────────────────────────────────────────────────────────
-- 1. 패널 피드백 제출/재제출 → 어드민 전원
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_admin_on_feedback_submitted(
  p_mission_id UUID,
  p_is_resubmit BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_title TEXT;
  v_admin_id      UUID;
  v_icon          TEXT;
  v_title         TEXT;
  v_body          TEXT;
BEGIN
  SELECT title INTO v_mission_title FROM missions WHERE id = p_mission_id;

  IF p_is_resubmit THEN
    v_icon  := '🔄';
    v_title := '반려 피드백 재제출됨';
    v_body  := '[' || COALESCE(v_mission_title, '의뢰') || '] 패널이 반려된 피드백을 재제출했습니다. 다시 검토해 주세요.';
  ELSE
    v_icon  := '📝';
    v_title := '새 피드백 제출됨';
    v_body  := '[' || COALESCE(v_mission_title, '의뢰') || '] 패널이 새 피드백을 제출했습니다. 검토가 필요합니다.';
  END IF;

  FOR v_admin_id IN
    SELECT id FROM auth.users
    WHERE raw_app_meta_data->>'role' = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
    VALUES (
      v_admin_id,
      'info',
      v_icon,
      v_title,
      v_body,
      '/admin/purity',
      'admin'
    );
  END LOOP;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 2. 첫 번째 패널 수락 → 기업 오너
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_company_first_panel_accepted(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_title TEXT;
  v_filled_count  INT;
  v_owner_id      UUID;
  v_notif_prefs   JSONB;
BEGIN
  SELECT m.title, m.filled_count, c.user_id, c.notif_prefs
  INTO v_mission_title, v_filled_count, v_owner_id, v_notif_prefs
  FROM missions m
  JOIN companies c ON c.id = m.company_id
  WHERE m.id = p_mission_id;

  -- filled_count = 1 인 시점에만 발송 (첫 수락만)
  IF v_filled_count IS DISTINCT FROM 1 THEN RETURN; END IF;
  IF v_owner_id IS NULL THEN RETURN; END IF;
  -- missionStatusChange 알림 설정 확인 (opt-out)
  IF (v_notif_prefs->>'missionStatusChange') = 'false' THEN RETURN; END IF;

  INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
  VALUES (
    v_owner_id,
    'info',
    '🎯',
    '첫 번째 패널이 매칭되었습니다',
    '[' || COALESCE(v_mission_title, '의뢰') || '] 첫 번째 전문 패널이 의뢰에 참여했습니다. 피드백 수집이 시작되었습니다.',
    '/company',
    'company'
  );
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 3. 팀원 초대 수락 → 기업 오너
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_owner_team_member_joined(
  p_company_id  UUID,
  p_member_role TEXT DEFAULT NULL,
  p_member_name TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   UUID;
  v_role_label TEXT;
  v_display    TEXT;
BEGIN
  SELECT user_id INTO v_owner_id FROM companies WHERE id = p_company_id;
  IF v_owner_id IS NULL THEN RETURN; END IF;

  v_role_label := CASE p_member_role
    WHEN 'editor' THEN '편집자'
    WHEN 'viewer' THEN '뷰어'
    ELSE COALESCE(p_member_role, '팀원')
  END;
  v_display := COALESCE(NULLIF(trim(p_member_name), ''), '새 팀원');

  INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
  VALUES (
    v_owner_id,
    'success',
    '🤝',
    '새 팀원이 합류했습니다',
    v_display || '님이 ' || v_role_label || ' 역할로 팀에 합류했습니다.',
    '/company/settings',
    'company'
  );
END;
$$;
