-- 026_fix_rls_user_metadata.sql
-- RLS 정책의 user_metadata 참조를 app_metadata로 교체
-- user_metadata는 유저 본인이 수정 가능하므로 보안 컨텍스트에서 사용 금지
-- app_metadata는 service role만 수정 가능 → 신뢰 가능한 역할 판별

-- ── Step 1: 어드민 계정 app_metadata에 role 복사 ─────────────────────────────
-- 기존 user_metadata.role='admin' 계정에 app_metadata.role='admin' 추가
-- (프론트엔드는 계속 user_metadata 읽으므로 기존 동작 영향 없음)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE raw_user_meta_data->>'role' = 'admin';

-- ── Step 2: ai_reports RLS 수정 ───────────────────────────────────────────────
DROP POLICY IF EXISTS "company can read own ai_reports" ON ai_reports;
CREATE POLICY "company can read own ai_reports" ON ai_reports
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ── Step 3: feedback_annotations 어드민 RLS 수정 ─────────────────────────────
DROP POLICY IF EXISTS "admin_read_annotations" ON feedback_annotations;
CREATE POLICY "admin_read_annotations" ON feedback_annotations
  FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- ── Step 4: feedback_helpfulness_ratings 어드민 RLS 수정 ─────────────────────
DROP POLICY IF EXISTS "fhr_admin_all" ON feedback_helpfulness_ratings;
CREATE POLICY "fhr_admin_all" ON feedback_helpfulness_ratings
  FOR ALL
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- ── Step 5: bug_reports 어드민 RLS 수정 ──────────────────────────────────────
DROP POLICY IF EXISTS "bug_reports_admin_select" ON bug_reports;
CREATE POLICY "bug_reports_admin_select" ON bug_reports
  FOR SELECT USING (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

DROP POLICY IF EXISTS "bug_reports_admin_update" ON bug_reports;
CREATE POLICY "bug_reports_admin_update" ON bug_reports
  FOR UPDATE USING (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );
