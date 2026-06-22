-- ============================================================================
-- 117_tighten_feedbacks_missions_select.sql
-- 보안 전수조사 2·3단계 (한 묶음) — feedbacks 읽기/쓰기 + missions 읽기 RLS 강화
-- 최초 작성: 2026-06-22
--
-- [배경] 라이브 pg_policies 검증(2026-06-18) 확정 갭:
--   · feedbacks SELECT = (auth.role()='authenticated')  → 로그인만 하면 전체 피드백
--       (점수·정산액 payout_amount·panel_id·코멘트·suggestions) 열람 가능. (#2)
--   · feedbacks UPDATE = (auth.role()='authenticated')  → 타인 피드백의 비보호 컬럼
--       (점수·코멘트·suggestions) 임의 변조 가능. 112/114 트리거는 purity_passed·
--       payout_amount 만 보호하므로 나머지 컬럼은 무방비. (#3)
--   · missions  SELECT = true (+authenticated)           → 타사 의뢰(초안 포함)·페르소나·
--       가격전략·결제 컬럼 열람 가능. (#4)
--
-- [왜 2·3단계를 한 마이그레이션으로 묶나]
--   feedbacks 정책 ↔ missions 정책이 서로의 테이블을 참조한다(상호 의존).
--   개별로 좁히면 중간 상태에서 패널 화면의 feedbacks→missions 중첩 조인이 깨질 수 있음.
--   → 함께 적용하고, 모든 교차 참조를 SECURITY DEFINER 헬퍼(RLS 우회)로 빼내
--     정책 평가 중 다른 테이블 RLS를 건드리지 않게 하여 무한 재귀를 원천 차단한다. (P4)
--
-- [전제] 112의 is_caller_admin() 헬퍼가 운영 DB에 적용돼 있어야 함(확인됨).
--
-- [클라 영향] 없음 — 정상 읽기/쓰기 경로(아래 매핑)는 전부 새 정책을 통과한다.
--   · company : 모든 feedbacks/missions 읽기가 자사(company_id) 한정 → get_my_company_* 통과.
--               단건 편집 무필터 select(NewMission 등)도 자사면 통과, 타사면 차단(IDOR 부수 차단).
--   · panel   : feedbacks 읽기·쓰기 모두 본인 panel_id 한정 → get_my_panel_id 통과.
--               missions 읽기 = active 목록 / 본인 피드백 달린 미션 / 단건 상세(active|본인피드백) → 통과.
--   · admin   : 무필터 전체 읽기 + 승인/반려 UPDATE → is_caller_admin() 통과.
--   · 공개경로: get_shared_mission(DEFINER)·get_panel_public_profiles(DEFINER)는 RLS 우회 → 무영향.
-- ============================================================================

-- ── Step 1: 교차 참조용 SECURITY DEFINER 헬퍼 (RLS 우회 = 정책 간 재귀 차단) ───────────
--   모두 STABLE·SECURITY DEFINER·search_path 고정. auth.uid()는 DEFINER 안에서도
--   "원래 호출자"의 uid를 정확히 반환한다(074 get_my_owned_company_ids 패턴과 동일).

-- 내 패널 id (없으면 NULL → 어떤 행과도 매칭 안 됨)
CREATE OR REPLACE FUNCTION public.get_my_panel_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM panels WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 내가 오너 OR 활성 팀원인 회사 id 집합
--   (074 get_my_owned_company_ids 는 오너만 — 팀 기능 휴면 경로까지 보장하려 팀원 포함)
CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM companies WHERE user_id = auth.uid()
  UNION
  SELECT company_id FROM team_members
   WHERE user_id = auth.uid() AND status = 'active';
$$;

-- 내 회사들이 소유한 미션 id 집합 (feedbacks.mission_id 매칭용)
CREATE OR REPLACE FUNCTION public.get_my_company_mission_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM missions
   WHERE company_id IN (SELECT public.get_my_company_ids());
$$;

-- 내 패널의 피드백이 존재하는 미션 id 집합 (패널이 참여한 타사 미션 정보 조인용)
CREATE OR REPLACE FUNCTION public.get_my_feedback_mission_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT mission_id FROM feedbacks
   WHERE panel_id = public.get_my_panel_id();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_panel_id()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_company_ids()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_company_mission_ids()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_feedback_mission_ids()  TO authenticated;

-- ── Step 2: feedbacks — 느슨한 SELECT/UPDATE 정책 일괄 DROP 후 본인/자사/어드민 한정 ──
--   정책 이름이 대시보드 수동 생성이라 미상 → cmd별 DO 블록 일괄 DROP (115 패턴).
--   INSERT 정책(feedbacks_insert, 114 트리거가 컬럼 보호)은 보존.
--   ALL 정책이 있더라도 cmd='SELECT'/'UPDATE' 필터엔 안 걸리므로(=cmd='ALL') 무관.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='feedbacks' AND cmd IN ('SELECT','UPDATE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.feedbacks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "feedbacks_select_own_or_company_or_admin" ON public.feedbacks
  FOR SELECT TO authenticated
  USING (
    panel_id = public.get_my_panel_id()
    OR mission_id IN (SELECT public.get_my_company_mission_ids())
    OR public.is_caller_admin()
  );

CREATE POLICY "feedbacks_update_own_or_admin" ON public.feedbacks
  FOR UPDATE TO authenticated
  USING (
    panel_id = public.get_my_panel_id()
    OR public.is_caller_admin()
  )
  WITH CHECK (
    panel_id = public.get_my_panel_id()
    OR public.is_caller_admin()
  );

-- ── Step 3: missions — 느슨한 SELECT 정책 일괄 DROP 후 공개(active)/자사/본인피드백/어드민 ──
--   ALL 정책(company_id 소유 — 쓰기 포함)·INSERT 정책은 보존(cmd='ALL'/'INSERT' → 미DROP).
--   status='active' 공개는 모집 둘러보기·수락 상세를 위한 의도된 노출(현 true 보다 강한 제한).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='missions' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.missions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "missions_select_active_or_own_or_admin" ON public.missions
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR company_id IN (SELECT public.get_my_company_ids())
    OR id IN (SELECT public.get_my_feedback_mission_ids())
    OR public.is_caller_admin()
  );

-- ============================================================================
-- [적용 후 검증 SQL — SQL Editor에서 실행해 확인]
--   SELECT tablename, cmd, policyname, qual, with_check FROM pg_policies
--    WHERE schemaname='public' AND tablename IN ('feedbacks','missions')
--    ORDER BY tablename, cmd, policyname;
--   기대:
--     feedbacks SELECT = feedbacks_select_own_or_company_or_admin (본인/자사/어드민)
--     feedbacks UPDATE = feedbacks_update_own_or_admin            (본인/어드민)
--     feedbacks INSERT = feedbacks_insert (보존)
--     missions  SELECT = missions_select_active_or_own_or_admin
--     missions  ALL/INSERT = 기존 company_id 소유 정책 보존
-- ============================================================================
