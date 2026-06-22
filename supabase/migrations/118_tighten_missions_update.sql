-- ============================================================================
-- 118_tighten_missions_update.sql
-- 보안 전수조사 — missions UPDATE 전면 개방 차단 (라이브 pg_policies 검증으로 신규 발견)
-- 최초 작성: 2026-06-22
--
-- [배경] 117 적용 후 운영 DB pg_policies 재확인 중 발견 (인계 §4 요약엔 없던 갭):
--   missions 에 UPDATE 정책이 3개 공존했고 그 중 둘이 느슨:
--     · missions_update          USING (true)                       ← 전면 개방
--     · missions_update_company  USING (auth.role()='authenticated') ← 로그인 전원
--     · missions_company (ALL)   USING (company_id IN 자사)           ← 정상(자사)
--   RLS는 같은 cmd 정책을 OR 결합 → true 가 이김 → 로그인한 누구나(아무 패널·기업)가
--   모든 미션의 비보호 컬럼(title·persona·description·status·reward_amount·share_token·
--   share_permissions 등)을 변조 가능. (092/115 트리거는 결제/체험 컬럼만 보호.)
--
-- [정상 UPDATE 경로 — 코드 전수 확인]
--   · company : NewMission·PreferenceTest·PricingTest·ColdEmailTest·Dashboard·Results 의
--               dismissed·status·draft payload·activate·share_token·share_permissions
--               → 전부 자사(company_id) 미션. get_my_company_ids() 통과.
--   · admin   : admin/Missions(status 변경)·admin/TrialMissions(취소·재개) 직접 UPDATE
--               → is_caller_admin() 통과. (완료·환불 등은 DEFINER RPC라 RLS 우회·무관.)
--   · panel   : missions UPDATE 경로 전무 → 차단되는 것이 정상.
--
-- [전제] 112 is_caller_admin() · 117 get_my_company_ids() 가 운영 DB에 적용돼 있어야 함.
-- [클라 영향] 없음 — 위 정상 경로 전부 통과, 권한 없는 변조만 차단.
-- ============================================================================

-- ── 느슨한 missions UPDATE 정책 일괄 DROP 후 자사/어드민 한정 단일 정책 ──────────────
--   ALL 정책(missions_company)·INSERT·SELECT 정책은 보존(cmd='UPDATE' 만 DROP).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='missions' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.missions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "missions_update_own_or_admin" ON public.missions
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.get_my_company_ids())
    OR public.is_caller_admin()
  )
  WITH CHECK (
    company_id IN (SELECT public.get_my_company_ids())
    OR public.is_caller_admin()
  );

-- ============================================================================
-- [적용 후 검증 SQL]
--   SELECT cmd, policyname, qual, with_check FROM pg_policies
--    WHERE schemaname='public' AND tablename='missions' ORDER BY cmd, policyname;
--   기대(UPDATE): missions_update_own_or_admin 1개만 (true/authenticated 정책 소멸)
--                 + missions_company(ALL, 자사)·missions_insert_company·
--                   missions_select_active_or_own_or_admin 보존
-- ============================================================================
