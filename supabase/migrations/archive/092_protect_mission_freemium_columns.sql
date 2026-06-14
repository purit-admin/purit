-- 092_protect_mission_freemium_columns.sql
-- missions 테이블에 UPDATE RLS가 없어(인증된 전체 UPDATE 허용) 기업이 브라우저에서
-- 무료 체험 결제/언락 관련 컬럼을 직접 조작할 수 있는 구멍을 막는다.
--   ① trial_unlocked=true 직접 UPDATE → 결제 없이 전체 공개 (085 설계의 기존 구멍)
--   ② trial_public_panel_ids 전체 패널로 설정 → 잠긴 패널 0 → 언락 비용 0
-- 처리: 보호 컬럼이 변경되는데 호출자가 클라 직접(authenticated 역할)이면 차단하는 BEFORE UPDATE 트리거.
--       SECURITY DEFINER RPC는 함수 소유자(postgres) 컨텍스트로 실행되어 current_user가 다르므로 통과 →
--       기존 정상 경로(unlock_free_trial_mission·create_free_trial_mission·reserve_mission_credits·
--       recalc_mission_consumed·complete_mission_and_refund)는 그대로 동작.
-- ※ 클라가 직접 UPDATE하는 컬럼(status·dismissed·share_token·share_permissions)은 보호 대상 아님 → 정상.

-- ── 1) 보호 컬럼 변경 차단 트리거 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guard_mission_freemium_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER RPC(소유자=postgres 등) 컨텍스트면 통과. 클라 직접(authenticated/anon)만 검사.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.trial_unlocked         IS DISTINCT FROM OLD.trial_unlocked
       OR NEW.trial_public_panel_ids IS DISTINCT FROM OLD.trial_public_panel_ids
       OR NEW.credits_consumed    IS DISTINCT FROM OLD.credits_consumed
       OR NEW.credits_reserved    IS DISTINCT FROM OLD.credits_reserved
       OR NEW.unlock_cost         IS DISTINCT FROM OLD.unlock_cost
       OR NEW.is_free_trial       IS DISTINCT FROM OLD.is_free_trial
    THEN
      RAISE EXCEPTION 'protected_column: 무료 체험 결제 컬럼은 직접 수정할 수 없습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_mission_freemium ON missions;
CREATE TRIGGER trg_guard_mission_freemium
  BEFORE UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION guard_mission_freemium_columns();

-- ── 2) 어드민 전용 공개 2건 지정 RPC (트리거 우회 = SECURITY DEFINER) ─────────────
CREATE OR REPLACE FUNCTION admin_set_trial_public(p_mission_id UUID, p_panel_ids UUID[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_free BOOLEAN;
BEGIN
  -- 어드민만 (user_metadata/app_metadata 어느 쪽이든 — 091과 동일 패턴)
  IF NOT (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
    OR (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
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
