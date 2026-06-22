-- ============================================================================
-- 120_subscription_cancellation.sql
-- 구독 해지(기간 말 해지) 시스템 + 이탈 사유 설문
-- 최초 작성: 2026-06-22
--
-- [모델] "cancel-at-period-end" — 즉시 끊지 않고 결제한 기간(next_billing_at)까지 이용,
--   그 시점에 renew_due_subscriptions cron 이 '갱신' 대신 'free_trial 강등'을 수행한다.
--   · 구독 크레딧은 소멸, 구매 크레딧(addon)은 보존(096/097 LEAST 규약·D-129 정합).
--   · 해지 예약은 기간 말 전까지 '철회(resume)' 가능.
--   · 업그레이드/플랜변경(grant_plan_credits·admin_change_plan)은 해지 예약을 자동 해제(재구독).
--
-- [전제] 096/097 구독 결제(companies addon_credits·next_billing_at·plan_billing_cycle /
--   renew_due_subscriptions) 적용됨. is_caller_admin()(112).
-- ============================================================================

-- ── 1) companies 해지 상태 컬럼 ───────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subscription_canceled_at          TIMESTAMPTZ;  -- 해지 '요청' 시각(예약 시점)

-- ── 2) 이탈 사유 설문 테이블 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_cancellations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan         TEXT,                       -- 해지 시점 플랜(starter/pro)
  reason_code  TEXT NOT NULL,              -- price/missing_features/low_usage/competitor/temporary/other
  reason_text  TEXT,                       -- 자유 상세(선택)
  effective_at TIMESTAMPTZ,                -- 이용 종료 예정일(해지 시점의 next_billing_at)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscription_cancellations ENABLE ROW LEVEL SECURITY;

-- 본인(오너)·어드민만 조회. INSERT/DELETE 는 DEFINER RPC 경유(정책 불필요).
DROP POLICY IF EXISTS subcancel_select_own_or_admin ON subscription_cancellations;
CREATE POLICY subcancel_select_own_or_admin ON subscription_cancellations
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT public.get_my_company_ids())
    OR public.is_caller_admin()
  );

-- ── 3) cancel_my_subscription RPC (해지 예약 + 사유 기록) ──────────────────────
CREATE OR REPLACE FUNCTION cancel_my_subscription(
  p_reason_code TEXT,
  p_reason_text TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_co companies%ROWTYPE;
BEGIN
  -- 소유권 검증(오너만 — 팀원 해지 불가)
  SELECT * INTO v_co FROM companies WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- 유료 구독(starter/pro)만 해지 대상. free_trial=해지할 것 없음, enterprise=계약(문의).
  IF v_co.plan NOT IN ('starter','pro') THEN
    RAISE EXCEPTION 'no_active_subscription';
  END IF;

  IF p_reason_code IS NULL OR length(trim(p_reason_code)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  -- 이미 예약돼 있어도 멱등(사유만 갱신). 기간 말까지 이용은 그대로.
  UPDATE companies
  SET subscription_cancel_at_period_end = TRUE,
      subscription_canceled_at          = NOW()
  WHERE id = v_co.id;

  -- 같은 회사의 미완료(아직 강등 안 된) 예약 사유는 정리 후 새로 기록(중복 방지)
  DELETE FROM subscription_cancellations
   WHERE company_id = v_co.id
     AND effective_at IS NOT NULL AND effective_at > NOW();

  INSERT INTO subscription_cancellations
    (company_id, plan, reason_code, reason_text, effective_at)
  VALUES
    (v_co.id, v_co.plan, p_reason_code, NULLIF(trim(p_reason_text), ''), v_co.next_billing_at);

  RETURN jsonb_build_object('success', true, 'effective_at', v_co.next_billing_at);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_my_subscription(TEXT, TEXT) TO authenticated;

-- ── 4) resume_my_subscription RPC (해지 예약 철회) ────────────────────────────
CREATE OR REPLACE FUNCTION resume_my_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM companies WHERE user_id = auth.uid() LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE companies
  SET subscription_cancel_at_period_end = FALSE,
      subscription_canceled_at          = NULL
  WHERE id = v_id;

  -- 아직 강등 안 된 예약 사유 행 삭제(철회 = 없던 일로). 이미 강등(완료)된 과거 행은 보존.
  DELETE FROM subscription_cancellations
   WHERE company_id = v_id
     AND effective_at IS NOT NULL AND effective_at > NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION resume_my_subscription() TO authenticated;

-- ── 5) renew_due_subscriptions 재정의 — 해지 예약 건은 갱신 대신 free_trial 강등 ──
--    097 본문 유지 + 루프 내 cancel 분기 추가. (대상 쿼리는 그대로: starter/pro·next_billing 도래)
CREATE OR REPLACE FUNCTION renew_due_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count        INTEGER := 0;
  v_co           RECORD;
  v_plan_credits INTEGER;
  v_next         TIMESTAMPTZ;
