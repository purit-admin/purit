-- 088_cascade_user_delete.sql
-- 목적: 유저(auth.users) 삭제 시 "Database error deleting user" 해소
-- 원인: auth.users 직접 참조 FK는 모두 CASCADE였으나(087까지 OK),
--       그 아래 2차 사슬(companies/panels/missions → 자식 테이블)의 FK가
--       NO ACTION/SET NULL 이라 연쇄 삭제가 중간에서 막혔음.
--       → 회사/패널/의뢰 row를 자식이 붙잡아 트랜잭션 전체 실패.
-- 처리: 회사·패널·의뢰가 "소유한" 하위 데이터 FK를 ON DELETE CASCADE 로 재정의.
--       (유저 삭제 = 그 회사/패널과 의뢰·피드백·정산·인보이스까지 전부 정리되는 올바른 도메인 동작)
-- 미변경: *_template_id_fkey (→ question_templates) 3개는 의도된 SET NULL 유지
--         (템플릿 삭제가 서브미션 테스트를 지우면 안 됨. question_templates 자체는
--          company_id CASCADE 로 회사와 함께 정리되므로 유저 삭제에는 영향 없음)
-- 실행: Supabase SQL Editor 에서 1회 실행. 재실행 안전(IF EXISTS + 재생성).

-- ─── 1. companies 자식 (NO ACTION → CASCADE) ────────────────────────────────

ALTER TABLE ai_reports DROP CONSTRAINT IF EXISTS ai_reports_company_id_fkey;
ALTER TABLE ai_reports ADD CONSTRAINT ai_reports_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE brand_tracking_campaigns DROP CONSTRAINT IF EXISTS brand_tracking_campaigns_company_id_fkey;
ALTER TABLE brand_tracking_campaigns ADD CONSTRAINT brand_tracking_campaigns_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE cold_email_tests DROP CONSTRAINT IF EXISTS cold_email_tests_company_id_fkey;
ALTER TABLE cold_email_tests ADD CONSTRAINT cold_email_tests_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE icp_pulse_subscriptions DROP CONSTRAINT IF EXISTS icp_pulse_subscriptions_company_id_fkey;
ALTER TABLE icp_pulse_subscriptions ADD CONSTRAINT icp_pulse_subscriptions_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE icp_research DROP CONSTRAINT IF EXISTS icp_research_company_id_fkey;
ALTER TABLE icp_research ADD CONSTRAINT icp_research_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE preference_tests DROP CONSTRAINT IF EXISTS preference_tests_company_id_fkey;
ALTER TABLE preference_tests ADD CONSTRAINT preference_tests_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE pricing_tests DROP CONSTRAINT IF EXISTS pricing_tests_company_id_fkey;
ALTER TABLE pricing_tests ADD CONSTRAINT pricing_tests_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE question_templates DROP CONSTRAINT IF EXISTS question_templates_company_id_fkey;
ALTER TABLE question_templates ADD CONSTRAINT question_templates_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ─── 2. panels 자식 (NO ACTION → CASCADE) ───────────────────────────────────

ALTER TABLE email_responses DROP CONSTRAINT IF EXISTS email_responses_panel_id_fkey;
ALTER TABLE email_responses ADD CONSTRAINT email_responses_panel_id_fkey
  FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE;

ALTER TABLE preference_responses DROP CONSTRAINT IF EXISTS preference_responses_panel_id_fkey;
ALTER TABLE preference_responses ADD CONSTRAINT preference_responses_panel_id_fkey
  FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE;

ALTER TABLE pricing_responses DROP CONSTRAINT IF EXISTS pricing_responses_panel_id_fkey;
ALTER TABLE pricing_responses ADD CONSTRAINT pricing_responses_panel_id_fkey
  FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE;

ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_panel_id_fkey;
ALTER TABLE settlements ADD CONSTRAINT settlements_panel_id_fkey
  FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE;

-- ─── 3. missions 자식 (NO ACTION → CASCADE) ─────────────────────────────────

ALTER TABLE ai_reports DROP CONSTRAINT IF EXISTS ai_reports_mission_id_fkey;
ALTER TABLE ai_reports ADD CONSTRAINT ai_reports_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

-- ─── 4. missions 자식 (SET NULL → CASCADE — 서브미션 응답/설정은 의뢰 소유물) ──

ALTER TABLE cold_email_tests DROP CONSTRAINT IF EXISTS cold_email_tests_mission_id_fkey;
ALTER TABLE cold_email_tests ADD CONSTRAINT cold_email_tests_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

ALTER TABLE email_responses DROP CONSTRAINT IF EXISTS email_responses_mission_id_fkey;
ALTER TABLE email_responses ADD CONSTRAINT email_responses_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

ALTER TABLE preference_responses DROP CONSTRAINT IF EXISTS preference_responses_mission_id_fkey;
ALTER TABLE preference_responses ADD CONSTRAINT preference_responses_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

ALTER TABLE preference_tests DROP CONSTRAINT IF EXISTS preference_tests_mission_id_fkey;
ALTER TABLE preference_tests ADD CONSTRAINT preference_tests_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

ALTER TABLE pricing_responses DROP CONSTRAINT IF EXISTS pricing_responses_mission_id_fkey;
ALTER TABLE pricing_responses ADD CONSTRAINT pricing_responses_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

ALTER TABLE pricing_tests DROP CONSTRAINT IF EXISTS pricing_tests_mission_id_fkey;
ALTER TABLE pricing_tests ADD CONSTRAINT pricing_tests_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

-- ─── 검증: 아래 쿼리가 0행이면(template_id 3개 제외) 완료 ──────────────────────
-- SELECT tc.table_name, kcu.column_name, ccu.table_name AS parent, rc.delete_rule
-- FROM information_schema.referential_constraints rc
-- JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
-- JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
-- JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.constraint_name
-- WHERE tc.table_schema = 'public' AND rc.delete_rule <> 'CASCADE'
--   AND ccu.table_name IN ('companies','panels','missions');
