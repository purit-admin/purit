-- 025_admin_change_plan.sql
-- 어드민 전용: 기업 플랜 강제 변경 + 크레딧 초기화 RPC

CREATE OR REPLACE FUNCTION admin_change_plan(
  p_company_id UUID,
  p_plan       TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  -- 어드민 권한 검증 (app_metadata 우선, user_metadata 폴백)
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

  IF p_plan NOT IN ('starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;

  v_credits := CASE p_plan
    WHEN 'starter'    THEN 50
    WHEN 'pro'        THEN 165
    WHEN 'enterprise' THEN 400
  END;

  UPDATE companies
  SET plan = p_plan, credit_balance = v_credits
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company not found';
  END IF;
END;
$$;
