-- 089_trial_admin_public_select.sql
-- 무료 체험 의뢰의 "공개 2건"을 어드민이 직접 지정할 수 있게 한다.
--   기존(087): 공개 2명 = 전문가 우선·경력순 상위 2명 자동 규칙 (클라 Results + 서버 RPC 양쪽 하드코딩)
--   변경: missions.trial_public_panel_ids(UUID[])에 어드민이 고른 공개 패널 2명을 저장.
--         값이 있으면 그 패널이 공개분 → 언락 비용 = 나머지(잠긴) 승인 패널의 경력 크레딧 합.
--         NULL이면 기존 자동 상위 2명 규칙으로 폴백(하위 호환).
--   ※ 어드민 저장은 별도 RPC 불필요 — missions UPDATE RLS가 '인증된 전체'라 클라에서 직접 UPDATE.
--   ※ 경력 크레딧: 주니어 1 / 미들 2 / 시니어 3 / C레벨 4 (honorLevels.getCareerUnlockCredit와 일치)

-- 1) 어드민 지정 공개 패널 컬럼 (nullable, default NULL → 기존 행 위반 없음)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS trial_public_panel_ids UUID[] DEFAULT NULL;

-- 2) 언락 비용 계산에 어드민 지정값 우선 반영
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
  v_cost        NUMERIC;
  v_balance     NUMERIC;
BEGIN
  SELECT company_id, is_free_trial, trial_unlocked, trial_public_panel_ids
  INTO v_company_id, v_is_free, v_unlocked, v_public
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

  -- 각 승인 패널의 경력 크레딧 산정 (DISTINCT ON: 한 패널 복수 승인 시 1회만)
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
    SELECT panel_id, credit, ROW_NUMBER() OVER (ORDER BY is_expert DESC, credit DESC, panel_id ASC) AS rn FROM cred
  )
  -- 어드민이 공개 패널을 지정했으면 그들을 제외(잠김)한 합, 아니면 자동 상위 2명 제외(rn>2)
  SELECT COALESCE(SUM(credit), 0) INTO v_cost
  FROM ranked
  WHERE CASE
    WHEN v_public IS NOT NULL AND array_length(v_public, 1) > 0 THEN panel_id <> ALL(v_public)
    ELSE rn > 2
  END;

  -- 잠긴 패널이 없으면 비용 0 — 바로 언락 처리
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
