-- 094_trial_score_public_and_discount.sql
-- 무료 체험 전환율 3종 패키지:
--   ① 공개 2명 "호평 자동 선별": 어드민 미지정 시 자동 공개 = 점수 상위 2명(호평).
--      → 잠긴 쪽에 저점(치명적 지적) 패널이 남도록 의도적으로 배치(빈틈/궁금증 유발).
--      기존(087~090): 자동 공개 = 전문가·경력 상위 2명 → 점수 상위 2명으로 교체.
--   ② 30% 첫 언락 할인 + 48h 마감: 결과를 처음 연 시점(trial_results_seen_at)부터 48시간 동안
--      언락 비용 30% 할인. 마감 후 정가. (앵커가 클라 조작되면 할인이 영구화되므로 결제 컬럼으로 보호)
--   ③ (티저는 클라 표시 전용 — Results.jsx에서 잠긴 패널 점수로 "N명 중 M명 치명적 지적" 집계)
-- ※ D-121: 표시가=결제가. 공개 선별 정렬(점수 DESC, panel_id ASC tiebreaker)·할인율(0.30)·ROUND(_,2)을
--          클라(Results.jsx + honorLevels.js)와 1:1 정합. 서버가 최종 권위.
-- ※ D-122: recalc_mission_consumed·complete_mission_and_refund의 is_free_trial 격리 가드는 불변(이 RPC만 무료 회계 변경).
-- ※ D-125: trial_results_seen_at을 092 보호 컬럼 목록에 추가 → 클라 직접 UPDATE 차단(할인창 조작 방지).

-- ── 1) 결과 최초 열람 시각 컬럼 (할인 48h 앵커) ───────────────────────────────────
ALTER TABLE missions ADD COLUMN IF NOT EXISTS trial_results_seen_at TIMESTAMPTZ DEFAULT NULL;

-- ── 2) 보호 컬럼 가드에 trial_results_seen_at 추가 (092 재정의) ─────────────────────
CREATE OR REPLACE FUNCTION guard_mission_freemium_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.trial_unlocked            IS DISTINCT FROM OLD.trial_unlocked
       OR NEW.trial_public_panel_ids IS DISTINCT FROM OLD.trial_public_panel_ids
       OR NEW.credits_consumed       IS DISTINCT FROM OLD.credits_consumed
       OR NEW.credits_reserved       IS DISTINCT FROM OLD.credits_reserved
       OR NEW.unlock_cost            IS DISTINCT FROM OLD.unlock_cost
       OR NEW.is_free_trial          IS DISTINCT FROM OLD.is_free_trial
       OR NEW.trial_results_seen_at  IS DISTINCT FROM OLD.trial_results_seen_at
    THEN
      RAISE EXCEPTION 'protected_column: 무료 체험 결제 컬럼은 직접 수정할 수 없습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3) 결과 최초 열람 앵커 세팅 RPC (기업 오너 전용, 1회만 세팅) ─────────────────────
--   할인 48h 카운트다운의 시작점. NULL일 때만 NOW()로 세팅(멱등) → 이후 호출은 기존 값 반환.
CREATE OR REPLACE FUNCTION touch_trial_results_seen(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_is_free    BOOLEAN;
  v_unlocked   BOOLEAN;
  v_seen       TIMESTAMPTZ;
BEGIN
  SELECT company_id, is_free_trial, trial_unlocked, trial_results_seen_at
  INTO v_company_id, v_is_free, v_unlocked, v_seen
  FROM missions WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 소유권: 기업 오너만 (팀원/editor 미체크 — unlock RPC와 동일 한계)
  IF NOT EXISTS (
    SELECT 1 FROM companies WHERE id = v_company_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 무료 체험 + 미언락일 때만 앵커 세팅 의미가 있음
  IF v_is_free AND NOT COALESCE(v_unlocked, false) AND v_seen IS NULL THEN
    UPDATE missions SET trial_results_seen_at = NOW() WHERE id = p_mission_id
      RETURNING trial_results_seen_at INTO v_seen;
  END IF;

  RETURN jsonb_build_object('success', true, 'seen_at', v_seen);
END;
$$;

GRANT EXECUTE ON FUNCTION touch_trial_results_seen(UUID) TO authenticated;

-- ── 4) 언락 RPC 재정의 (점수기반 공개 선별 + 30%/48h 할인) ──────────────────────────
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

  -- 패널별 경력 크레딧(×메인 1.5배: 주1.5·미3·시4.5·C6) + 평균 점수(공개 선별용)
  WITH cred AS (
    SELECT
      p.id AS panel_id,
      p.is_expert,
      (CASE
        WHEN lower(coalesce(p.experience, '')) ~ '(c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN 6
        WHEN lower(coalesce(p.experience, '')) ~ '시니어' THEN 4.5
        WHEN lower(coalesce(p.experience, '')) ~ '\d' THEN
          CASE
            WHEN (regexp_match(lower(p.experience), '(\d+)'))[1]::int >= 8 THEN 4.5
            WHEN (regexp_match(lower(p.experience), '(\d+)'))[1]::int >= 4 THEN 3
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
