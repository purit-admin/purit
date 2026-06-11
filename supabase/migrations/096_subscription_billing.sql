-- 096_subscription_billing.sql
-- 결제 시스템 재설계 — 플랜 변경 누적 / 월 갱신(매월 리셋, 구매분 보존) / 다운그레이드 차단 / pg_cron 자동 갱신
--
-- 변경 핵심:
--   1) grant_plan_credits: 잔액 '절대값 SET' → '누적 +=' (업그레이드 시 스타터 잔여 + 새 플랜 크레딧 보존)
--      + 다운그레이드 가드(상위→하위 차단) + 결제일 앵커(plan_started_at·next_billing_at·plan_billing_cycle)
--   2) purchase_credits: 구매 충전분을 addon_credits 트래커에도 누적(월 리셋에도 보존되는 크레딧)
--   3) admin_change_plan: 어드민 강제 = 절대값 SET 유지(다운그레이드 가드 미적용) + 앵커 세팅
--   4) renew_due_subscriptions(): pg_cron 월 1회 — 구독분만 플랜 기본값으로 리셋, 구매분(addon)은 LEAST 보존
--
-- 설계 원칙(블라스트 반경 최소화):
--   · 소비/차감의 단일 진실은 기존 credit_balance 그대로 → 소비 RPC(reserve/refund/unlock) 전부 무수정.
--   · addon_credits는 "보존돼야 할 구매 충전분"만 추적하는 트래커. 소비는 항상 "구독분 먼저" 규약.
--   · 월 갱신 시 protected := LEAST(addon_credits, credit_balance) 로 구매분 잔량을 별도 추적 없이 정확 산출.
--   · 프론트 월간/추가 구분 표시·확인 모달도 파생값(월간=balance-addon)으로 구현(D-129).

-- ── 1) companies 결제 컬럼 추가 ───────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS addon_credits      NUMERIC(10,2) NOT NULL DEFAULT 0,  -- 보존 구매분 트래커
  ADD COLUMN IF NOT EXISTS plan_started_at    TIMESTAMPTZ,                        -- 현 플랜 결제 시작일(앵커)
  ADD COLUMN IF NOT EXISTS next_billing_at    TIMESTAMPTZ,                        -- 다음 월 갱신/재지급일
  ADD COLUMN IF NOT EXISTS plan_billing_cycle TEXT DEFAULT 'monthly'
    CHECK (plan_billing_cycle IN ('monthly','annual'));

-- 기존 유료 구독 회사 백필: 앵커가 없으면 지금부터 월 주기 시작(다음 갱신 = +1개월)
UPDATE companies
SET plan_started_at    = COALESCE(plan_started_at, NOW()),
    next_billing_at    = COALESCE(next_billing_at, NOW() + INTERVAL '1 month'),
    plan_billing_cycle = COALESCE(plan_billing_cycle, 'monthly')
WHERE plan IN ('starter','pro') AND next_billing_at IS NULL;

