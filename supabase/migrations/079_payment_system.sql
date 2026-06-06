-- 079_payment_system.sql
-- 결제 시스템 골격 (Mock → 토스페이먼츠 PG 연동 대비)
-- 변경 범위: invoices 컬럼 추가 + RLS 활성화 + purchase_credits RPC + grant_plan_credits 재정의

-- ─── 1. invoices 테이블 컬럼 추가 ────────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_type   TEXT DEFAULT 'plan'
    CHECK (payment_type IN ('plan', 'credits')),
  ADD COLUMN IF NOT EXISTS credits_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card'
    CHECK (payment_method IN ('card', 'virtual_account', 'manual'));

-- ─── 2. invoices RLS 활성화 (D-79 패턴) ─────────────────────────────────────

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 기업 오너: 본인 회사 청구서 전체 접근
CREATE POLICY invoices_owner_all ON invoices
  FOR ALL USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- 팀 멤버: 소속 회사 청구서 SELECT
CREATE POLICY invoices_team_select ON invoices
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 어드민: 전체 접근
CREATE POLICY invoices_admin_all ON invoices
  FOR ALL USING (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ─── 3. RPC: purchase_credits ────────────────────────────────────────────────
-- 기업 사용자가 자체 크레딧 충전 시 호출 (플랜 변경 아닌 추가 충전)
-- 소유권: auth.uid() = companies.user_id 검증 (D-58 app_metadata 무관, 기업 전용)

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

  -- 금액·수량 유효성
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- 크레딧 적립
  UPDATE companies
  SET credit_balance = credit_balance + p_credits
  WHERE id = p_company_id
  RETURNING credit_balance INTO v_new_balance;

  -- 청구 기록
  INSERT INTO invoices
    (company_id, company_name, plan, amount, status, payment_type, credits_amount, payment_method)
  VALUES
    (p_company_id, v_co.name, v_co.plan, p_amount_krw, 'paid', 'credits', p_credits, p_method);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION purchase_credits(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ─── 4. grant_plan_credits 재정의 (invoices 자동 기록 추가) ──────────────────
-- 기존 시그니처에 p_amount_krw / p_method 파라미터 추가 (DEFAULT 값으로 하위 호환 유지)
-- p_amount_krw = 0 이면 invoices 미기록 (admin_change_plan 호출과 구분)

DROP FUNCTION IF EXISTS grant_plan_credits(UUID, TEXT);

CREATE OR REPLACE FUNCTION grant_plan_credits(
  p_company_id  UUID,
  p_plan        TEXT,
  p_amount_krw  NUMERIC DEFAULT 0,
  p_method      TEXT    DEFAULT 'card'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits  INTEGER;
  v_co_name  TEXT;
BEGIN
  v_credits := CASE p_plan
    WHEN 'starter'    THEN 50
    WHEN 'pro'        THEN 165
    WHEN 'enterprise' THEN 400
    ELSE 0
  END;

  -- 소유권 검증 + 회사명 조회
  SELECT name INTO v_co_name
  FROM companies
  WHERE id = p_company_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- 플랜 + 크레딧 업데이트
  UPDATE companies
  SET plan = p_plan, credit_balance = v_credits
  WHERE id = p_company_id;

  -- 결제 금액이 있을 때만 청구 기록 (PaymentModal 경유 시에만)
  IF p_amount_krw > 0 THEN
    INSERT INTO invoices
      (company_id, company_name, plan, amount, status, payment_type, credits_amount, payment_method)
    VALUES
      (p_company_id, v_co_name, p_plan, p_amount_krw, 'paid', 'plan', v_credits, p_method);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_plan_credits(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
