-- 022_bug_reports.sql
-- 버그/피드백 리포트 시스템

CREATE TABLE bug_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  user_id       UUID        NOT NULL    REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL    CHECK (role IN ('company', 'panel', 'admin')),
  type          TEXT        NOT NULL    CHECK (type IN ('bug', 'ux', 'data', 'feature', 'other')),
  page_url      TEXT        NOT NULL    DEFAULT '',
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  screenshot_url TEXT,
  status        TEXT        NOT NULL    DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'dismissed')),
  admin_memo    TEXT
);

CREATE INDEX bug_reports_status_idx ON bug_reports (status);
CREATE INDEX bug_reports_created_at_idx ON bug_reports (created_at DESC);

-- RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- 본인만 INSERT 가능
CREATE POLICY "bug_reports_insert" ON bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인은 자신의 리포트 조회 가능
CREATE POLICY "bug_reports_select_own" ON bug_reports
  FOR SELECT USING (auth.uid() = user_id);

-- 어드민은 전체 조회 + 상태/메모 UPDATE 가능
CREATE POLICY "bug_reports_admin_select" ON bug_reports
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );

CREATE POLICY "bug_reports_admin_update" ON bug_reports
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );

-- 새 리포트 제출 시 모든 어드민에게 알림 자동 발송 트리거
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

CREATE TRIGGER on_bug_report_insert
  AFTER INSERT ON bug_reports
  FOR EACH ROW EXECUTE FUNCTION notify_admin_on_bug_report();

-- 참고: Supabase 대시보드에서 'bug-screenshots' Storage 버킷을 public으로 생성해야 스크린샷 첨부가 동작합니다.
