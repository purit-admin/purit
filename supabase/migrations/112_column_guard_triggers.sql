-- 112_column_guard_triggers.sql
-- feedbacks / panels / companies 의 권한·정산 컬럼 직접 조작 차단 (니체-SEC 전수조사, D-144 계열)
--
--  배경: RLS는 "행" 단위만 막고 "컬럼"은 제한 못 함(D-144). 이 세 테이블의 UPDATE 정책은
--    feedbacks=인증된 전체 / panels=본인 / companies=본인(오너) 로 열려 있고(대시보드 수동 관리,
--    3_Error_Log D-1), missions(092)와 달리 컬럼 가드 트리거가 없었음 → 클라(콘솔/REST)에서:
--    · 패널이 자기 피드백에 purity_passed=true·payout_amount=99999 직접 set → 정산 사기 (니체-SEC-피드백)
--    · 패널이 자기 panels 행에 honor_points/is_expert/experience set → 정산 배율·언락비용 조작 (니체-SEC-패널)
--    · 기업이 자기 companies 행에 credit_balance/plan/free_trial_used set → 크레딧 조작 (수평전개)
--
--  해결: 092 패턴(BEFORE UPDATE, SECURITY INVOKER, current_user 로 클라 직접 vs RPC 판별)을 그대로 따르되,
--    어드민 client 직접 쓰기(PurityFilter 승인/반려·PanelManagement 상태변경)는 is_caller_admin()으로 통과 →
--    클라이언트 코드 재작성 불필요. 정상 갱신 경로는 전부 통과함:
--      · SECURITY DEFINER RPC (add_panel_honor_points·reject/restore_feedback_honor·recalc_panel_trust_score 트리거·
--        admin_confirm_panel_experience·auto_increment_panel_experience·increment_panel_mission_count·
--        check_and_award_badges·grant_plan_credits·purchase_credits·admin_change_plan·reserve/complete/unlock 등)
--        → current_user = 함수 소유자(≠ authenticated/anon) → 가드 스킵
--      · 어드민 client 직접 UPDATE → is_caller_admin() = true → 통과
--      · 패널 본인 정상 쓰기(avatar_emoji/avatar_color/selected_badge/notif_prefs/phone) → 보호 컬럼 아님 → 통과
--      · 패널 피드백 제출(purity_passed=false·status='submitted'·점수) → purity_passed→true 아님 → 통과
--      · 기업 본인 정상 쓰기(notif_prefs/프로필) → 보호 컬럼 아님 → 통과
--
-- ⚠️ Supabase SQL Editor 수동 실행 필요. 순수 DB(트리거+헬퍼) — 클라이언트 무변경.
-- ⚠️ 어드민 판별은 raw_app_meta_data 만 사용(D-58). raw_user_meta_data 는 사용자가 self-set 가능 →
--    절대 쓰지 말 것(쓰면 패널이 자기 user_metadata.role='admin' 위조로 가드 우회 = 사기 재개방).
-- ※ 적용 전 운영 DB에서 SELECT * FROM pg_policies WHERE tablename IN('feedbacks','panels','companies') 로
--    UPDATE 정책이 실제로 컬럼 무제한인지 최종 확인 권장(코드·문서 증거는 무제한을 강하게 시사).

-- ─── 0) 어드민 판별 헬퍼 (app_metadata 전용, NULL 안전) ───────────────────────────────
--   SECURITY DEFINER: authenticated 역할은 auth.users 직접 SELECT 권한이 없으므로 소유자 권한으로 조회.
--   auth.uid()는 SECURITY DEFINER 안에서도 "원래 호출자"의 uid를 반환하므로 본인 판별 정확.
CREATE OR REPLACE FUNCTION public.is_caller_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_caller_admin() TO authenticated, anon;

