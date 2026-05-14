-- 028_fix_notification_triggers.sql
-- 트리거 A: draft 미션 알림 제외 (임시 저장 시 어드민 알림 스팸 방지)
CREATE OR REPLACE FUNCTION notify_admin_on_mission()
RETURNS TRIGGER AS $$
DECLARE v_admin_id UUID;
BEGIN
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;
  SELECT id INTO v_admin_id FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1;
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, icon, title, body, action_url)
    VALUES (v_admin_id, 'info', '📋', '새 의뢰 등록',
            '새로운 의뢰가 등록되었습니다: ' || NEW.title, '/admin/missions');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mission_created ON missions;
CREATE TRIGGER on_mission_created
  AFTER INSERT ON missions
  FOR EACH ROW EXECUTE FUNCTION notify_admin_on_mission();

-- 트리거 B: 슬롯 완료 알림 — actionUrl에 mission id 포함 + 워딩 수정
CREATE OR REPLACE FUNCTION notify_company_on_slots_full()
RETURNS TRIGGER AS $$
DECLARE v_company_user_id UUID;
BEGIN
  IF NEW.filled_count >= NEW.panel_count AND OLD.filled_count < NEW.panel_count THEN
    SELECT user_id INTO v_company_user_id FROM companies WHERE id = NEW.company_id;
    IF v_company_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, icon, title, body, action_url)
      VALUES (v_company_user_id, 'success', '🎉', '패널 매칭 완료',
              '의뢰 [' || NEW.title || ']의 패널 매칭이 완료됐습니다. 피드백 결과를 기다려주세요.',
              '/company/results?id=' || NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mission_slots_full ON missions;
CREATE TRIGGER on_mission_slots_full
  AFTER UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION notify_company_on_slots_full();