BEGIN
  FOR v_co IN
    SELECT id, name, plan, next_billing_at, plan_billing_cycle, subscription_cancel_at_period_end
    FROM companies
    WHERE plan IN ('starter','pro')
      AND next_billing_at IS NOT NULL
      AND next_billing_at <= NOW()
  LOOP
    IF v_co.subscription_cancel_at_period_end THEN
      -- ★ 해지 예약 만료 → free_trial 강등: 구독 크레딧 소멸, 구매분(addon)만 보존. 청구 없음.
      UPDATE companies
      SET plan                             = 'free_trial',
          credit_balance                   = LEAST(addon_credits, credit_balance),
          addon_credits                    = LEAST(addon_credits, credit_balance),
          next_billing_at                  = NULL,
          plan_started_at                  = NULL,
          subscription_cancel_at_period_end = FALSE,
          subscription_canceled_at         = NULL
      WHERE id = v_co.id;

      v_count := v_count + 1;
      CONTINUE;  -- 갱신/청구 스킵
    END IF;

    -- ── 정상 갱신(097 본문) ──
    v_plan_credits := CASE v_co.plan WHEN 'starter' THEN 50 WHEN 'pro' THEN 165 ELSE 0 END;

    v_next := v_co.next_billing_at;
    WHILE v_next <= NOW() LOOP
      v_next := v_next + INTERVAL '1 month';
    END LOOP;

    UPDATE companies
    SET credit_balance  = v_plan_credits + LEAST(addon_credits, credit_balance),
        addon_credits   = LEAST(addon_credits, credit_balance),
        next_billing_at = v_next
    WHERE id = v_co.id;

    IF v_co.plan_billing_cycle = 'monthly' THEN
      INSERT INTO invoices
        (company_id, company_name, plan, amount, status, payment_type, credits_amount, payment_method)
      VALUES
        (v_co.id, v_co.name, v_co.plan, 0, 'paid', 'plan', v_plan_credits, 'manual');
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION renew_due_subscriptions() TO service_role;

-- ── 6) 재구독(플랜 변경) 시 해지 예약 자동 해제 ───────────────────────────────
--    grant_plan_credits(096/097 본문 유지) + admin_change_plan UPDATE에 해지 플래그 해제만 추가.
--    안 하면 "해지 예약 상태에서 업그레이드 → 기간 말에 강등"되는 모순 발생.
CREATE OR REPLACE FUNCTION grant_plan_credits(
  p_company_id    UUID,
  p_plan          TEXT,
  p_amount_krw    NUMERIC DEFAULT 0,
  p_method        TEXT    DEFAULT 'card',
  p_billing_cycle TEXT    DEFAULT 'monthly'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits   INTEGER;
  v_co_name   TEXT;
  v_cur_plan  TEXT;
  v_cur_rank  INTEGER;
  v_new_rank  INTEGER;
BEGIN
  v_credits := CASE p_plan
    WHEN 'free_trial' THEN 0 WHEN 'starter' THEN 50 WHEN 'pro' THEN 165 WHEN 'enterprise' THEN 400 ELSE 0 END;

  SELECT name, plan INTO v_co_name, v_cur_plan
  FROM companies WHERE id = p_company_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized'; END IF;

  v_cur_rank := CASE v_cur_plan WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 WHEN 'enterprise' THEN 3 ELSE 0 END;
  v_new_rank := CASE p_plan      WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 WHEN 'enterprise' THEN 3 ELSE 0 END;
  IF v_new_rank < v_cur_rank THEN RAISE EXCEPTION 'downgrade_not_allowed'; END IF;

  UPDATE companies
  SET plan               = p_plan,
      credit_balance     = credit_balance + v_credits,
      plan_started_at    = NOW(),
      next_billing_at    = NOW() + INTERVAL '1 month',
      plan_billing_cycle = p_billing_cycle,
      subscription_cancel_at_period_end = FALSE,   -- ★ 재구독 시 해지 예약 해제
      subscription_canceled_at          = NULL
  WHERE id = p_company_id;

  -- 재구독으로 살아난 미완료 해지 사유행 정리
  DELETE FROM subscription_cancellations
   WHERE company_id = p_company_id AND effective_at IS NOT NULL AND effective_at > NOW();

  IF p_amount_krw > 0 THEN
    INSERT INTO invoices
      (company_id, company_name, plan, amount, status, payment_type, credits_amount, payment_method)
    VALUES
      (p_company_id, v_co_name, p_plan, p_amount_krw, 'paid', 'plan', v_credits, p_method);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_plan_credits(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

-- admin_change_plan: 097 본문 유지 + 해지 플래그 해제만 추가
CREATE OR REPLACE FUNCTION admin_change_plan(
  p_company_id UUID,
  p_plan       TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  IF NOT public.is_caller_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF p_plan NOT IN ('free_trial', 'starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;

  v_credits := CASE p_plan
    WHEN 'free_trial' THEN 0 WHEN 'starter' THEN 50 WHEN 'pro' THEN 165 WHEN 'enterprise' THEN 400 END;

  UPDATE companies
  SET plan            = p_plan,
      credit_balance  = v_credits,
      addon_credits   = 0,
      plan_started_at = NOW(),
      next_billing_at = CASE WHEN p_plan IN ('starter','pro') THEN NOW() + INTERVAL '1 month' ELSE NULL END,
      subscription_cancel_at_period_end = FALSE,   -- ★ 강제 변경 시 해지 예약 해제
      subscription_canceled_at          = NULL
  WHERE id = p_company_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'company not found'; END IF;
END;
$$;

-- ============================================================================
-- [적용 후] pg_cron 'renew-subscriptions'(096 등록분)이 이 새 본문을 그대로 호출 → 재등록 불필요.
-- [검증] SELECT proname FROM pg_proc WHERE proname IN
--   ('cancel_my_subscription','resume_my_subscription','renew_due_subscriptions','grant_plan_credits');
-- ============================================================================
