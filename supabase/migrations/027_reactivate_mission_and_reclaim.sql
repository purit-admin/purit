-- 027_reactivate_mission_and_reclaim.sql
-- 완료 처리된 미션을 재진행 상태로 복원할 때 환불된 크레딧을 기업 계정에서 회수하는 RPC

CREATE OR REPLACE FUNCTION reactivate_mission_and_reclaim(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id       UUID;
  v_credits_reserved NUMERIC;
  v_credits_consumed NUMERIC;
  v_reclaim          NUMERIC;
  v_balance          NUMERIC;
BEGIN
  -- 어드민 전용
  IF (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  -- 완료 상태 미션만 허용
  SELECT company_id, credits_reserved, credits_consumed
  INTO v_company_id, v_credits_reserved, v_credits_consumed
  FROM missions
  WHERE id = p_mission_id AND status = 'completed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found_or_not_completed');
  END IF;

  -- 환불됐던 금액 = 원래 예약액 - 실소비액
  v_reclaim := GREATEST(0, COALESCE(v_credits_reserved, 0) - COALESCE(v_credits_consumed, 0));

  IF v_reclaim > 0 THEN
    SELECT credit_balance INTO v_balance FROM companies WHERE id = v_company_id;

    IF v_balance < v_reclaim THEN
      RETURN jsonb_build_object(
        'success',  false,
        'error',    'INSUFFICIENT_CREDITS',
        'balance',  v_balance,
        'required', v_reclaim
      );
    END IF;

    UPDATE companies
    SET credit_balance = credit_balance - v_reclaim
    WHERE id = v_company_id;
  END IF;

  UPDATE missions SET status = 'active' WHERE id = p_mission_id;

  RETURN jsonb_build_object(
    'success',          true,
    'credits_reclaimed', v_reclaim
  );
END;
$$;
