-- 013_custom_question_rls.sql
-- question_templates / template_questions RLS 활성화
-- 기업이 자신의 커스텀 질문 템플릿을 INSERT / DELETE 할 수 있도록 정책 추가

ALTER TABLE question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_questions ENABLE ROW LEVEL SECURITY;

-- ── question_templates ────────────────────────────────────────
DROP POLICY IF EXISTS "qt_select" ON question_templates;
CREATE POLICY "qt_select" ON question_templates
  FOR SELECT USING (
    is_default = true
    OR company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "qt_insert" ON question_templates;
CREATE POLICY "qt_insert" ON question_templates
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "qt_update" ON question_templates;
CREATE POLICY "qt_update" ON question_templates
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "qt_delete" ON question_templates;
CREATE POLICY "qt_delete" ON question_templates
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );

-- ── template_questions ───────────────────────────────────────
DROP POLICY IF EXISTS "tq_select" ON template_questions;
CREATE POLICY "tq_select" ON template_questions
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM question_templates
      WHERE is_default = true
        OR company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "tq_insert" ON template_questions;
CREATE POLICY "tq_insert" ON template_questions
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM question_templates
      WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "tq_delete" ON template_questions;
CREATE POLICY "tq_delete" ON template_questions
  FOR DELETE USING (
    template_id IN (
      SELECT id FROM question_templates
      WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    )
  );
