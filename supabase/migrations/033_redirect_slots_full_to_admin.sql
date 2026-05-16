-- 033_redirect_slots_full_to_admin.sql
-- 패널 슬롯 완료 알림 수신자: 기업 → 어드민으로 변경
-- 이유: 피드백은 어드민 검토(완료 처리) 후 기업에 공개되므로,
--       슬롯이 다 찼을 때 어드민에게 "검토 후 완료 처리" 요청 알림을 보내야 함.
--       기업에게는 어드민이 완료 처리 시 단 1회 알림 발송 (admin/Missions.jsx sendNotification 경유).

CREATE OR REPLACE FUNCTION notify_company_on_slots_full()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_user_id UUID;
BEGIN
  IF NEW.filled_count >= NEW.panel_count AND OLD.filled_count < NEW.panel_count THEN
    -- D-58: role 판별은 app_metadata 사용 (user_metadata는 유저가 변조 가능)
    FOR v_admin_user_id IN
      SELECT id FROM auth.users
      WHERE raw_app_meta_data->>'role' = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role, read)
      VALUES (
        v_admin_user_id,
        'info',
        '📋',
        '패널 수집 완료',
        '의뢰 [' || NEW.title || '] 의 패널 슬롯이 모두 채워졌습니다. 검토 후 완료 처리해 주세요.',
        '/admin/missions',
        'admin',
        false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
