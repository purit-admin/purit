-- 018_credits_numeric.sql
-- 크레딧 컬럼 NUMERIC 변환 + RPC 소수 반올림 제거

-- ─── 1. 컬럼 타입 변경 (INTEGER → NUMERIC) ────────────────────────────────────
ALTER TABLE missions  ALTER COLUMN credits_reserved TYPE NUMERIC(10,2);
ALTER TABLE missions  ALTER COLUMN credits_consumed  TYPE NUMERIC(10,2);
ALTER TABLE companies ALTER COLUMN credit_balance    TYPE NUMERIC(10,2);

-- ─── 2. 시그니처가 바뀌는 함수는 DROP 후 재생성 ──────────────────────────────
-- reserve_mission_credits: p_credits INTEGER → NUMERIC
DROP FUNCTION IF EXISTS reserve_mission_credits(UUID, UUID, INTEGER);
-- recalc_mission_consumed: RETURNS INTEGER → RETURNS NUMERIC
DROP FUNCTION IF EXISTS recalc_mission_consumed(UUID);

-- ─── 3. RPC B: reserve_mission_credits (NUMERIC) ─────────────────────────────
CREATE OR REPLACE FUNCTION reserve_mission_credits(
  p_mission_id UUID,
  p_company_id UUID,
  p_credits    NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT credit_balance INTO v_balance
  FROM companies
  WHERE id = p_company_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF v_balance < p_credits THEN
    RETURN jsonb_build_object(
      'success',  false,
      'error',    'INSUFFICIENT_CREDITS',
      'balance',  v_balance,
      'required', p_credits
    );
  END IF;

  UPDATE companies SET credit_balance = credit_balance - p_credits WHERE id = p_company_id;
  UPDATE missions  SET credits_reserved = p_credits WHERE id = p_mission_id;

  RETURN jsonb_build_object('success', true, 'balance', v_balance - p_credits);
END;
$$;

-- ─── 4. RPC C: recalc_mission_consumed (NUMERIC, 소수 반올림 없음) ───────────
CREATE OR REPLACE FUNCTION recalc_mission_consumed(p_mission_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission_type   TEXT;
  v_mission_factor NUMERIC;
  v_total          NUMERIC := 0;
  v_exp            TEXT;
  v_multiplier     NUMERIC;
  v_year_text      TEXT;
  v_years          INTEGER;
  v_panel          RECORD;
BEGIN
  IF (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT type INTO v_mission_type FROM missions WHERE id = p_mission_id;

  v_mission_factor := CASE
    WHEN v_mission_type IS NULL OR v_mission_type = 'landing_page' THEN 1.5
    ELSE 1.0
  END;

  FOR v_panel IN
    SELECT p.experience
    FROM feedbacks f
    JOIN panels p ON p.id = f.panel_id
    WHERE f.mission_id = p_mission_id
      AND f.purity_passed = true
  LOOP
    v_exp := lower(coalesce(v_panel.experience, ''));

    IF v_exp ~ '(c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN
      v_multiplier := 3.0;
    ELSIF v_exp ~ '시니어' THEN
      v_multiplier := 2.0;
    ELSIF v_exp ~ '\d' THEN
      v_year_text := (regexp_match(v_exp, '(\d+)'))[1];
      IF v_year_text IS NOT NULL THEN
        v_years := v_year_text::INTEGER;
        IF v_years >= 8 THEN
          v_multiplier := 2.0;
        ELSIF v_years >= 4 THEN
          v_multiplier := 1.5;
        ELSE
          v_multiplier := 1.0;
        END IF;
      ELSE
        v_multiplier := 1.0;
      END IF;
    ELSIF v_exp ~ '미들' THEN
      v_multiplier := 1.5;
    ELSE
      v_multiplier := 1.0;
    END IF;

    v_total := v_total + (v_multiplier * v_mission_factor);
  END LOOP;

  UPDATE missions SET credits_consumed = v_total WHERE id = p_mission_id;

  RETURN v_total;
END;
$$;

-- ─── 5. RPC D: complete_mission_and_refund (NUMERIC, 소수 반올림 없음) ────────
CREATE OR REPLACE FUNCTION complete_mission_and_refund(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id       UUID;
  v_credits_reserved NUMERIC;
  v_mission_type     TEXT;
  v_mission_factor   NUMERIC;
  v_total_consumed   NUMERIC := 0;
  v_refund           NUMERIC;
  v_exp              TEXT;
  v_multiplier       NUMERIC;
  v_year_text        TEXT;
  v_years            INTEGER;
  v_panel            RECORD;
BEGIN
  IF (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT company_id, credits_reserved, type
  INTO v_company_id, v_credits_reserved, v_mission_type
  FROM missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  v_mission_factor := CASE
    WHEN v_mission_type IS NULL OR v_mission_type = 'landing_page' THEN 1.5
    ELSE 1.0
  END;

  FOR v_panel IN
    SELECT p.experience
    FROM feedbacks f
    JOIN panels p ON p.id = f.panel_id
    WHERE f.mission_id = p_mission_id
      AND f.purity_passed = true
  LOOP
    v_exp := lower(coalesce(v_panel.experience, ''));

    IF v_exp ~ '(c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN
      v_multiplier := 3.0;
    ELSIF v_exp ~ '시니어' THEN
      v_multiplier := 2.0;
    ELSIF v_exp ~ '\d' THEN
      v_year_text := (regexp_match(v_exp, '(\d+)'))[1];
      IF v_year_text IS NOT NULL THEN
        v_years := v_year_text::INTEGER;
        IF v_years >= 8 THEN
          v_multiplier := 2.0;
        ELSIF v_years >= 4 THEN
          v_multiplier := 1.5;
        ELSE
          v_multiplier := 1.0;
        END IF;
      ELSE
        v_multiplier := 1.0;
      END IF;
    ELSIF v_exp ~ '미들' THEN
      v_multiplier := 1.5;
    ELSE
      v_multiplier := 1.0;
    END IF;

    v_total_consumed := v_total_consumed + (v_multiplier * v_mission_factor);
  END LOOP;

  v_refund := GREATEST(0, v_credits_reserved - v_total_consumed);

  UPDATE missions
  SET status = 'completed', credits_consumed = v_total_consumed
  WHERE id = p_mission_id;

  IF v_refund > 0 THEN
    UPDATE companies
    SET credit_balance = credit_balance + v_refund
    WHERE id = v_company_id;
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'credits_reserved', v_credits_reserved,
    'credits_consumed', v_total_consumed,
    'credits_refunded', v_refund
  );
END;
$$;
