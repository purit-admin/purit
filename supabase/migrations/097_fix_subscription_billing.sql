-- 097_fix_subscription_billing.sql
-- 096 후속 핫픽스 — 검수에서 발견된 2건만 교정 (전진 마이그레이션, 096은 건드리지 않음)
--
--   ① admin_change_plan: 절대값 리셋 시 addon_credits 도 0으로 초기화.
--      (구버그: balance만 리셋하고 addon_credits 트래커는 남아 → 다음 월 갱신 LEAST 로 '유령 크레딧' 부활)
--   ② renew_due_subscriptions: 스냅샷 변수 계산 → UPDATE문 내 컬럼 직접 참조(LEAST)로 원자화.
--      (구버그: FOR 루프 SELECT 후 UPDATE 사이 동시 purchase_credits 커밋분을 덮어써 충전 유실 가능)
--
-- 둘 다 CREATE OR REPLACE — 시그니처·GRANT 보존(권한 재부여 불필요).
-- 본문 로직은 096과 동일, 위 2지점만 변경.

-- ── ① admin_change_plan (addon_credits = 0 추가) ──────────────────────────────
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

  -- 어드민 강제: 절대값 SET(누적 아님) + 앵커 재설정 + 구매분 트래커도 초기화(유령 크레딧 방지)
  UPDATE companies
  SET plan            = p_plan,
      credit_balance  = v_credits,
      addon_credits   = 0,                      -- ★ 097: 강제 리셋 시 구매분 트래커도 0으로
      plan_started_at = NOW(),
      next_billing_at = NOW() + INTERVAL '1 month'
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company not found';
  END IF;
END;
$$;

-- ── ② renew_due_subscriptions (UPDATE문 내 컬럼 직접 참조로 원자화) ─────────────
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
    SELECT id, name, plan, next_billing_at, plan_billing_cycle
    FROM companies
    WHERE plan IN ('starter','pro')
      AND next_billing_at IS NOT NULL
      AND next_billing_at <= NOW()
  LOOP
    v_plan_credits := CASE v_co.plan WHEN 'starter' THEN 50 WHEN 'pro' THEN 165 ELSE 0 END;

    -- 밀린 달 보정: next_billing_at 을 미래가 될 때까지 +1month (리셋은 멱등이라 크레딧은 1회 적용)
    v_next := v_co.next_billing_at;
    WHILE v_next <= NOW() LOOP
      v_next := v_next + INTERVAL '1 month';
    END LOOP;

    -- ★ 097: credit_balance/addon_credits 를 변수가 아닌 컬럼으로 직접 참조해 원자 계산.
    --   동일 UPDATE 내 RHS는 모두 갱신 직전(최신 커밋) 행 값을 사용 → 동시 purchase_credits 유실 방지.
    --   (구독분 리셋 + 구매분은 LEAST 로 잔량 보존, 트래커는 그 값으로 클램프)
    UPDATE companies
    SET credit_balance  = v_plan_credits + LEAST(addon_credits, credit_balance),
        addon_credits   = LEAST(addon_credits, credit_balance),
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
