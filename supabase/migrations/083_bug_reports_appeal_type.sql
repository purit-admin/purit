-- 083_bug_reports_appeal_type.sql
-- 버그: bug_reports.type CHECK 제약에 'appeal'(⚖️ 이의 신청)이 누락되어
--       BugReportModal에서 이의 신청 제출 시 CHECK 위반 → INSERT 실패(저장 0건).
--       거절/차단 패널의 "이의 신청 → 어드민 답변" 흐름의 첫 단계가 막혀 있었음 (QA 니체-RJ-C).
-- 수정: (1) type CHECK 제약에 'appeal' 추가
--       (2) notify_admin_on_bug_report 트리거의 type_label CASE에 'appeal' 분기 추가
--           (기존엔 appeal 제출 시 알림 제목이 '기타'로 표기되던 부수 문제)

-- ① type CHECK 제약 교체 ('appeal' 추가)
ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_type_check;
ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_type_check
  CHECK (type IN ('bug', 'ux', 'data', 'feature', 'appeal', 'other'));

-- ② 알림 트리거 함수 재정의 — type_label에 appeal 라벨 추가 (022 본문 유지 + 1줄 추가)
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
      '/admin/reports',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;
