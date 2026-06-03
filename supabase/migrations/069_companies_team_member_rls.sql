-- 069: companies 테이블에 팀원 SELECT 정책 추가
-- 기존 오너/어드민 정책은 그대로 유지하고 팀원 전용 정책만 추가
-- PostgreSQL 허용적 정책(PERMISSIVE)은 OR로 합산됨

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_member_can_read_company" ON companies;
CREATE POLICY "team_member_can_read_company" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.company_id = companies.id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );
