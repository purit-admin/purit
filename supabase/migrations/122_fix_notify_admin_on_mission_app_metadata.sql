-- 122: notify_admin_on_mission 어드민 수신자 조회 user_metadata → app_metadata (D-58 잔존 패치)
-- 문제: 102의 notify_admin_on_mission()이 어드민 알림 수신자를 raw_user_meta_data->>'role'='admin'로 조회.
--        user_metadata는 사용자가 supabase.auth.updateUser({data:{role:'admin'}})로 위조 가능(D-58).
--        일반 기업/패널이 role='admin'을 위조하면 새 의뢰/무료체험 첫 의뢰 알림(의뢰 제목 등 운영 정보)을
--        본인이 수신하게 됨. (권한상승 아님 — 정보 노출 한정·저심각)
-- 근거: 형제 함수(notify_company_on_slots_full:68·notify_admin_on_feedback_submitted·new_panel·panel_resubmit)와
--        notify_admin_on_bug_report(110에서 수정)는 전부 raw_app_meta_data를 쓰는데 이 함수만 누락(니체-SEC-A).
-- 해결: 35행·44행의 raw_user_meta_data → raw_app_meta_data (app_metadata는 서버만 설정, 위조 불가).
--        102 함수 본문 100% 유지(action_url·문구·target_role 불변), 어드민 조회 조건만 교체.
--        CREATE OR REPLACE라 트리거(missions INSERT + draft→active 029) 재생성 불필요. 순수 SQL·프론트 무변경.

CREATE OR REPLACE FUNCTION notify_admin_on_mission()
RETURNS TRIGGER AS $$
DECLARE v_admin_id UUID;
BEGIN
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_free_trial THEN
    -- 무료체험 첫 의뢰: 전 어드민에게 강한 알림 (전문가 슬롯 선점 필요)
    FOR v_admin_id IN
      SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
      VALUES (v_admin_id, 'warning', '🔥', '[무료체험] 첫 의뢰 — 즉시 대응 필요',
              '무료체험 기업 첫 의뢰: ' || NEW.title || ' — 전문가 패널 슬롯 선점이 필요합니다.',
              '/admin/trials?id=' || NEW.id::text, 'admin');
    END LOOP;
  ELSE
    SELECT id INTO v_admin_id FROM auth.users
    WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1;
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
      VALUES (v_admin_id, 'info', '📋', '새 의뢰 등록',
              '새로운 의뢰가 등록되었습니다: ' || NEW.title,
              '/admin/missions?missionId=' || NEW.id::text, 'admin');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
