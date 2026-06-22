-- ============================================================================
-- 119_tighten_sub_responses_select.sql
-- 보안 전수조사 — 서브응답 3종 SELECT 강화 (preference/pricing/email_responses)
-- 최초 작성: 2026-06-22
--
-- [배경] 라이브 pg_policies 확정: 세 테이블 SELECT = USING(true) → 로그인 여부 무관 누구나
--   타사·타인 서브 의뢰 응답(선호·가격·이메일 점수·코멘트·구매의향 등) 전체 열람 가능.
--   (115에서 UPDATE는 본인패널+어드민으로, INSERT는 본인 panel_id로 이미 잠갔고 SELECT만 잔존.)
--   feedbacks(#2, 117)와 정확히 같은 부류 — 동일 정책으로 닫는다.
--
-- [정상 SELECT 경로 — 코드 전수 확인(클라)]
--   · admin   : admin/PurityFilter — .in('mission_id', ids)        → is_caller_admin() 통과
--   · company : company/Dashboard·Results — .in/.eq('mission_id', 자사) → get_my_company_mission_ids() 통과
--   · panel   : panel/ActiveMission(재제출 로드) — .eq('panel_id', 본인) → get_my_panel_id() 통과
--   · 공개경로: ShareResult 는 get_shared_mission(DEFINER) 경유 → RLS 우회·무영향
--   중첩 조인 없음(전부 직접 SELECT).
--
-- [전제] 112 is_caller_admin() · 117 get_my_panel_id()/get_my_company_mission_ids() 적용됨.
-- [클라 영향] 없음 — 위 정상 경로 전부 통과, 타사·타인 열람만 차단.
-- ============================================================================

-- 세 테이블 모두 동일 정책 — 느슨한 SELECT 정책 일괄 DROP 후 본인/자사/어드민 한정.
--   INSERT(본인 panel_id)·UPDATE(115: 본인패널+어드민) 정책은 보존(cmd='SELECT'만 DROP).
DO $$
DECLARE
  t TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['preference_responses','pricing_responses','email_responses']
  LOOP
    -- 1) 기존 SELECT 정책 일괄 DROP (이름 미상 — cmd별 일괄, 115 패턴)
    FOR pol IN
      SELECT policyname FROM pg_policies
       WHERE schemaname='public' AND tablename=t AND cmd='SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- 2) 본인 패널 / 자사 미션 / 어드민 한정 SELECT 정책 재생성
    EXECUTE format($f$
      CREATE POLICY "%1$s_select_own_or_company_or_admin" ON public.%1$I
        FOR SELECT TO authenticated
        USING (
          panel_id = public.get_my_panel_id()
          OR mission_id IN (SELECT public.get_my_company_mission_ids())
          OR public.is_caller_admin()
        )
    $f$, t);
  END LOOP;
END $$;

-- ============================================================================
-- [적용 후 검증 SQL]
--   SELECT tablename, cmd, policyname, qual FROM pg_policies
--    WHERE schemaname='public'
--      AND tablename IN ('preference_responses','pricing_responses','email_responses')
--    ORDER BY tablename, cmd, policyname;
--   기대(각 테이블 SELECT): *_select_own_or_company_or_admin 1개씩
--     qual = panel_id=get_my_panel_id() OR mission_id IN(get_my_company_mission_ids()) OR is_caller_admin()
--     + INSERT(본인 panel_id)·UPDATE(115 본인패널+어드민) 정책 보존, USING(true) 소멸
-- ============================================================================
