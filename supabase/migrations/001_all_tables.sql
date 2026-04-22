-- ============================================================
-- PURIT — 전체 신규 테이블 마이그레이션
-- 실행 순서: 이 파일 하나를 Supabase SQL Editor에서 실행
-- ============================================================

-- P1: 어드민 Revenue
CREATE TABLE IF NOT EXISTS gmv_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_label text NOT NULL,
  year int NOT NULL,
  month_num int NOT NULL,
  gmv numeric NOT NULL DEFAULT 0,
  panel_pay numeric NOT NULL DEFAULT 0,
  margin numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid REFERENCES panels(id),
  panel_name text NOT NULL,
  tier text NOT NULL,
  missions_count int DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  company_name text NOT NULL,
  plan text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  invoice_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- P2: 알림
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('success','warning','info')),
  icon text,
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);

-- P3: 팀 멤버
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text,
  email text NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin','member','viewer')),
  status text DEFAULT 'active' CHECK (status IN ('active','invited','inactive')),
  joined_at date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- P6: 질문 템플릿
CREATE TABLE IF NOT EXISTS question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  name text NOT NULL,
  icon text,
  category text,
  description text,
  use_count int DEFAULT 0,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS template_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES question_templates(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_order int DEFAULT 0
);

-- P7: 선호도 테스트
CREATE TABLE IF NOT EXISTS preference_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  asset_type text NOT NULL,
  variant_a text NOT NULL,
  variant_b text NOT NULL,
  panel_size int DEFAULT 10,
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preference_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES preference_tests(id) ON DELETE CASCADE,
  panel_id uuid REFERENCES panels(id),
  preference text CHECK (preference IN ('A','B')),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- P8: 가격 테스트
CREATE TABLE IF NOT EXISTS pricing_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_axes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES pricing_tests(id) ON DELETE CASCADE,
  axis_key text NOT NULL,
  label text,
  score numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pricing_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES pricing_tests(id) ON DELETE CASCADE,
  panel_id uuid REFERENCES panels(id),
  tier text,
  would_buy boolean,
  key_comment text,
  barriers jsonb DEFAULT '[]'
);

-- P9: 콜드메일 테스트
CREATE TABLE IF NOT EXISTS cold_email_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  email_text text NOT NULL,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES cold_email_tests(id) ON DELETE CASCADE,
  panel_id uuid REFERENCES panels(id),
  would_reply boolean,
  hook_score int,
  clarity_score int,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- P10: ICP 리서치
CREATE TABLE IF NOT EXISTS icp_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  persona_name text,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS icp_pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid REFERENCES icp_research(id) ON DELETE CASCADE,
  pain_text text NOT NULL,
  percent numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS icp_buy_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid REFERENCES icp_research(id) ON DELETE CASCADE,
  trigger_text text NOT NULL,
  percent numeric DEFAULT 0,
  priority_rank int
);

CREATE TABLE IF NOT EXISTS icp_language (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid REFERENCES icp_research(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  frequency text CHECK (frequency IN ('high','mid','low'))
);

-- P11: ICP Pulse
CREATE TABLE IF NOT EXISTS icp_pulse_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  panel_size int DEFAULT 20,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS icp_pulse_quarters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES icp_pulse_subscriptions(id) ON DELETE CASCADE,
  quarter_label text NOT NULL,
  buying_trigger text,
  top_channel text,
  collected_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS icp_pulse_pains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter_id uuid REFERENCES icp_pulse_quarters(id) ON DELETE CASCADE,
  pain_text text NOT NULL,
  frequency_percent numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS icp_pulse_gains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter_id uuid REFERENCES icp_pulse_quarters(id) ON DELETE CASCADE,
  gain_text text NOT NULL,
  frequency_percent numeric DEFAULT 0
);

-- P12: 브랜드 추적
CREATE TABLE IF NOT EXISTS brand_tracking_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  panel_size int DEFAULT 30,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_tracking_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES brand_tracking_campaigns(id) ON DELETE CASCADE,
  month_label text NOT NULL,
  awareness_percent numeric DEFAULT 0,
  clarity_score numeric DEFAULT 0,
  differentiation_score numeric DEFAULT 0,
  nps_score numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS brand_perception_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES brand_tracking_campaigns(id) ON DELETE CASCADE,
  statement text NOT NULL,
  agreement_percent numeric DEFAULT 0
);
