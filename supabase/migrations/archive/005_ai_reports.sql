-- AI 리포트 결과 저장 테이블
CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id),
  company_id UUID REFERENCES companies(id),
  tldr TEXT,
  priority_fixes JSONB DEFAULT '[]',
  strengths JSONB DEFAULT '[]',
  risk_flags JSONB DEFAULT '[]',
  overall_score NUMERIC(3,2),
  panel_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

-- 자신의 회사 리포트만 조회 가능 (admin 포함)
CREATE POLICY "company can read own ai_reports" ON ai_reports
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

-- Edge Function(서비스 롤)이 INSERT 가능하도록 (RLS bypass)
CREATE POLICY "service role can insert ai_reports" ON ai_reports
  FOR INSERT WITH CHECK (true);
