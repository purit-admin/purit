-- 095_panel_head_by_years.sql
-- 패널 최상위 등급 "C레벨/임원" → "헤드"로 개명 + 연차 구간 전면 재정의 (자동 부여)
--
-- 변경 핵심:
--   1) 등급 부여를 어드민 수동(is_executive 체크박스)에서 → 연차 자동 부여로 전환.
--      헤드 = experience_years >= 15 (자격득실 확인서 기준 어드민 확정 연차).
--   2) 연차 구간 재정의: 주니어 2~4(1.0×) / 미들 5~7(1.5×) / 시니어 8~14(2.0×) / 헤드 15+(3.0×).
--   3) 정산 배율·언락 크레딧은 구 C레벨과 동일 유지(헤드 3.0× / 언락 6).
--
-- 설계 원칙:
--   · 내부 career key 'clevel'은 유지(미션 description.careerLevels 호환). 한국어 라벨만 '헤드'.
--   · experience(TEXT)는 단일 진실 소스 유지하되, 헤드도 항상 'N년'으로 저장(구 '임원' 특수 텍스트 폐지).
--     → 배율/크레딧을 연차 숫자 기반으로 통일. is_executive는 (experience_years>=15) 동기화 표시용 파생 플래그.
--   · 레거시 텍스트('임원'/'시니어'/'미들') 패널 안전망: 키워드 정규식 분기는 유지하고 숫자 분기 밴드만 교체.
-- ※ D-121: unlock RPC 정렬·dedup·할인 로직은 094 그대로, 경력 크레딧 밴드 값만 교체(표시가=결제가 정합 유지).
-- ※ D-122: complete/recalc의 is_free_trial 회계 격리 가드는 불변.

-- ── 1) admin_confirm_panel_experience — 2-param 재정의 (수동 임원 지정 폐지) ─────────
--    기존 3-param(UUID, INT, BOOLEAN) DROP 후 2-param 재생성. is_executive는 연차로 자동 결정.
DROP FUNCTION IF EXISTS public.admin_confirm_panel_experience(UUID, INT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.admin_confirm_panel_experience(
  p_panel_id UUID,
  p_years    INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 어드민 전용 (app_metadata.role — D-58)
  IF (auth.jwt()->'app_metadata'->>'role') IS DISTINCT FROM 'admin' THEN
    RETURN FALSE;
  END IF;
  IF p_years IS NULL OR p_years < 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE panels
  SET
    experience_years        = p_years,
    is_executive            = (p_years >= 15),          -- 헤드 = 15년차 이상 자동
    experience_confirmed_at = NOW(),
    experience              = p_years::text || '년'      -- 헤드도 'N년'으로 저장(숫자 기반 통일)
  WHERE id = p_panel_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_panel_experience(UUID, INT) TO authenticated;

-- ── 2) auto_increment_panel_experience — experience 항상 'N년' + 헤드 자동 승급(14→15) ──
CREATE OR REPLACE FUNCTION public.auto_increment_panel_experience()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH due AS (
    SELECT id,
           EXTRACT(YEAR FROM AGE(NOW(), experience_confirmed_at))::int AS yrs
    FROM panels
    WHERE experience_confirmed_at IS NOT NULL
      AND experience_years IS NOT NULL
      AND AGE(NOW(), experience_confirmed_at) >= INTERVAL '1 year'
  )
  UPDATE panels p
  SET
    experience_years        = p.experience_years + d.yrs,
    experience_confirmed_at = p.experience_confirmed_at + (d.yrs * INTERVAL '1 year'),
    is_executive            = ((p.experience_years + d.yrs) >= 15),         -- 14→15 자동 헤드 승급
    experience              = (p.experience_years + d.yrs)::text || '년'
  FROM due d
  WHERE p.id = d.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_increment_panel_experience() TO service_role;

-- ── 3) complete_mission_and_refund — 연차 배율 밴드 교체 (085 본문 유지) ───────────────
--    숫자 분기: ≥15→3.0 / ≥8→2.0 / ≥5→1.5 / else 1.0. 키워드 분기는 레거시 안전망(헤드 추가).
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

-- ── 4) recalc_mission_consumed — 동일 밴드 교체 (085 본문 유지) ────────────────────────
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

