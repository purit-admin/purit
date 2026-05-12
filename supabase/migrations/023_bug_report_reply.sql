-- 023_bug_report_reply.sql
-- 관리자 공개 답글 컬럼 추가
-- RLS 변경 불필요: 기존 bug_reports_select_own(사용자 본인 SELECT) 및
-- bug_reports_admin_update(어드민 UPDATE) 정책이 새 컬럼을 자동 포함

ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS admin_reply  TEXT,
  ADD COLUMN IF NOT EXISTS replied_at   TIMESTAMPTZ;
