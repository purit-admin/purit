-- 030_notifications_target_role.sql
-- notifications 테이블에 target_role 컬럼 추가
-- 어드민 계정처럼 3개 포털을 동시에 사용하는 경우 포털별 알림 분리를 위해 필요

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS target_role TEXT CHECK (target_role IN ('admin', 'company', 'panel'));

-- DB 트리거 함수 수정: target_role 포함

-- 트리거 A: 새 의뢰 등록 → 어드민 알림
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
    INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
    VALUES (v_admin_id, 'info', '📋', '새 의뢰 등록',
            '새로운 의뢰가 등록되었습니다: ' || NEW.title, '/admin/missions', 'admin');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 B: 슬롯 완료 → 기업 알림
CREATE OR REPLACE FUNCTION notify_company_on_slots_full()
RETURNS TRIGGER AS $$
DECLARE v_company_user_id UUID;
BEGIN
  IF NEW.filled_count >= NEW.panel_count AND OLD.filled_count < NEW.panel_count THEN
    SELECT user_id INTO v_company_user_id FROM companies WHERE id = NEW.company_id;
    IF v_company_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
      VALUES (v_company_user_id, 'success', '🎉', '패널 매칭 완료',
              '의뢰 [' || NEW.title || ']의 패널 매칭이 완료됐습니다. 피드백 결과를 기다려주세요.',
              '/company/results?id=' || NEW.id::text, 'company');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