-- ─── 1) feedbacks: 승인·정산 컬럼 보호 ────────────────────────────────────────────────
--   보호: purity_passed→true(가짜 승인) / payout_amount 변경(가짜 정산액) / rejection_penalty_applied→true
--   패널 제출은 purity_passed=false 라 미차단. 어드민(is_caller_admin)·RPC(current_user) 통과.
CREATE OR REPLACE FUNCTION guard_feedbacks_decision_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER RPC(소유자 컨텍스트)면 통과. 클라 직접(authenticated/anon)만 검사.
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_caller_admin() THEN
    IF (NEW.purity_passed IS TRUE AND OLD.purity_passed IS DISTINCT FROM TRUE)
       OR (NEW.payout_amount IS DISTINCT FROM OLD.payout_amount)
       OR (NEW.rejection_penalty_applied IS TRUE AND OLD.rejection_penalty_applied IS DISTINCT FROM TRUE)
    THEN
      RAISE EXCEPTION 'protected_column: 피드백 승인·정산 컬럼은 어드민만 변경할 수 있습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_feedbacks_decision ON feedbacks;
CREATE TRIGGER trg_guard_feedbacks_decision
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION guard_feedbacks_decision_columns();

-- ─── 2) panels: 권한·정산 입력 컬럼 보호 (D-144 잔존분) ────────────────────────────────
--   보호: honor_points·trust_score·is_expert·experience·experience_years·experience_confirmed_at·
--         total_missions·status·rejection_count·rejection_reason
--   패널 본인 정상 쓰기(avatar_emoji/avatar_color/selected_badge/notif_prefs/phone/phone_verified/프로필)는 보호 컬럼 아님 → 통과.
--   어드민(PanelManagement 상태변경)·DEFINER RPC(honor·경력·신뢰도·뱃지·미션카운트)는 통과.
CREATE OR REPLACE FUNCTION guard_panels_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_caller_admin() THEN
    IF NEW.honor_points          IS DISTINCT FROM OLD.honor_points
       OR NEW.trust_score        IS DISTINCT FROM OLD.trust_score
       OR NEW.is_expert          IS DISTINCT FROM OLD.is_expert
       OR NEW.experience         IS DISTINCT FROM OLD.experience
       OR NEW.experience_years   IS DISTINCT FROM OLD.experience_years
       OR NEW.experience_confirmed_at IS DISTINCT FROM OLD.experience_confirmed_at
       OR NEW.total_missions     IS DISTINCT FROM OLD.total_missions
       OR NEW.status             IS DISTINCT FROM OLD.status
       OR NEW.rejection_count    IS DISTINCT FROM OLD.rejection_count
       OR NEW.rejection_reason   IS DISTINCT FROM OLD.rejection_reason
    THEN
      RAISE EXCEPTION 'protected_column: 패널 권한·정산 컬럼은 본인이 직접 변경할 수 없습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_panels_privileged ON panels;
CREATE TRIGGER trg_guard_panels_privileged
  BEFORE UPDATE ON panels
  FOR EACH ROW
  EXECUTE FUNCTION guard_panels_privileged_columns();

-- ─── 3) companies: 크레딧·플랜 컬럼 보호 (수평전개) ────────────────────────────────────
--   보호: credit_balance·plan·free_trial_used·addon_credits·plan_started_at·next_billing_at·plan_billing_cycle
--   기업 본인 정상 쓰기(notif_prefs/프로필)는 보호 컬럼 아님 → 통과.
--   결제·플랜 RPC(grant_plan_credits·purchase_credits·admin_change_plan·admin_add_credits·reserve/complete/unlock/renew)는 전부 DEFINER → 통과.
CREATE OR REPLACE FUNCTION guard_companies_money_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_caller_admin() THEN
    IF NEW.credit_balance       IS DISTINCT FROM OLD.credit_balance
       OR NEW.plan              IS DISTINCT FROM OLD.plan
       OR NEW.free_trial_used   IS DISTINCT FROM OLD.free_trial_used
       OR NEW.addon_credits     IS DISTINCT FROM OLD.addon_credits
       OR NEW.plan_started_at   IS DISTINCT FROM OLD.plan_started_at
       OR NEW.next_billing_at   IS DISTINCT FROM OLD.next_billing_at
       OR NEW.plan_billing_cycle IS DISTINCT FROM OLD.plan_billing_cycle
    THEN
      RAISE EXCEPTION 'protected_column: 기업 크레딧·플랜 컬럼은 직접 변경할 수 없습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_companies_money ON companies;
CREATE TRIGGER trg_guard_companies_money
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION guard_companies_money_columns();
