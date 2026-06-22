-- ============================================================================
-- 121_harden_cancellation.sql
-- 구독 해지(120) 견고성 보강 2건 — 전수조사(니체) 발견. 돈 탈취 아님·무결성/경합 보강.
-- 최초 작성: 2026-06-22
--
--   ① 112 컬럼 가드에 해지 플래그 2종 추가 — subscription_cancel_at_period_end·
--      subscription_canceled_at 가 112 보호목록에서 빠져 있어 기업이 콘솔/REST로 자기 행의
--      해지 플래그를 직접 켜고 끌 수 있었음(돈 탈취는 불가 — next_billing_at·credit_balance·plan
--      은 이미 112 보호. 단 사유설문 우회·"예약인데 사유없음" 불일치 가능). 가드에 넣어
--      "구독 상태는 cancel/resume RPC(DEFINER)로만 변경" 불변식 완성.
--   ② renew_due_subscriptions 강등 분기에 flag 재확인 WHERE 추가 — cron이 flag=TRUE를 읽은
--      찰나에 사용자가 resume(flag=FALSE) 커밋 시, 옛 값으로 강등되던 마이크로초 경합 차단.
--      강등 UPDATE가 0행이면 이번 회차 스킵(다음 회차에 flag=FALSE로 정상 갱신). 097 원자화 동일 결.
--
-- [전제] 112·120 적용됨. 순수 DB·클라 무변경.
-- ============================================================================

-- ── ① guard_companies_money_columns: 해지 플래그 2종 추가 (112 본문 + 2줄) ─────────
CREATE OR REPLACE FUNCTION guard_companies_money_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_caller_admin() THEN
    IF NEW.credit_balance        IS DISTINCT FROM OLD.credit_balance
       OR NEW.plan               IS DISTINCT FROM OLD.plan
       OR NEW.free_trial_used    IS DISTINCT FROM OLD.free_trial_used
       OR NEW.addon_credits      IS DISTINCT FROM OLD.addon_credits
       OR NEW.plan_started_at    IS DISTINCT FROM OLD.plan_started_at
       OR NEW.next_billing_at    IS DISTINCT FROM OLD.next_billing_at
       OR NEW.plan_billing_cycle IS DISTINCT FROM OLD.plan_billing_cycle
       OR NEW.subscription_cancel_at_period_end IS DISTINCT FROM OLD.subscription_cancel_at_period_end  -- ★ 121
       OR NEW.subscription_canceled_at          IS DISTINCT FROM OLD.subscription_canceled_at           -- ★ 121
    THEN
      RAISE EXCEPTION 'protected_column: 기업 크레딧·플랜·구독 컬럼은 직접 변경할 수 없습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- 트리거(trg_guard_companies_money)는 함수만 교체되므로 재생성 불필요.

-- ── ② renew_due_subscriptions: 강등 분기에 flag 재확인 WHERE (120 본문 + 1줄) ───────
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
  v_downgraded   INTEGER;
BEGIN
  FOR v_co IN
    SELECT id, name, plan, next_billing_at, plan_billing_cycle, subscription_cancel_at_period_end
    FROM companies
    WHERE plan IN ('starter','pro')
      AND next_billing_at IS NOT NULL
      AND next_billing_at <= NOW()
  LOOP
    IF v_co.subscription_cancel_at_period_end THEN
      -- ★ 해지 예약 만료 → free_trial 강등(구독 크레딧 소멸·구매분 보존·청구 없음)
      --   WHERE 에 flag 재확인 추가: SELECT~UPDATE 사이 resume(철회) 커밋 시 0행→이번 회차 스킵.
      UPDATE companies
      SET plan                              = 'free_trial',
          credit_balance                    = LEAST(addon_credits, credit_balance),
          addon_credits                     = LEAST(addon_credits, credit_balance),
          next_billing_at                   = NULL,
          plan_started_at                   = NULL,
          subscription_cancel_at_period_end = FALSE,
          subscription_canceled_at          = NULL
      WHERE id = v_co.id
        AND subscription_cancel_at_period_end = TRUE;   -- ★ 121: 그 사이 철회됐으면 강등 안 함

      GET DIAGNOSTICS v_downgraded = ROW_COUNT;
      IF v_downgraded > 0 THEN
        v_count := v_count + 1;
        CONTINUE;  -- 강등 완료 → 갱신/청구 스킵
      END IF;
      -- v_downgraded=0 (그 사이 철회됨) → 아래 정상 갱신으로 진행(다음 줄로 폴스루)
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

-- ============================================================================
-- [검증] ① 기업 계정으로 UPDATE companies SET subscription_cancel_at_period_end=true WHERE id=본인
--           → 'protected_column' 에러(차단)면 정상.
--        ② cron 'renew-subscriptions'(8번)이 이 새 본문을 그대로 호출 → 재등록 불필요.
-- ============================================================================
