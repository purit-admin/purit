-- 102: 어드민 알림 딥링크 보강
-- 문제: 어드민 알림들이 action_url에 대상 id를 싣지 않아 클릭 시 페이지만 이동하고
--        해당 의뢰/피드백/패널로 포커스되지 않음. 수신 페이지는 딥링크를 지원함(또는 동반 추가):
--          · admin/Missions.jsx        → ?missionId=<id>  (탭 전환 + 하이라이트 + 스크롤)
--          · admin/PurityFilter.jsx    → ?feedbackId=<id> (본 마이그레이션 동반 프론트 변경에서 쿼리 수신 추가)
--          · admin/PanelManagement.jsx → ?panelId=<id>    (본 마이그레이션 동반 프론트 변경에서 쿼리 수신 추가)
--          · admin/BugReports.jsx      → ?id=<id>         (본 마이그레이션 동반 프론트 변경에서 쿼리 수신 추가)
-- 해결: 발송측 트리거/RPC의 action_url에 대상 id를 부착.
--   1) notify_admin_on_mission           : 새 의뢰 등록 → /admin/missions?missionId=<NEW.id>
--   2) notify_company_on_slots_full       : 패널 수집 완료 → /admin/missions?missionId=<NEW.id>
--   3) notify_admin_on_feedback_submitted : 피드백 제출/재제출 → /admin/purity?feedbackId=<id>
--      (p_feedback_id 파라미터 신규 추가 — 시그니처 변경이라 DROP 후 재생성 + GRANT 재부여)
--   4) notify_admin_on_new_panel          : 새 패널 심사 대기 → /admin/panels?panelId=<NEW.id>
--   5) notify_admin_on_panel_resubmit     : 패널 서류 재제출 → /admin/panels?panelId=<NEW.id>
--   6) notify_admin_on_bug_report         : 버그/이의신청 접수 → /admin/reports?id=<NEW.id>
-- ※ 무료체험 첫 의뢰(/admin/trials?id=)·조기 종료(/admin/missions?missionId=)는 기존 정상 → 변경 없음.
-- ※ 각 함수 본문은 최신 정의(085 / 033 / 073 / 062 / 082 / 083)를 그대로 유지하고 action_url만 변경.
-- ※ 4)5)6)은 트리거 함수(RETURNS TRIGGER) — 함수명 동일·CREATE OR REPLACE라 기존 트리거 재생성 불필요.

-- ──────────────────────────────────────────────────────────
-- 1. notify_admin_on_mission (085 본문 유지, ELSE 분기 action_url에 missionId 부착)
--    missions INSERT 트리거 + draft→active 트리거(029)가 공유하는 함수
-- ──────────────────────────────────────────────────────────
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
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
      VALUES (v_admin_id, 'warning', '🔥', '[무료체험] 첫 의뢰 — 즉시 대응 필요',
              '무료체험 기업 첫 의뢰: ' || NEW.title || ' — 전문가 패널 슬롯 선점이 필요합니다.',
              '/admin/trials?id=' || NEW.id::text, 'admin');
    END LOOP;
  ELSE
    SELECT id INTO v_admin_id FROM auth.users
    WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1;
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

-- ──────────────────────────────────────────────────────────
-- 2. notify_company_on_slots_full (033 본문 유지, action_url에 missionId 부착)
-- ──────────────────────────────────────────────────────────
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
        '/admin/missions?missionId=' || NEW.id::text,
        'admin',
        false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3. notify_admin_on_feedback_submitted (073 본문 유지 + p_feedback_id 추가)
--    action_url에 feedbackId 부착 → PurityFilter 해당 피드백 직행
--    시그니처 변경(파라미터 추가)이므로 기존 2-param 함수 DROP 후 재생성
-- ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS notify_admin_on_feedback_submitted(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION notify_admin_on_feedback_submitted(
  p_mission_id  UUID,
  p_is_resubmit BOOLEAN DEFAULT false,
  p_feedback_id UUID    DEFAULT NULL
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
  v_action_url    TEXT;
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

  -- 피드백 id가 있으면 해당 피드백으로 직행, 없으면(레거시 호출) 피드백 관리 첫 화면
  IF p_feedback_id IS NOT NULL THEN
    v_action_url := '/admin/purity?feedbackId=' || p_feedback_id::text;
  ELSE
    v_action_url := '/admin/purity';
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
      v_action_url,
      'admin'
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_admin_on_feedback_submitted(UUID, BOOLEAN, UUID) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 4. notify_admin_on_new_panel (062 본문 유지, action_url에 panelId 부착)
--    트리거 on_panel_pending_created(AFTER INSERT)가 호출 — 함수명 동일이라 트리거 재생성 불필요
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_panel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_panel_name TEXT;
BEGIN
  -- status='pending' INSERT에만 발화
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  v_panel_name := COALESCE(NEW.name, '(이름 없음)');

  -- 어드민 user_id 조회 (app_metadata 기준 — D-58 준수)
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE raw_app_meta_data->>'role' = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, icon, title, body, action_url, target_role, read
  ) VALUES (
    v_admin_id,
    'info',
    '👤',
    '새 패널 심사 대기',
    v_panel_name || '님이 패널로 가입했습니다. 검증 서류를 확인하고 승인해 주세요.',
    '/admin/panels?panelId=' || NEW.id::text,
    'admin',
    false
  );

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 5. notify_admin_on_panel_resubmit (082 본문 유지, action_url에 panelId 부착)
--    트리거 on_panel_resubmit(AFTER UPDATE OF status)가 호출 — 함수명 동일이라 트리거 재생성 불필요
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_on_panel_resubmit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_panel_name TEXT;
BEGIN
  -- 반려(rejected) → 재제출(pending) 전환에만 발화
  IF NOT (OLD.status = 'rejected' AND NEW.status = 'pending') THEN
    RETURN NEW;
  END IF;

  v_panel_name := COALESCE(NEW.name, '(이름 없음)');

  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE raw_app_meta_data->>'role' = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, icon, title, body, action_url, target_role, read
  ) VALUES (
    v_admin_id,
    'info',
    '🔁',
    '패널 서류 재제출',
    v_panel_name || '님이 검증 서류를 재제출했습니다. 재심사를 진행해 주세요.',
    '/admin/panels?panelId=' || NEW.id::text,
    'admin',
    false
  );

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 6. notify_admin_on_bug_report (083 본문 유지, action_url에 리포트 id 부착)
--    트리거 on_bug_report_insert(AFTER INSERT)가 호출 — 함수명 동일이라 트리거 재생성 불필요
--    NEW.id = bug_reports.id → admin/BugReports ?id 수신으로 해당 신고 직행
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_admin_on_bug_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_uid UUID;
  type_label TEXT;
BEGIN
  type_label := CASE NEW.type
    WHEN 'bug'     THEN '🐛 버그/오류'
    WHEN 'ux'      THEN '😕 UX 불편'
    WHEN 'data'    THEN '📊 데이터 이상'
    WHEN 'feature' THEN '💡 기능 제안'
    WHEN 'appeal'  THEN '⚖️ 이의 신청'
    ELSE '기타'
  END;

  FOR admin_uid IN
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'role' = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, icon, title, body, action_url, read)
    VALUES (
      admin_uid,
      'info',
      '🚩',
      '[' || type_label || '] ' || NEW.title,
      NEW.page_url || ' · ' || CASE NEW.role WHEN 'company' THEN '기업' WHEN 'panel' THEN '패널' ELSE '어드민' END,
      '/admin/reports?id=' || NEW.id::text,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;
