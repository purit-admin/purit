-- 111_money_rpc_idempotency.sql
-- 금전 RPC 멱등화 — 연타/동시 호출 시 이중 환불·이중 차감 방지 (니체-MONEY 전수조사, D-22/동시성)
--
--  [니체-MONEY-완료환불] complete_mission_and_refund(098 live)가 status 검사·행 잠금 없이
--    매 호출마다 v_refund = credits_reserved - consumed 를 companies.credit_balance 에 더함 →
--    어드민이 완료 버튼을 더블클릭(ConfirmModal 확인버튼 in-flight 비활성 없음)하면 같은 금액 이중 환불.
--    대칭 RPC reactivate_mission_and_reclaim(027)은 WHERE status='completed' 가드가 있어 멱등 — complete만 누락.
--    → SELECT ... FOR UPDATE + status='completed' 조기반환(credits_refunded:0) 추가. 본문 로직 불변(098 그대로).
--
--  [니체-MONEY-언락] unlock_free_trial_mission(095 live)이 missions 행을 잠그지 않고(companies만 FOR UPDATE)
--    trial_unlocked 를 읽어(stale) IF v_unlocked 가드 통과 → 동시/연타 두 트랜잭션이 각자 credit_balance 차감.
--    → missions SELECT 에 FOR UPDATE 추가(첫 트랜잭션 커밋까지 두 번째 직렬화 → already_unlocked 반환). 본문 불변(095 그대로).
--
-- ⚠️ Supabase SQL Editor 수동 실행 필요. 둘 다 CREATE OR REPLACE(시그니처·GRANT 동일) — 클라이언트 무변경.

-- ─── 1) complete_mission_and_refund: status 가드 + 행 잠금 (098 본문 보존) ───────────────
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
  v_status           TEXT;
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

  -- 행 잠금: 동시/연타 직렬화 (D-22 동시성)
  SELECT company_id, credits_reserved, type, is_free_trial, status
  INTO v_company_id, v_credits_reserved, v_mission_type, v_is_free, v_status
  FROM missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 멱등 가드: 이미 완료된 미션은 재환불 금지 (두 번째 호출은 환불 0으로 무해 반환)
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'credits_refunded', 0);
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

GRANT EXECUTE ON FUNCTION complete_mission_and_refund(UUID) TO authenticated;

-- ─── 2) unlock_free_trial_mission: missions 행 잠금 (095 본문 보존) ──────────────────────
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
  -- 행 잠금: 동시/연타 직렬화 → 두 번째 트랜잭션은 첫 커밋(trial_unlocked=true) 후 already_unlocked 반환
  SELECT company_id, is_free_trial, trial_unlocked, trial_public_panel_ids, trial_results_seen_at
  INTO v_company_id, v_is_free, v_unlocked, v_public, v_seen
  FROM missions
  WHERE id = p_mission_id
  FOR UPDATE;

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
