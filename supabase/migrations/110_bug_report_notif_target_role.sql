-- 110: 버그 신고 알림 target_role 누락 수정
-- 문제: notify_admin_on_bug_report 트리거(버그 신고 INSERT 시 어드민 알림 생성)가
--        notifications INSERT에서 target_role 컬럼을 누락 → NULL로 저장됨.
--        알림센터/사이드바는 .or(target_role.eq.<role>,target_role.is.null)로 조회하므로
--        NULL은 "전 포털 공통"으로 취급 → 어드민 계정이 /panel·/company 포털을 둘러볼 때
--        (어드민은 모든 포털 접근 가능 + 알림 수신자가 본인) 버그 알림이 그쪽 포털에 끼어 보임.
--        ※ 다른 어드민 알림(의뢰·피드백·심사 등)은 모두 target_role='admin'이라 정상 — 이 함수만 누락.
--        ※ 별도 패널/기업 계정은 user_id 불일치로 애초에 안 보임 → 실제 고객 영향 없음(어드민 화면 위생).
-- 해결: INSERT에 target_role='admin' 추가 (다른 어드민 알림과 동일). 함수명 동일·CREATE OR REPLACE라
--        트리거(on_bug_report_insert) 재생성 불필요.
-- ※ 부수: 어드민 수신자 조회를 raw_user_meta_data → raw_app_meta_data로 통일(D-58, 다른 트리거와 일관).
-- ※ 102 본문 유지 + target_role/게이트만 변경.

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
    WHERE raw_app_meta_data->>'role' = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role, read)
    VALUES (
      admin_uid,
      'info',
      '🚩',
      '[' || type_label || '] ' || NEW.title,
      NEW.page_url || ' · ' || CASE NEW.role WHEN 'company' THEN '기업' WHEN 'panel' THEN '패널' ELSE '어드민' END,
      '/admin/reports?id=' || NEW.id::text,
      'admin',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 기존에 target_role=NULL로 잘못 쌓인 버그 신고 알림 정리 (어드민 포털 전용으로 귀속)
UPDATE notifications
SET target_role = 'admin'
WHERE action_url LIKE '/admin/reports%'
  AND target_role IS NULL;
