-- 007_subtest_missions.sql
-- 서브 의뢰 테이블에 mission_id, template_id 추가
-- 서브 의뢰 응답 테이블에 status, mission_id, 추가 점수 컬럼 추가
-- RLS 정책 추가

-- =====================================================
-- 1. 서브 의뢰 테이블에 mission_id, template_id 추가
-- =====================================================

ALTER TABLE preference_tests
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES question_templates(id) ON DELETE SET NULL;

ALTER TABLE pricing_tests
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES question_templates(id) ON DELETE SET NULL;

ALTER TABLE cold_email_tests
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES question_templates(id) ON DELETE SET NULL;

-- =====================================================
-- 2. 서브 의뢰 응답 테이블에 추가 컬럼
-- =====================================================

ALTER TABLE preference_responses
  ADD COLUMN IF NOT EXISTS mission_id  UUID REFERENCES missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS message_clarity  INT CHECK (message_clarity  BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS purchase_intent  INT CHECK (purchase_intent  BETWEEN 1 AND 5);

ALTER TABLE pricing_responses
  ADD COLUMN IF NOT EXISTS mission_id      UUID REFERENCES missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS price_fairness  INT CHECK (price_fairness  BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS value_perception INT CHECK (value_perception BETWEEN 1 AND 5);

ALTER TABLE email_responses
  ADD COLUMN IF NOT EXISTS mission_id    UUID REFERENCES missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS open_intent   INT CHECK (open_intent   BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS curiosity_score INT CHECK (curiosity_score BETWEEN 1 AND 5);

-- =====================================================
-- 3. RLS 정책
-- =====================================================

-- preference_responses
ALTER TABLE preference_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "panel_insert_pref_responses" ON preference_responses;
CREATE POLICY "panel_insert_pref_responses" ON preference_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    panel_id = (SELECT id FROM panels WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_select_pref_responses" ON preference_responses;
CREATE POLICY "auth_select_pref_responses" ON preference_responses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_pref_responses" ON preference_responses;
CREATE POLICY "auth_update_pref_responses" ON preference_responses
  FOR UPDATE TO authenticated USING (true);

-- pricing_responses
ALTER TABLE pricing_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "panel_insert_pricing_responses" ON pricing_responses;
CREATE POLICY "panel_insert_pricing_responses" ON pricing_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    panel_id = (SELECT id FROM panels WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_select_pricing_responses" ON pricing_responses;
CREATE POLICY "auth_select_pricing_responses" ON pricing_responses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_pricing_responses" ON pricing_responses;
CREATE POLICY "auth_update_pricing_responses" ON pricing_responses
  FOR UPDATE TO authenticated USING (true);

-- email_responses
ALTER TABLE email_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "panel_insert_email_responses" ON email_responses;
CREATE POLICY "panel_insert_email_responses" ON email_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    panel_id = (SELECT id FROM panels WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_select_email_responses" ON email_responses;
CREATE POLICY "auth_select_email_responses" ON email_responses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_email_responses" ON email_responses;
CREATE POLICY "auth_update_email_responses" ON email_responses
  FOR UPDATE TO authenticated USING (true);
