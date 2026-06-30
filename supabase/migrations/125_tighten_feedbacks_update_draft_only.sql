-- ============================================================================
-- 125_tighten_feedbacks_update_draft_only.sql
-- feedbacks UPDATE RLS 강화 — 패널은 'draft'(작성중) 상태인 본인 피드백만 수정 가능
-- 최초 작성: 2026-06-30 (니체 관찰-10)
--
-- [배경] 117의 feedbacks_update_own_or_admin 정책은
--     USING/WITH CHECK = (panel_id = get_my_panel_id() OR is_caller_admin())
--   로, 패널이 '본인 행'이면 status 무관하게 UPDATE 허용.
--   112/114 트리거가 purity_passed·payout_amount·rejection_penalty_applied 는
--   보호하지만 점수(clarity_score 등)·코멘트(suggestions)는 비보호 →
--   패널이 콘솔/REST로 '이미 승인(approved)된 본인 피드백'의 점수·코멘트를
--   사후 변조해 기업 결과 화면 표시를 오염시킬 여지가 있었음(클라 UI 없음·금전 무관·저위험).
--
-- [정상 경로 보존 — 패널의 모든 직접 UPDATE는 'draft'에서만 발생]
--   · 자동저장(ActiveMission strengths UPDATE)  : status='draft'
--   · 제출(draft → 'submitted')                 : USING은 OLD='draft' 통과, WITH CHECK는 'submitted' 허용
--   · 반려 후 재작성                            : reaccept_rejected_feedback(DEFINER)가 rejected→draft로
--                                                 되돌린 뒤 편집 → RLS 우회(postgres) + 이후 draft 편집 통과
--   · 어드민 승인/반려/취소                      : 어드민 client → is_caller_admin() 통과(status 무관)
--   · accept_mission_slot·cancel_panel_feedback 등 DEFINER RPC : postgres 실행 → RLS 우회
--   ⇒ 클라이언트 코드 무변경. 'submitted'/'approved'/'rejected' 행의 패널 직접 UPDATE만 차단.
--
-- [전제] 112의 is_caller_admin(), 117의 get_my_panel_id() 헬퍼가 운영 DB에 적용돼 있어야 함.
-- ============================================================================

-- 기존 UPDATE 정책 일괄 DROP (이름 무관 안전 — 115/117 패턴)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='feedbacks' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.feedbacks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "feedbacks_update_own_draft_or_admin" ON public.feedbacks
  FOR UPDATE TO authenticated
  USING (
    (panel_id = public.get_my_panel_id() AND status = 'draft')
    OR public.is_caller_admin()
  )
  WITH CHECK (
    (panel_id = public.get_my_panel_id() AND status IN ('draft', 'submitted'))
    OR public.is_caller_admin()
  );

-- 검증용(수동): 패널 세션에서 approved 본인 피드백 UPDATE 시 0행(차단), draft는 정상.
--   SELECT policyname, qual, with_check FROM pg_policies
--    WHERE tablename='feedbacks' AND cmd='UPDATE';