-- ── 5) unlock_free_trial_mission — 경력 크레딧 밴드 교체 (094 본문·할인·정렬 유지) ──────
--    숫자 분기: ≥15→6 / ≥8→4.5 / ≥5→3 / else 1.5 (메인 ×1.5 반영). 키워드 분기는 레거시 안전망(헤드 추가).
CREATE OR REPLACE FUNCTION unlock_free_trial_mission(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id  UUID;
  v_is_free     BOOLEAN;
  v_unlocked    BOOLEAN;
  v_public      UUID[];
  v_seen        TIMESTAMPTZ;
  v_base        NUMERIC;   -- 정가(잠긴 패널 경력 크레딧 합)
  v_within      BOOLEAN;   -- 48h 할인창 이내 여부
  v_cost        NUMERIC;   -- 실제 차감액(할인 반영)
  v_balance     NUMERIC;
BEGIN
  SELECT company_id, is_free_trial, trial_unlocked, trial_public_panel_ids, trial_results_seen_at
  INTO v_company_id, v_is_free, v_unlocked, v_public, v_seen
  FROM missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 소유권: 기업 오너만 (팀원/editor 미체크 → unauthorized, 의도적 한계)
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

  -- 패널별 경력 크레딧(×메인 1.5배: 주1.5·미3·시4.5·헤드6) + 평균 점수(공개 선별용)
  WITH cred AS (
    SELECT
      p.id AS panel_id,
      p.is_expert,
      (CASE
        WHEN lower(coalesce(p.experience, '')) ~ '(헤드|c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN 6
        WHEN lower(coalesce(p.experience, '')) ~ '시니어' THEN 4.5
        WHEN lower(coalesce(p.experience, '')) ~ '\d' THEN
          CASE
            WHEN (regexp_match(lower(p.experience), '(\d+)'))[1]::int >= 15 THEN 6
            WHEN (regexp_match(lower(p.experience), '(\d+)'))[1]::int >= 8 THEN 4.5
            WHEN (regexp_match(lower(p.experience), '(\d+)'))[1]::int >= 5 THEN 3
            ELSE 1.5
          END
        WHEN lower(coalesce(p.experience, '')) ~ '미들' THEN 3
        ELSE 1.5
      END) AS credit,
      AVG(
        (coalesce(f.clarity_score,0) + coalesce(f.relevance_score,0) + coalesce(f.value_score,0)
         + coalesce(f.differentiation_score,0) + coalesce(f.trust_score,0)) / 5.0
      ) AS avg_score
    FROM feedbacks f
    JOIN panels p ON p.id = f.panel_id
    WHERE f.mission_id = p_mission_id
      AND f.purity_passed = true
    GROUP BY p.id, p.is_expert, p.experience
  ),
  ranked AS (
    -- 공개 = 점수 상위 2명(호평). rn 1,2 = 공개분 / rn>2 = 잠김. tiebreaker panel_id ASC (D-121)
    SELECT panel_id, credit,
           ROW_NUMBER() OVER (ORDER BY avg_score DESC, panel_id ASC) AS rn
    FROM cred
  )
  -- 어드민이 공개 패널을 지정했으면 그들을 제외(잠김)한 합, 아니면 점수 상위 2명 제외(rn>2)
  SELECT COALESCE(SUM(credit), 0) INTO v_base
  FROM ranked
  WHERE CASE
    WHEN v_public IS NOT NULL AND array_length(v_public, 1) > 0 THEN panel_id <> ALL(v_public)
    ELSE rn > 2
  END;

  -- 잠긴 패널이 없으면 비용 0 — 바로 언락 처리(할인 무의미)
  IF v_base <= 0 THEN
    UPDATE missions SET trial_unlocked = true, unlock_cost = 0 WHERE id = p_mission_id;
    RETURN jsonb_build_object('success', true, 'cost', 0, 'original_cost', 0, 'discount', false,
                              'new_balance', (SELECT credit_balance FROM companies WHERE id = v_company_id));
  END IF;

  -- 30% 첫 언락 할인: 결과 최초 열람(seen_at)부터 48h 이내. 미열람(NULL)이면 방금 연 것으로 보고 할인 적용.
  v_within := (v_seen IS NULL) OR (NOW() < v_seen + INTERVAL '48 hours');
  v_cost   := ROUND(v_base * CASE WHEN v_within THEN 0.70 ELSE 1 END, 2);  -- honorLevels.TRIAL_FIRST_UNLOCK_DISCOUNT=0.30

  SELECT credit_balance INTO v_balance FROM companies WHERE id = v_company_id FOR UPDATE;

  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS',
                              'balance', v_balance, 'required', v_cost,
                              'original_cost', v_base, 'discount', v_within);
  END IF;

  UPDATE companies SET credit_balance = credit_balance - v_cost WHERE id = v_company_id;
  UPDATE missions  SET trial_unlocked = true, credits_consumed = v_cost, unlock_cost = v_cost WHERE id = p_mission_id;

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'original_cost', v_base,
                            'discount', v_within, 'new_balance', v_balance - v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_free_trial_mission(UUID) TO authenticated;

-- ── 6) 기존 데이터 백필 (강등 포함) ──────────────────────────────────────────────────
--    확정된 패널: is_executive를 연차 기준(≥15)으로 재계산 + experience를 'N년'으로 정규화('임원' 제거).
--    → 15년 미만 기존 임원은 자동 강등(연차대로 재분류). ≥15만 헤드 유지.
--    미확정 레거시 '임원' 텍스트(confirmed_at NULL)는 미변경 → 어드민 재확정 전까지 키워드 정규식이 3.0× 유지.
UPDATE panels
SET
  is_executive = (experience_years >= 15),
  experience   = experience_years::text || '년'
WHERE experience_confirmed_at IS NOT NULL
  AND experience_years IS NOT NULL;
