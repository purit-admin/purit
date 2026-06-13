-- 087_free_trial_unlock_by_career.sql
-- 무료 체험 언락 비용을 "실제 참여 패널의 경력 기준"으로 동적 산정.
--   기존: missions.unlock_cost (등록 시점 최대 추정치)를 그대로 소모
--   변경: 잠긴 패널(전문가/경력 상위 2명 = 무료 공개분 제외)의 경력 크레딧 합을 소모
--         경력 크레딧: 주니어 1 / 미들 2 / 시니어 3 / C레벨 4 (honorLevels.getCareerUnlockCredit와 일치)
--   ※ 클라이언트(Results)도 동일 규칙으로 패널별·총합 표시 — 서버가 최종 권위

CREATE OR REPLACE FUNCTION unlock_free_trial_mission(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id  UUID;
  v_is_free     BOOLEAN;
  v_unlocked    BOOLEAN;
  v_cost        NUMERIC;
  v_balance     NUMERIC;
BEGIN
  SELECT company_id, is_free_trial, trial_unlocked
  INTO v_company_id, v_is_free, v_unlocked
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

  -- 동적 비용 = 잠긴 패널(상위 2명 = 무료 공개분 제외)의 경력 크레딧 합
  -- DISTINCT ON (p.id): 한 패널이 복수 승인 피드백을 가져도 1회만 계산(클라 dedup과 일치)
  -- tiebreaker panel_id: 동점 시 결정론적 순서(클라 표시와 잠금집합 합계 일치 보장)
  WITH cred AS (
    SELECT DISTINCT ON (p.id)
      p.id AS panel_id,
      p.is_expert,
      (CASE
        WHEN lower(coalesce(p.experience, '')) ~ '(c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사)' THEN 4
        WHEN lower(coalesce(p.experience, '')) ~ '시니어' THEN 3
        WHEN lower(coalesce(p.experience, '')) ~ '\d' THEN
          CASE
            WHEN (regexp_match(lower(p.experience), '(\d+)'))[1]::int >= 8 THEN 3
            WHEN (regexp_match(lower(p.experience), '(\d+)'))[1]::int >= 4 THEN 2
            ELSE 1
          END
        WHEN lower(coalesce(p.experience, '')) ~ '미들' THEN 2
        ELSE 1
      END) AS credit
    FROM feedbacks f
    JOIN panels p ON p.id = f.panel_id
    WHERE f.mission_id = p_mission_id
      AND f.purity_passed = true
    ORDER BY p.id
  ),
  ranked AS (
    SELECT credit, ROW_NUMBER() OVER (ORDER BY is_expert DESC, credit DESC, panel_id ASC) AS rn FROM cred
  )
  SELECT COALESCE(SUM(credit), 0) INTO v_cost FROM ranked WHERE rn > 2;

  -- 잠긴 패널이 없으면(승인 2건 이하) 비용 0 — 바로 언락 처리
  IF v_cost <= 0 THEN
    UPDATE missions SET trial_unlocked = true, unlock_cost = 0 WHERE id = p_mission_id;
    RETURN jsonb_build_object('success', true, 'cost', 0,
                              'new_balance', (SELECT credit_balance FROM companies WHERE id = v_company_id));
  END IF;

  SELECT credit_balance INTO v_balance FROM companies WHERE id = v_company_id FOR UPDATE;

  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS',
                              'balance', v_balance, 'required', v_cost);
  END IF;

  UPDATE companies SET credit_balance = credit_balance - v_cost WHERE id = v_company_id;
  UPDATE missions  SET trial_unlocked = true, credits_consumed = v_cost, unlock_cost = v_cost WHERE id = p_mission_id;

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'new_balance', v_balance - v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_free_trial_mission(UUID) TO authenticated;
