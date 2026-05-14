-- 029_notify_admin_on_draft_activate.sql
-- draft → active 전환 시 어드민 알림 (임시 저장 후 제출 경로 커버)
-- notify_admin_on_mission 함수는 028에서 이미 정의됨
-- (NEW.status = 'draft'이면 RETURN NEW로 방어되므로 함수 재사용 가능)

DROP TRIGGER IF EXISTS on_mission_activated ON missions;
CREATE TRIGGER on_mission_activated
  AFTER UPDATE ON missions
  FOR EACH ROW
  WHEN (OLD.status = 'draft' AND NEW.status != 'draft')
  EXECUTE FUNCTION notify_admin_on_mission();
