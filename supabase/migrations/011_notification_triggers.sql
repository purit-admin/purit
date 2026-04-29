-- 011_notification_triggers.sql
-- 트리거 A: 신규 미션 등록 → 어드민 알림
CREATE OR REPLACE FUNCTION notify_admin_on_mission()
RETURNS TRIGGER AS $$
DECLARE v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1;
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, icon, title, body, action_url)
    VALUES (v_admin_id, 'info', '📋', '새 의뢰 등록',
            '새로운 미션이 등록되었습니다: ' || NEW.title, '/admin/missions');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mission_created ON missions;
CREATE TRIGGER on_mission_created
  AFTER INSERT ON missions
  FOR EACH ROW EXECUTE FUNCTION notify_admin_on_mission();

-- 트리거 B: 미션 슬롯 완료 → 기업 알림
CREATE OR REPLACE FUNCTION notify_company_on_slots_full()
RETURNS TRIGGER AS $$
DECLARE v_company_user_id UUID;
BEGIN
  IF NEW.filled_count >= NEW.panel_count AND OLD.filled_count < NEW.panel_count THEN
    SELECT user_id INTO v_company_user_id FROM companies WHERE id = NEW.company_id;
    IF v_company_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, icon, title, body, action_url)
      VALUES (v_company_user_id, 'success', '🎉', '의뢰 슬롯 완료',
              '미션 [' || NEW.title || '] 의 모든 패널 슬롯이 채워졌습니다.', '/company/results');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mission_slots_full ON missions;
CREATE TRIGGER on_mission_slots_full
  AFTER UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION notify_company_on_slots_full();
