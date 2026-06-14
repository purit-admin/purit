-- 016_credit_system.sql
-- 크레딧 시스템: 기업 잔액 추적, 의뢰 예약/소비/환불

-- ─── 1. 스키마 변경 ───────────────────────────────────────────────────────────

ALTER TABLE companies ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions  ADD COLUMN IF NOT EXISTS credits_reserved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions  ADD COLUMN IF NOT EXISTS credits_consumed  INTEGER NOT NULL DEFAULT 0;

-- 기존 플랜 보유 기업에 월 크레딧 초기 지급 (이미 0인 기업만)
UPDATE companies
SET credit_balance = CASE plan
  WHEN 'starter'    THEN 50
  WHEN 'pro'        THEN 165
  WHEN 'enterprise' THEN 400
  ELSE 0
END
WHERE credit_balance = 0;

-- ─── 2. RPC A: grant_plan_credits ────────────────────────────────────────────
-- 플랜 변경 + 해당 플랜의 월 크레딧으로 잔액 갱신 (덮어쓰기)
-- 호출: Pricing.jsx에서 플랜 선택 시
CREATE OR REPLACE FUNCTION grant_plan_credits(
  p_company_id UUID,
  p_plan       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  v_credits := CASE p_plan
    WHEN 'starter'    THEN 50
    WHEN 'pro'        THEN 165
    WHEN 'enterprise' THEN 400
    ELSE 0
  END;

  UPDATE companies
  SET plan = p_plan, credit_balance = v_credits
  WHERE id = p_company_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

-- ─── 3. RPC B: reserve_mission_credits ───────────────────────────────────────
-- 의뢰 등록 시 크레딧 예약 (잔액 차감 + missions.credits_reserved 설정)
-- 호출: 의뢰 등록 4개 페이지에서 missions INSERT 직후
CREATE OR REPLACE FUNCTION reserve_mission_credits(
  p_mission_id UUID,
  p_company_id UUID,
  p_credits    INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- 잔액 조회 (row lock으로 동시 제출 보호)
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

-- ─── 4. RPC C: complete_mission_and_refund ───────────────────────────────────
-- 어드민이 의뢰 완료 처리 시 실소비 계산 → 환불 → status='completed'
-- 패널별 크레딧 = CEIL(experience배수 × missionFactor)
--   experience배수: c레벨/임원→3.0, 시니어→2.0, 8+년→2.0, 4-7년→1.5, 기타→1.0
--   missionFactor:  landing_page/null→1.5, 서브미션→1.0
CREATE OR REPLACE FUNCTION complete_mission_and_refund(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id       UUID;
  v_credits_reserved INTEGER;
  v_mission_type     TEXT;
  v_mission_factor   NUMERIC;
  v_total_consumed   INTEGER := 0;
  v_per_credits      INTEGER;
  v_refund           INTEGER;
  v_exp              TEXT;
  v_multiplier       NUMERIC;
  v_year_text        TEXT;
  v_years            INTEGER;
  v_panel            RECORD;
BEGIN
  -- 어드민 권한 확인
  IF (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  -- 미션 정보 조회
  SELECT company_id, credits_reserved, type
  INTO v_company_id, v_credits_reserved, v_mission_type
  FROM missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- missionFactor 결정
  v_mission_factor := CASE
    WHEN v_mission_type IS NULL OR v_mission_type = 'landing_page' THEN 1.5
    ELSE 1.0
  END;

  -- 승인된 패널별 실제 크레딧 계산 (getExperienceMultiplier 로직 SQL 복제)
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

    v_per_credits    := CEIL(v_multiplier * v_mission_factor)::INTEGER;
    v_total_consumed := v_total_consumed + v_per_credits;
  END LOOP;

  -- 환불액 = 예약 - 실소비 (음수 방지)
  v_refund := GREATEST(0, v_credits_reserved - v_total_consumed);

  -- 미션 완료 처리
  UPDATE missions
  SET status = 'completed', credits_consumed = v_total_consumed
  WHERE id = p_mission_id;

  -- 환불 적용
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
