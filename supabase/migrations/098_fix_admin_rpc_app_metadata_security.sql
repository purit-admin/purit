-- 098_fix_admin_rpc_app_metadata_security.sql
-- 어드민 권한 RPC 7종의 role 체크를 raw_user_meta_data → raw_app_meta_data 로 일괄 교체 (D-58).
--
-- 배경:
--   raw_user_meta_data 는 supabase.auth.updateUser({ data:{ role:'admin' } }) 로 본인이 변조 가능.
--   따라서 user_metadata 기반 admin 게이트는 일반 사용자가 자기 역할을 'admin'으로 위조해
--   어드민 전용 RPC(크레딧 지급/플랜 변경/완료 환불 등)를 직접 호출하는 권한 상승 구멍이 됨.
--   raw_app_meta_data 는 service_role 만 수정 가능 → 위조 불가 (RLS 정책은 026에서 이미 app_metadata 전환됨).
--
-- 대상 7종 (각 함수의 '최신 정의' 본문을 그대로 유지하고 권한 체크 한 곳만 교체):
--   1) admin_add_credits              (024 본문)  user_metadata 단독 →
--   2) complete_mission_and_refund    (095 본문)  user_metadata 단독 →
--   3) recalc_mission_consumed        (095 본문)  user_metadata 단독 →
--   4) admin_change_plan              (097 본문)  app OR user 폴백 →
--   5) admin_delete_trial_mission     (091 본문)  user OR app →
--   6) admin_set_trial_public         (092 본문)  user OR app →
--   7) admin_set_trial_mission_status (093 본문)  user OR app →
--   → 전부 "NOT EXISTS(app_metadata=admin)" 단일 게이트로 통일.
--
-- ★ NULL 안전성: 일반 사용자의 app_metadata.role 은 NULL 이므로
--   `(app_role) <> 'admin'` / `NOT ((app_role)='admin')` 형태는 NULL 비교가 거짓이 되어 게이트가 통과(=구멍)됨.
--   → 반드시 NOT EXISTS(... = 'admin') 형태로 작성해야 NULL 사용자가 차단됨.
--
-- ※ 멱등 안전망: 수동 마이그레이션 환경에서 026 미적용 가능성에 대비해
--   app_metadata 동기화 UPDATE 를 선두에 포함(self-contained). 이미 적용됐어도 무해.
--   ※ guard_mission_freemium_columns(092/094)는 current_user(PostgreSQL 역할, 위조 불가) 기반이라 대상 아님.
--   ※ grant_plan_credits(096)·unlock_free_trial_mission(095)·reserve_mission_credits(018)는
--      owner(auth.uid=company.user_id) 게이트라 D-58 무관 — 대상 아님.

-- ─── 0. 어드민 app_metadata 동기화 (026 멱등 재실행 — 게이트 전환 후 어드민 잠김 방지) ───────
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE raw_user_meta_data->>'role' = 'admin'
  AND COALESCE(raw_app_meta_data->>'role', '') <> 'admin';

-- ─── 1. admin_add_credits (024 본문 + app_metadata 게이트) ────────────────────────────
CREATE OR REPLACE FUNCTION admin_add_credits(
  p_company_id UUID,
  p_amount     NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- 어드민 권한 검증 (app_metadata — D-58, NULL 안전)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
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

GRANT EXECUTE ON FUNCTION admin_add_credits(UUID, NUMERIC) TO authenticated;

-- ─── 2. complete_mission_and_refund (095 본문 + app_metadata 게이트) ──────────────────
CREATE OR REPLACE FUNCTION complete_mission_and_refund(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id       UUID;
  v_credits_reserved NUMERIC;
  v_mission_type     TEXT;
  v_is_free          BOOLEAN;
  v_mission_factor   NUMERIC;
  v_total_consumed   NUMERIC := 0;
  v_refund           NUMERIC;
  v_exp              TEXT;
  v_multiplier       NUMERIC;
  v_year_text        TEXT;
  v_years            INTEGER;
  v_panel            RECORD;
BEGIN
  -- 어드민 권한 검증 (app_metadata — D-58, NULL 안전)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT company_id, credits_reserved, type, is_free_trial
  INTO v_company_id, v_credits_reserved, v_mission_type, v_is_free
  FROM missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 무료체험 미션: 회계 격리 — 환불·소비 재계산 없이 상태만 완료 (D-122)
  IF v_is_free THEN
    UPDATE missions SET status = 'completed' WHERE id = p_mission_id;
    RETURN jsonb_build_object('success', true, 'free_trial', true, 'credits_refunded', 0);
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

    IF v_exp ~ '(헤드|c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN
      v_multiplier := 3.0;
    ELSIF v_exp ~ '시니어' THEN
      v_multiplier := 2.0;
    ELSIF v_exp ~ '\d' THEN
      v_year_text := (regexp_match(v_exp, '(\d+)'))[1];
      IF v_year_text IS NOT NULL THEN
        v_years := v_year_text::INTEGER;
        IF v_years >= 15 THEN
          v_multiplier := 3.0;
        ELSIF v_years >= 8 THEN
          v_multiplier := 2.0;
        ELSIF v_years >= 5 THEN
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

-- ─── 3. recalc_mission_consumed (095 본문 + app_metadata 게이트) ──────────────────────
CREATE OR REPLACE FUNCTION recalc_mission_consumed(p_mission_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission_type   TEXT;
  v_is_free        BOOLEAN;
  v_mission_factor NUMERIC;
  v_total          NUMERIC := 0;
  v_exp            TEXT;
  v_multiplier     NUMERIC;
  v_year_text      TEXT;
  v_years          INTEGER;
  v_panel          RECORD;
BEGIN
  -- 어드민 권한 검증 (app_metadata — D-58, NULL 안전)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT type, is_free_trial INTO v_mission_type, v_is_free FROM missions WHERE id = p_mission_id;

  -- 무료 미션: 재계산 제외 (credits_consumed 는 unlock_free_trial_mission 이 관리, D-122)
  IF v_is_free THEN
    RETURN (SELECT credits_consumed FROM missions WHERE id = p_mission_id);
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

    IF v_exp ~ '(헤드|c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN
      v_multiplier := 3.0;
    ELSIF v_exp ~ '시니어' THEN
      v_multiplier := 2.0;
    ELSIF v_exp ~ '\d' THEN
      v_year_text := (regexp_match(v_exp, '(\d+)'))[1];
      IF v_year_text IS NOT NULL THEN
        v_years := v_year_text::INTEGER;
        IF v_years >= 15 THEN
          v_multiplier := 3.0;
        ELSIF v_years >= 8 THEN
          v_multiplier := 2.0;
        ELSIF v_years >= 5 THEN
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

-- ─── 4. admin_change_plan (097 본문 + app_metadata 단일 게이트) ───────────────────────
CREATE OR REPLACE FUNCTION admin_change_plan(
  p_company_id UUID,
  p_plan       TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  -- 어드민 권한 검증 (app_metadata 단독 — D-58, NULL 안전 / user_metadata 폴백 제거)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
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
      addon_credits   = 0,
      plan_started_at = NOW(),
      next_billing_at = NOW() + INTERVAL '1 month'
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company not found';
  END IF;
END;
$$;

-- ─── 5. admin_delete_trial_mission (091 본문 + app_metadata 단일 게이트) ──────────────
CREATE OR REPLACE FUNCTION admin_delete_trial_mission(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_is_free    BOOLEAN;
BEGIN
  -- 어드민만 (app_metadata 단독 — D-58, NULL 안전 / user OR app 폴백 제거)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT company_id, is_free_trial INTO v_company_id, v_is_free
  FROM missions WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 미션 삭제 (자식 행은 CASCADE)
  DELETE FROM missions WHERE id = p_mission_id;

  -- 무료 체험 의뢰였다면 기업의 무료 체험 기회 복구
  IF v_is_free AND v_company_id IS NOT NULL THEN
    UPDATE companies SET free_trial_used = false WHERE id = v_company_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'free_trial_restored', COALESCE(v_is_free, false));
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_trial_mission(UUID) TO authenticated;

-- ─── 6. admin_set_trial_public (092 본문 + app_metadata 단일 게이트) ──────────────────
CREATE OR REPLACE FUNCTION admin_set_trial_public(p_mission_id UUID, p_panel_ids UUID[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_free BOOLEAN;
BEGIN
  -- 어드민만 (app_metadata 단독 — D-58, NULL 안전 / user OR app 폴백 제거)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT is_free_trial INTO v_is_free FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;
  IF NOT v_is_free THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FREE_TRIAL');
  END IF;

  -- 공개는 정확히 2건 (freemium 모델 고정)
  IF p_panel_ids IS NULL OR array_length(p_panel_ids, 1) <> 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MUST_BE_TWO');
  END IF;

  UPDATE missions SET trial_public_panel_ids = p_panel_ids WHERE id = p_mission_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_trial_public(UUID, UUID[]) TO authenticated;

-- ─── 7. admin_set_trial_mission_status (093 본문 + app_metadata 단일 게이트) ──────────
CREATE OR REPLACE FUNCTION admin_set_trial_mission_status(p_mission_id UUID, p_new_status TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_is_free    BOOLEAN;
BEGIN
  -- 취소/재개만 허용 (그 외 상태 전환은 이 RPC 대상 아님)
  IF p_new_status NOT IN ('cancelled', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  -- 어드민만 (app_metadata 단독 — D-58, NULL 안전 / user OR app 폴백 제거)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT company_id, is_free_trial INTO v_company_id, v_is_free
  FROM missions WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 상태 전환
  UPDATE missions SET status = p_new_status WHERE id = p_mission_id;

  -- 무료 체험 의뢰면 기회 토글: 취소→false(복구) / 재개→true(재소진)
  IF v_is_free AND v_company_id IS NOT NULL THEN
    UPDATE companies
      SET free_trial_used = (p_new_status = 'active')
      WHERE id = v_company_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_free_trial', COALESCE(v_is_free, false),
    'free_trial_used', (p_new_status = 'active')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_trial_mission_status(UUID, TEXT) TO authenticated;
