-- 074: companies RLS 긴급 수정 — 오너/어드민 정책 추가 + 순환 참조 제거
--
-- 버그 원인 (두 가지 복합):
-- [1] 069에서 companies에 ENABLE ROW LEVEL SECURITY 후 팀원 정책만 추가
--     → 오너/어드민이 자기 회사를 읽지 못해 기업 포털 전체 불통
-- [2] companies ↔ team_members RLS 순환 참조 → 500 에러
--     companies "team_member_can_read_company" → team_members 조회
--     team_members "team_members_select_own"   → companies 조회
--     → PostgreSQL "infinite recursion detected in policy"

-- ── Step 1: companies 오너/어드민 정책 추가 ──────────────────────────────────

-- 오너 SELECT
DROP POLICY IF EXISTS "company_owner_select" ON companies;
CREATE POLICY "company_owner_select" ON companies
  FOR SELECT USING (user_id = auth.uid());

-- 오너 UPDATE
DROP POLICY IF EXISTS "company_owner_update" ON companies;
CREATE POLICY "company_owner_update" ON companies
  FOR UPDATE USING (user_id = auth.uid());

-- 어드민 전체 접근
DROP POLICY IF EXISTS "admin_all_companies" ON companies;
CREATE POLICY "admin_all_companies" ON companies
  FOR ALL USING (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ── Step 2: 순환 참조 제거용 SECURITY DEFINER 함수 ───────────────────────────
-- team_members 정책이 companies를 조회할 때 companies RLS를 우회하도록
-- SECURITY DEFINER 함수를 사용 (postgres 소유 = BYPASSRLS 권한 보유)
-- auth.uid()는 세션 클레임 기반이므로 SECURITY DEFINER 내에서도 정확히 동작함

CREATE OR REPLACE FUNCTION get_my_owned_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM companies WHERE user_id = auth.uid();
$$;

-- ── Step 3: team_members 정책을 SECURITY DEFINER 함수 사용으로 재정의 ─────────
-- company_id IN (SELECT id FROM companies ...) 를
-- company_id IN (SELECT get_my_owned_company_ids()) 로 교체
-- → companies RLS 우회 → 순환 참조 완전 제거

DROP POLICY IF EXISTS "team_members_select_own" ON team_members;
CREATE POLICY "team_members_select_own" ON team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (SELECT get_my_owned_company_ids())
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

DROP POLICY IF EXISTS "team_members_insert_owner" ON team_members;
CREATE POLICY "team_members_insert_owner" ON team_members
  FOR INSERT WITH CHECK (
    company_id IN (SELECT get_my_owned_company_ids())
  );

DROP POLICY IF EXISTS "team_members_update_owner" ON team_members;
CREATE POLICY "team_members_update_owner" ON team_members
  FOR UPDATE USING (
    company_id IN (SELECT get_my_owned_company_ids())
  );

DROP POLICY IF EXISTS "team_members_delete_owner" ON team_members;
CREATE POLICY "team_members_delete_owner" ON team_members
  FOR DELETE USING (
    company_id IN (SELECT get_my_owned_company_ids())
  );
