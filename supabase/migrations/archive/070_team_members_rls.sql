-- 070: team_members 데이터 보정 + RLS 활성화
-- [1] role='member' 잔존 데이터 → 'editor'로 보정 (068 ADD CONSTRAINT 안전망)
UPDATE team_members SET role = 'editor' WHERE role = 'member';

-- [2] RLS 활성화
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- [3] SELECT: 본인 행 OR 같은 company의 오너(user_id로 확인)
DROP POLICY IF EXISTS "team_members_select_own" ON team_members;
CREATE POLICY "team_members_select_own" ON team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- [4] INSERT: 같은 company의 오너만
DROP POLICY IF EXISTS "team_members_insert_owner" ON team_members;
CREATE POLICY "team_members_insert_owner" ON team_members
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- [5] UPDATE: 같은 company의 오너만 (status 변경·제거 등)
DROP POLICY IF EXISTS "team_members_update_owner" ON team_members;
CREATE POLICY "team_members_update_owner" ON team_members
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- [6] DELETE: 같은 company의 오너만
DROP POLICY IF EXISTS "team_members_delete_owner" ON team_members;
CREATE POLICY "team_members_delete_owner" ON team_members
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );
