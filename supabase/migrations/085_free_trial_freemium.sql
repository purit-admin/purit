-- 085_free_trial_freemium.sql
-- 기업 무료 체험 + 부분 언락(Freemium) 시스템
-- 변경 범위:
--   1) companies/missions/panels 컬럼 추가 + plan DEFAULT 'free_trial'
--   2) 가입 경로(handle_new_user / create_oauth_user_profile) 기본 plan 'free_trial'
--   3) admin_change_plan / grant_plan_credits 에 'free_trial'(크레딧 0) 반영
--   4) notify_admin_on_mission 재정의 — 무료체험 첫 의뢰 시 전 어드민 강한 알림
--   5) complete_mission_and_refund 재정의 — 무료 미션 회계 격리(환불/소비 재계산 제외)
--   6) create_free_trial_mission / unlock_free_trial_mission RPC 신규
-- 주의: companies.plan / missions.status 는 CHECK 제약 없음(앱 레벨 enforce) — D-117 무관
--      slot RPC(057/058) · reserve_mission_credits(018) 는 무료 미션과 무관 → 미수정

-- ─── 1. 스키마 변경 ───────────────────────────────────────────────────────────

ALTER TABLE companies ADD COLUMN IF NOT EXISTS free_trial_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE companies ALTER COLUMN plan SET DEFAULT 'free_trial';  -- 신규 가입에만 적용(기존 데이터 미변경)

ALTER TABLE missions ADD COLUMN IF NOT EXISTS is_free_trial  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS trial_unlocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS unlock_cost    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE panels ADD COLUMN IF NOT EXISTS is_expert BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. handle_new_user 재정의 (이메일 가입: companies plan='free_trial') ─────
-- 071 본문 유지 + companies INSERT 에 plan 명시

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'panel' THEN
    INSERT INTO public.panels (user_id, name, email, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF NEW.raw_user_meta_data->>'role' = 'company'
    AND (
      NEW.raw_user_meta_data->>'invite_token' IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE invite_token::text = NEW.raw_user_meta_data->>'invite_token'
          AND status = 'invited'
      )
    ) THEN
    INSERT INTO public.companies (user_id, name, email, plan)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'free_trial'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 3. create_oauth_user_profile 재정의 (OAuth 가입: plan='free_trial') ──────
-- 072 본문 유지 + companies INSERT plan 'starter' → 'free_trial' (시그니처 동일)

CREATE OR REPLACE FUNCTION public.create_oauth_user_profile(
  p_role         TEXT,
  p_display_name TEXT,
  p_invite_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_user_email   TEXT;
  v_existing_id  UUID;
  v_skip_company BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF p_role = 'panel' THEN
    SELECT id INTO v_existing_id FROM panels WHERE user_id = v_user_id;
    IF v_existing_id IS NULL THEN
      INSERT INTO panels (
        user_id, name, email, status, trust_score, total_missions, honor_points, selected_badge
      ) VALUES (
        v_user_id, p_display_name, v_user_email, 'pending', 0, 0, 0, NULL
      );
    END IF;

  ELSIF p_role = 'company' THEN
    v_skip_company := (
      p_invite_token IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE invite_token::text = p_invite_token
          AND status = 'invited'
      )
    );

    IF NOT v_skip_company THEN
      SELECT id INTO v_existing_id FROM companies WHERE user_id = v_user_id;
      IF v_existing_id IS NULL THEN
        INSERT INTO companies (
          user_id, name, email, plan, credit_balance
        ) VALUES (
          v_user_id, p_display_name, v_user_email, 'free_trial', 0
        );
      END IF;
    END IF;

  ELSE
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_oauth_user_profile(TEXT, TEXT, TEXT) TO authenticated;

-- ─── 4. admin_change_plan 재정의 ('free_trial' 허용, 크레딧 0) ────────────────

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

  UPDATE companies
  SET plan = p_plan, credit_balance = v_credits
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company not found';
  END IF;
END;
$$;

-- ─── 5. grant_plan_credits 재정의 (CASE에 'free_trial' THEN 0, 079 본문 유지) ──

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
    WHEN 'free_trial' THEN 0
    WHEN 'starter'    THEN 50
    WHEN 'pro'        THEN 165
    WHEN 'enterprise' THEN 400
    ELSE 0
  END;

  SELECT name INTO v_co_name
  FROM companies
  WHERE id = p_company_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE companies
  SET plan = p_plan, credit_balance = v_credits
  WHERE id = p_company_id;

  IF p_amount_krw > 0 THEN
    INSERT INTO invoices
      (company_id, company_name, plan, amount, status, payment_type, credits_amount, payment_method)
    VALUES
      (p_company_id, v_co_name, p_plan, p_amount_krw, 'paid', 'plan', v_credits, p_method);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_plan_credits(UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ─── 6. notify_admin_on_mission 재정의 (무료체험 첫 의뢰 = 전 어드민 강한 알림) ─

CREATE OR REPLACE FUNCTION notify_admin_on_mission()
RETURNS TRIGGER AS $$
DECLARE v_admin_id UUID;
BEGIN
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_free_trial THEN
    -- 무료체험 첫 의뢰: 전 어드민에게 강한 알림 (전문가 슬롯 선점 필요)
    FOR v_admin_id IN
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
      VALUES (v_admin_id, 'warning', '🔥', '[무료체험] 첫 의뢰 — 즉시 대응 필요',
              '무료체험 기업 첫 의뢰: ' || NEW.title || ' — 전문가 패널 슬롯 선점이 필요합니다.',
              '/admin/trials?id=' || NEW.id::text, 'admin');
    END LOOP;
  ELSE
    SELECT id INTO v_admin_id FROM auth.users
    WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1;
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role)
      VALUES (v_admin_id, 'info', '📋', '새 의뢰 등록',
              '새로운 의뢰가 등록되었습니다: ' || NEW.title, '/admin/missions', 'admin');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 7. complete_mission_and_refund 재정의 (무료 미션 회계 격리) ──────────────
-- 018 본문 유지 + 무료 미션이면 환불/소비 재계산 없이 완료만 (언락 시 set된 credits_consumed 보존)

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
  IF (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT company_id, credits_reserved, type, is_free_trial
  INTO v_company_id, v_credits_reserved, v_mission_type, v_is_free
  FROM missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 무료체험 미션: 회계 격리 — 환불·소비 재계산 없이 상태만 완료
  -- (credits_consumed 는 unlock_free_trial_mission 이 set한 값 보존, 미언락이면 0 유지)
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

-- ─── 8. create_free_trial_mission (무료 등록 — reserve 우회 + 1계정1회) ────────
-- NewMission.jsx: missions INSERT(status='draft') 후 호출 → 원자적으로 active 전환

CREATE OR REPLACE FUNCTION create_free_trial_mission(
  p_mission_id  UUID,
  p_company_id  UUID,
  p_unlock_cost NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_used BOOLEAN;
BEGIN
  -- 소유권 + 무료 자격 검증 (행 잠금으로 1계정 1회 동시성 보장)
  SELECT plan, free_trial_used INTO v_plan, v_used
  FROM companies
  WHERE id = p_company_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF v_plan <> 'free_trial' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FREE_TRIAL');
  END IF;

  IF v_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'TRIAL_ALREADY_USED');
  END IF;

  -- 미션을 무료체험으로 표시 + active 전환 (트리거 notify_admin_on_mission 발화)
  UPDATE missions
  SET is_free_trial    = true,
      credits_reserved = 0,
      unlock_cost      = p_unlock_cost,
      status           = 'active'
  WHERE id = p_mission_id AND company_id = p_company_id AND status = 'draft';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  UPDATE companies SET free_trial_used = true WHERE id = p_company_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION create_free_trial_mission(UUID, UUID, NUMERIC) TO authenticated;

-- ─── 9. unlock_free_trial_mission (크레딧 소모 → 전체 결과 언락) ──────────────

CREATE OR REPLACE FUNCTION unlock_free_trial_mission(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id  UUID;
  v_is_free     BOOLEAN;
  v_unlocked    BOOLEAN;
  v_unlock_cost NUMERIC;
  v_balance     NUMERIC;
BEGIN
  SELECT company_id, is_free_trial, trial_unlocked, unlock_cost
  INTO v_company_id, v_is_free, v_unlocked, v_unlock_cost
  FROM missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 소유권: 기업 오너만 (팀원/editor는 team_members 미체크 → unauthorized, 의도적 한계)
  IF NOT EXISTS (
    SELECT 1 FROM companies WHERE id = v_company_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF NOT v_is_free THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FREE_TRIAL');
  END IF;

  IF v_unlocked THEN
    RETURN jsonb_build_object('success', true, 'already_unlocked', true);
  END IF;

  SELECT credit_balance INTO v_balance
  FROM companies WHERE id = v_company_id FOR UPDATE;

  IF v_balance < v_unlock_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS',
                              'balance', v_balance, 'required', v_unlock_cost);
  END IF;

  UPDATE companies SET credit_balance = credit_balance - v_unlock_cost WHERE id = v_company_id;
  UPDATE missions  SET trial_unlocked = true, credits_consumed = v_unlock_cost WHERE id = p_mission_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - v_unlock_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_free_trial_mission(UUID) TO authenticated;

-- ─── 10. get_panel_public_profiles 재정의 (is_expert 추가 — 결과 "공개 2개" 정렬키) ─
-- 기업은 panels 를 직접 조회 못함(RLS) → 무료체험 결과의 전문가 우선 노출을 위해 is_expert 공개

DROP FUNCTION IF EXISTS get_panel_public_profiles(UUID);

CREATE OR REPLACE FUNCTION get_panel_public_profiles(p_mission_id UUID)
RETURNS TABLE(panel_id UUID, industry TEXT, experience TEXT, is_expert BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS panel_id,
    p.industry,
    p.experience,
    p.is_expert
  FROM feedbacks f
  JOIN panels p ON p.id = f.panel_id
  WHERE f.mission_id = p_mission_id
    AND f.status != 'draft';
END;
$$;

GRANT EXECUTE ON FUNCTION get_panel_public_profiles(UUID) TO authenticated;

-- ─── 11b. recalc_mission_consumed 가드 (무료 미션은 credits_consumed 재계산 제외) ─
-- 피드백 승인 시 호출되는 recalc가 무료 미션의 credits_consumed를 덮어쓰면
-- 미언락인데도 소비가 잡혀 Revenue 왜곡 → 무료 미션이면 조기 반환(언락 RPC만 set)

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
  IF (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT type, is_free_trial INTO v_mission_type, v_is_free FROM missions WHERE id = p_mission_id;

  -- 무료 미션: 재계산 제외 (credits_consumed 는 unlock_free_trial_mission 이 관리)
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

-- ─── 11. get_shared_mission 가드 (무료 체험 미언락 미션 공유 누출 차단) ─────────
-- 076 본문 유지 + 무료 미언락이면 코멘트/어노테이션 강제 비공개(점수 집계는 공개 유지)
-- ※ 클라이언트가 미언락 미션 공유 UI를 차단하므로 토큰 생성 자체가 막히지만, 서버 belt-and-suspenders

CREATE OR REPLACE FUNCTION get_shared_mission(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id           UUID;
  v_title        TEXT;
  v_type         TEXT;
  v_description  TEXT;
  v_image_urls   TEXT[];
  v_persona      TEXT;
  v_created      TIMESTAMPTZ;
  v_perms        JSONB;
  v_locked       BOOLEAN;
  v_count        INT;
  v_clarity      NUMERIC;
  v_relevance    NUMERIC;
  v_value        NUMERIC;
  v_diff         NUMERIC;
  v_trust        NUMERIC;
  v_feedbacks    JSONB;
  v_annotations  JSONB;
  v_sub_resp     JSONB;
  v_is_image     BOOLEAN;
  v_is_sub       BOOLEAN;
BEGIN
  -- 미션 기본 정보 조회 (무료 미언락 잠금 상태 포함)
  SELECT id, title, type, description, image_urls, persona, created_at,
         COALESCE(share_permissions, '{"show_comments": true, "show_annotations": true}'::jsonb),
         (is_free_trial AND NOT trial_unlocked)
    INTO v_id, v_title, v_type, v_description, v_image_urls, v_persona, v_created, v_perms, v_locked
    FROM missions
   WHERE share_token = p_token;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  -- 무료 체험 미언락: 코멘트/어노테이션 강제 비공개 (점수 집계는 공개)
  IF v_locked THEN
    v_perms := '{"show_comments": false, "show_annotations": false}'::jsonb;
  END IF;

  v_is_image := (v_image_urls IS NOT NULL AND array_length(v_image_urls, 1) > 0);
  v_is_sub   := v_type IN ('preference', 'pricing', 'email');

  SELECT
    COUNT(*),
    AVG(clarity_score),
    AVG(relevance_score),
    AVG(value_score),
    AVG(differentiation_score),
    AVG(trust_score)
  INTO v_count, v_clarity, v_relevance, v_value, v_diff, v_trust
  FROM feedbacks
  WHERE mission_id = v_id
    AND purity_passed = true;

  IF COALESCE((v_perms->>'show_comments')::boolean, true) THEN
    SELECT jsonb_agg(row_data)
    INTO v_feedbacks
    FROM (
      SELECT jsonb_build_object(
        'idx',                    ROW_NUMBER() OVER (ORDER BY created_at),
        'suggestions',            suggestions,
        'clarity_score',          clarity_score,
        'relevance_score',        relevance_score,
        'value_score',            value_score,
        'differentiation_score',  differentiation_score,
        'trust_score',            trust_score
      ) AS row_data
      FROM feedbacks
      WHERE mission_id = v_id
        AND purity_passed = true
        AND status != 'draft'
    ) t;
  END IF;

  IF v_is_image AND COALESCE((v_perms->>'show_annotations')::boolean, true) THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'dimension',   fa.dimension,
        'x_pct',       fa.x_pct,
        'y_pct',       fa.y_pct,
        'w_pct',       fa.w_pct,
        'h_pct',       fa.h_pct,
        'comment',     fa.comment,
        'score',       fa.score,
        'image_index', fa.image_index
      ) ORDER BY fa.created_at
    )
    INTO v_annotations
    FROM feedback_annotations fa
    WHERE fa.mission_id = v_id
      AND EXISTS (
        SELECT 1 FROM feedbacks f
        WHERE f.id = fa.feedback_id AND f.purity_passed = true
      );
  END IF;

  IF v_is_sub THEN
    IF v_type = 'preference' THEN
      SELECT jsonb_build_object(
        'choice_a_count',       COUNT(*) FILTER (WHERE preference = 'A'),
        'choice_b_count',       COUNT(*) FILTER (WHERE preference = 'B'),
        'avg_message_clarity',  ROUND(COALESCE(AVG(message_clarity),  0)::NUMERIC, 1),
        'avg_purchase_intent',  ROUND(COALESCE(AVG(purchase_intent),  0)::NUMERIC, 1)
      )
      INTO v_sub_resp
      FROM preference_responses
      WHERE mission_id = v_id;

    ELSIF v_type = 'pricing' THEN
      SELECT jsonb_build_object(
        'would_buy_count',      COUNT(*) FILTER (WHERE would_buy = true),
        'total_count',          COUNT(*),
        'avg_price_fairness',   ROUND(COALESCE(AVG(price_fairness),   0)::NUMERIC, 1),
        'avg_value_perception', ROUND(COALESCE(AVG(value_perception), 0)::NUMERIC, 1)
      )
      INTO v_sub_resp
      FROM pricing_responses
      WHERE mission_id = v_id;

    ELSIF v_type = 'email' THEN
      SELECT jsonb_build_object(
        'would_reply_count',    COUNT(*) FILTER (WHERE would_reply = true),
        'total_count',          COUNT(*),
        'avg_open_intent',      ROUND(COALESCE(AVG(open_intent),      0)::NUMERIC, 1),
        'avg_hook_score',       ROUND(COALESCE(AVG(hook_score),       0)::NUMERIC, 1),
        'avg_clarity_score',    ROUND(COALESCE(AVG(clarity_score),    0)::NUMERIC, 1),
        'avg_curiosity_score',  ROUND(COALESCE(AVG(curiosity_score),  0)::NUMERIC, 1)
      )
      INTO v_sub_resp
      FROM email_responses
      WHERE mission_id = v_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'title',             v_title,
    'type',              v_type,
    'description',       v_description,
    'image_urls',        to_jsonb(v_image_urls),
    'persona',           v_persona,
    'created_at',        v_created,
    'feedback_count',    COALESCE(v_count, 0),
    'share_permissions', v_perms,
    'scores', jsonb_build_object(
      'clarity',         ROUND(COALESCE(v_clarity,   0)::NUMERIC, 1),
      'relevance',       ROUND(COALESCE(v_relevance, 0)::NUMERIC, 1),
      'value',           ROUND(COALESCE(v_value,     0)::NUMERIC, 1),
      'differentiation', ROUND(COALESCE(v_diff,      0)::NUMERIC, 1),
      'trust',           ROUND(COALESCE(v_trust,     0)::NUMERIC, 1)
    ),
    'feedbacks',         COALESCE(v_feedbacks,   '[]'::jsonb),
    'annotations',       COALESCE(v_annotations, '[]'::jsonb),
    'sub_responses',     v_sub_resp
  );
END;
$$;
