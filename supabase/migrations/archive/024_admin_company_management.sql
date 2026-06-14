-- 024_admin_company_management.sql
-- 어드민 전용: 기업에 크레딧 직접 추가 지급 RPC

CREATE OR REPLACE FUNCTION admin_add_credits(
  p_company_id UUID,
  p_amount     NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- 어드민 권한 검증
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE companies
  SET credit_balance = credit_balance + p_amount
  WHERE id = p_company_id
  RETURNING credit_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'company not found';
  END IF;

  RETURN v_new_balance;
END;
$$;