-- ── 2) grant_plan_credits 재정의 (누적 += / 다운그레이드 가드 / 앵커) ──────────
--    기존 4-param(UUID,TEXT,NUMERIC,TEXT) → 5-param(+ p_billing_cycle). DROP 후 재생성.
DROP FUNCTION IF EXISTS grant_plan_credits(UUID, TEXT, NUMERIC, TEXT);

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
    WHEN 'free_trial' THEN 0
    WHEN 'starter'    THEN 50
    WHEN 'pro'        THEN 165
    WHEN 'enterprise' THEN 400
    ELSE 0
  END;

  -- 소유권 검증 + 현재 플랜 조회
  SELECT name, plan INTO v_co_name, v_cur_plan
  FROM companies
  WHERE id = p_company_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- 다운그레이드 가드: 티어 랭크(free_trial 0 < starter 1 < pro 2 < enterprise 3)
  v_cur_rank := CASE v_cur_plan
    WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 WHEN 'enterprise' THEN 3 ELSE 0 END;  -- free_trial/기타 = 0
  v_new_rank := CASE p_plan
    WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 WHEN 'enterprise' THEN 3 ELSE 0 END;
  IF v_new_rank < v_cur_rank THEN
    RAISE EXCEPTION 'downgrade_not_allowed';
  END IF;

  -- 누적 지급(덮어쓰기 폐기) + 결제일 앵커 세팅
  UPDATE companies
  SET plan               = p_plan,
      credit_balance     = credit_balance + v_credits,
      plan_started_at    = NOW(),
      next_billing_at    = NOW() + INTERVAL '1 month',
      plan_billing_cycle = p_billing_cycle
  WHERE id = p_company_id;

  IF p_amount_krw > 0 THEN
    INSERT INTO invoices
      (company_id, company_name, plan, amount, status, payment_type, credits_amount, payment_method)
    VALUES
      (p_company_id, v_co_name, p_plan, p_amount_krw, 'paid', 'plan', v_credits, p_method);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_plan_credits(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

-- ── 3) purchase_credits 재정의 (079 본문 유지 + addon_credits 트래커 누적) ──────
CREATE OR REPLACE FUNCTION purchase_credits(
  p_company_id  UUID,
  p_credits     NUMERIC,
  p_amount_krw  NUMERIC,
  p_method      TEXT DEFAULT 'card'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_co          companies%ROWTYPE;
  v_new_balance NUMERIC;
BEGIN
  -- 소유권 검증
  SELECT * INTO v_co FROM companies WHERE id = p_company_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- 크레딧 적립 + 구매 충전분 트래커 누적(월 리셋에도 보존)
  UPDATE companies
  SET credit_balance = credit_balance + p_credits,
      addon_credits  = addon_credits  + p_credits
  WHERE id = p_company_id
  RETURNING credit_balance INTO v_new_balance;

  INSERT INTO invoices
    (company_id, company_name, plan, amount, status, payment_type, credits_amount, payment_method)
  VALUES
    (p_company_id, v_co.name, v_co.plan, p_amount_krw, 'paid', 'credits', p_credits, p_method);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION purchase_credits(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ── 4) admin_change_plan 재정의 (어드민 강제 = 절대값 SET 유지 + 앵커 세팅) ─────
--    다운그레이드 가드는 어드민엔 미적용(운영 강제 허용). 085 본문(free_trial 허용) 유지.
CREATE OR REPLACE FUNCTION admin_change_plan(
  p_company_id UUID,
  p_plan       TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  IF (auth.jwt()->'app_metadata'->>'role') <> 'admin'
     AND (auth.jwt()->>'role') <> 'admin'
     AND NOT EXISTS (
       SELECT 1 FROM auth.users
       WHERE id = auth.uid()
         AND raw_user_meta_data->>'role' = 'admin'
     )
  THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF p_plan NOT IN ('free_trial', 'starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;

  v_credits := CASE p_plan
    WHEN 'free_trial' THEN 0
    WHEN 'starter'    THEN 50
    WHEN 'pro'        THEN 165
    WHEN 'enterprise' THEN 400
  END;

  -- 어드민 강제: 절대값 SET(누적 아님) + 앵커도 함께 재설정
  UPDATE companies
  SET plan            = p_plan,
      credit_balance  = v_credits,
      plan_started_at = NOW(),
      next_billing_at = NOW() + INTERVAL '1 month'
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company not found';
  END IF;
END;
$$;

-- ── 5) renew_due_subscriptions() — pg_cron 월 갱신 (구독분 리셋 / 구매분 보존) ───
--    대상: 유료 플랜(starter/pro) 중 next_billing_at 도래. free_trial·enterprise(수동/CSM) 제외.
CREATE OR REPLACE FUNCTION renew_due_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count        INTEGER := 0;
  v_co           RECORD;
  v_plan_credits INTEGER;
  v_protected    NUMERIC;
  v_next         TIMESTAMPTZ;
BEGIN
  FOR v_co IN
    SELECT id, name, plan, credit_balance, addon_credits, next_billing_at, plan_billing_cycle
    FROM companies
    WHERE plan IN ('starter','pro')
      AND next_billing_at IS NOT NULL
      AND next_billing_at <= NOW()
  LOOP
    v_plan_credits := CASE v_co.plan WHEN 'starter' THEN 50 WHEN 'pro' THEN 165 ELSE 0 END;
    v_protected    := LEAST(v_co.addon_credits, v_co.credit_balance);  -- 구매분 잔량 보존(구독분 우선 소진 규약)

    -- 밀린 달 보정: next_billing_at 을 미래가 될 때까지 +1month (리셋은 멱등이라 크레딧은 1회 적용)
    v_next := v_co.next_billing_at;
    WHILE v_next <= NOW() LOOP
      v_next := v_next + INTERVAL '1 month';
    END LOOP;

    UPDATE companies
    SET credit_balance  = v_plan_credits + v_protected,  -- 구독분 리셋 + 구매분 보존
        addon_credits   = v_protected,                   -- 트래커 클램프
        next_billing_at = v_next
    WHERE id = v_co.id;

    -- 월간 cycle 은 정기 청구 1건 기록. 연간 cycle 은 선결제이므로 크레딧만 드립(청구 생략).
    -- ※ 연간 12개월 만기 자동 재청구는 후속 과제.
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

-- ── 6) pg_cron 등록 (Supabase SQL Editor에서 1회 수동 실행 — 081 패턴) ──────────
-- SELECT cron.schedule(
--   'renew-subscriptions',
--   '0 0 * * *',                       -- 매일 00:00(UTC) 1회 — 당일 도래분 처리
--   $$SELECT public.renew_due_subscriptions()$$
-- );
