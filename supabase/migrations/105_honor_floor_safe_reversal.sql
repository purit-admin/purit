-- 105_honor_floor_safe_reversal.sql
-- 명예 포인트(honor_points) "0 바닥 클램프 → 되돌릴 때 과다 적립" 버그 수정.
--
-- 배경(공통 원인):
--   honor_points 는 GREATEST(0, ...) 로 0 밑으로 못 내려가게 막혀 있다.
--   그런데 "도움됨/안됨 평가"와 "반려 패널티"는 토글/취소로 되돌릴 수 있는 가역 연산이다.
--   기존 구현은 되돌릴 때 "원래 의도한 델타 전체"를 다시 더해줬다.
--   → 차감이 0 바닥에 부딪혀 일부가 잘려나가면(증발), 되돌릴 때 그 증발분만큼 과다 적립된다.
--   예) 20점(기본5+도움됨15) → 도움안됨(-35) = -15 → 0(증발 15) → 다시 도움됨(+35) = 35  (정상은 20)
--
-- 해결(공통 원칙 — "실제 적용한 양을 기록하고 정확히 그만큼만 되돌린다"):
--   각 가역 연산이 "실제로 적용한 honor 변화량"을 그 행에 저장해 두고,
--   되돌릴 때는 의도값이 아니라 "저장된 실제 적용량"만 역으로 적용한다.
--   → 0 바닥은 그대로 유지(음수 표시 없음). 클라이언트/다른 화면 수정 불필요.
--
-- 대상 2종:
--   1) rate_panel_feedback_helpfulness  (도움됨 +15 / 안됨 -20 / 변경 ±35)  — 기업 본인 게이트 유지
--   2) reject_feedback_honor / restore_feedback_honor  (반려 -5 / 복원 +5)  — 어드민 게이트(신규 RPC)
--      ※ 기존 add_panel_honor_points(+5/-5) 직접 호출(PurityFilter·TrialMissions)을 이 RPC로 교체.
--        add_panel_honor_points 자체는 미션 제출 +5(비가역 1회성)에 계속 사용 — 변경하지 않음.

-- ─── 0. 어드민 app_metadata 동기화 (026 멱등 — 098 패턴, 어드민 잠김 방지) ────────────────
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE raw_user_meta_data->>'role' = 'admin'
  AND COALESCE(raw_app_meta_data->>'role', '') <> 'admin';

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. 도움됨/안됨 평가 — 가역 정확화
-- ════════════════════════════════════════════════════════════════════════════════

-- 평가 1건이 실제로 적용한 honor 변화량을 보관. 되돌림(취소/변경)의 기준값.
ALTER TABLE feedback_helpfulness_ratings
  ADD COLUMN IF NOT EXISTS applied_hp_delta INT NOT NULL DEFAULT 0;

-- 기존 행 백필: 과거에는 의도값 전체를 적용했다고 가정(도움됨 +15 / 안됨 -20).
-- (역사적 0 바닥 절단 여부는 알 수 없으나, 구 코드의 되돌림 가정과 동일 → 동작 중립)
UPDATE feedback_helpfulness_ratings
   SET applied_hp_delta = CASE WHEN is_helpful THEN 15 ELSE -20 END
 WHERE applied_hp_delta = 0;

CREATE OR REPLACE FUNCTION rate_panel_feedback_helpfulness(
  p_company_id UUID,
  p_panel_id   UUID,
  p_ref_type   TEXT,
  p_ref_id     UUID,
  p_is_helpful BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid       UUID := auth.uid();
  v_company_user_id  UUID;
  v_found            BOOLEAN := FALSE;
  v_existing_helpful BOOLEAN;
  v_existing_applied INT  := 0;   -- 이 평가가 직전에 실제 적용했던 양(되돌림 기준)
  v_new_state        TEXT;        -- 'helpful' | 'unhelpful' | 'none'
  v_intended         INT  := 0;   -- 새 상태가 의도하는 기여값 (+15 / -20 / 0)
  v_hp0              INT;         -- 현재 honor
  v_hp1              INT;         -- 기존 기여 되돌린 직후
  v_hp2              INT;         -- 새 기여 적용 직후
  v_applied_new      INT  := 0;   -- 새 상태가 실제로 적용한 양(저장용)
  v_action           TEXT;
BEGIN
  -- 소유권 검증: p_company_id 가 호출자 회사인지 (기업 본인만)
  SELECT user_id INTO v_company_user_id FROM companies WHERE id = p_company_id;
  IF v_company_user_id IS NULL OR v_company_user_id <> v_caller_uid THEN
    RAISE EXCEPTION 'Unauthorized: company_id does not belong to caller';
  END IF;

  -- 기존 평가 조회
  SELECT is_helpful, applied_hp_delta
    INTO v_existing_helpful, v_existing_applied
    FROM feedback_helpfulness_ratings
   WHERE company_id = p_company_id AND ref_type = p_ref_type AND ref_id = p_ref_id;
  v_found := FOUND;
  IF NOT v_found THEN v_existing_applied := 0; END IF;

  -- 새 상태 결정
  IF NOT v_found THEN
    v_new_state := CASE WHEN p_is_helpful THEN 'helpful' ELSE 'unhelpful' END;
    v_action    := 'inserted';
  ELSIF v_existing_helpful = p_is_helpful THEN
    v_new_state := 'none';                 -- 같은 버튼 재클릭 → 평가 취소
    v_action    := 'deleted';
  ELSE
    v_new_state := CASE WHEN p_is_helpful THEN 'helpful' ELSE 'unhelpful' END;
    v_action    := 'updated_changed';
  END IF;

  v_intended := CASE v_new_state
                  WHEN 'helpful'   THEN 15
                  WHEN 'unhelpful' THEN -20
                  ELSE 0
                END;

  -- honor 행 잠금 후 읽기 (동일 패널 동시 평가 직렬화)
  SELECT honor_points INTO v_hp0 FROM panels WHERE id = p_panel_id FOR UPDATE;
  IF v_hp0 IS NULL THEN
    RAISE EXCEPTION 'panel not found';
  END IF;

  -- ① 기존 기여 되돌림 → ② 새 기여 적용 (각 단계 0 바닥 클램프)
  -- v_applied_new 은 "②단계가 실제로 더하거나 뺀 양" = 다음 되돌림의 정확한 기준.
  v_hp1         := GREATEST(0, v_hp0 - COALESCE(v_existing_applied, 0));
  v_hp2         := GREATEST(0, v_hp1 + v_intended);
  v_applied_new := v_hp2 - v_hp1;

  UPDATE panels SET honor_points = v_hp2 WHERE id = p_panel_id;

  -- 평가 기록 반영
  IF v_new_state = 'none' THEN
    DELETE FROM feedback_helpfulness_ratings
     WHERE company_id = p_company_id AND ref_type = p_ref_type AND ref_id = p_ref_id;
  ELSIF v_found THEN
    UPDATE feedback_helpfulness_ratings
       SET is_helpful = p_is_helpful, applied_hp_delta = v_applied_new, created_at = now()
     WHERE company_id = p_company_id AND ref_type = p_ref_type AND ref_id = p_ref_id;
  ELSE
    INSERT INTO feedback_helpfulness_ratings
      (company_id, panel_id, ref_type, ref_id, is_helpful, applied_hp_delta)
    VALUES
      (p_company_id, p_panel_id, p_ref_type, p_ref_id, p_is_helpful, v_applied_new);
  END IF;

  RETURN jsonb_build_object('action', v_action, 'hp_delta', v_hp2 - v_hp0, 'applied', v_applied_new);
END;
$$;

GRANT EXECUTE ON FUNCTION rate_panel_feedback_helpfulness(UUID, UUID, TEXT, UUID, BOOLEAN) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. 반려 패널티(-5) / 복원(+5) — 가역 정확화 (어드민 전용 신규 RPC)
-- ════════════════════════════════════════════════════════════════════════════════

-- 반려가 실제로 차감한 양(0..-5)을 보관. 복원은 정확히 이 값만 역으로 되돌린다.
ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS rejection_honor_delta INT NOT NULL DEFAULT 0;

-- 기존 백필: 현재 반려 패널티가 적용 중인(rejection_penalty_applied=true) 피드백은
-- 구 코드에서 -5 차감됐다고 가정 → 복원 시 +5 (구 동작과 동일). 그 외는 0 유지.
UPDATE feedbacks
   SET rejection_honor_delta = -5
 WHERE rejection_penalty_applied = TRUE
   AND COALESCE(rejection_honor_delta, 0) = 0;

-- ── 반려 패널티 적용: -5 (0 바닥 안전), 실제 차감량을 feedbacks 에 기록 ──
CREATE OR REPLACE FUNCTION reject_feedback_honor(
  p_feedback_id UUID,
  p_panel_id    UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev     INT := 0;   -- 이 피드백에 이미 적용 중인 패널티(<=0)
  v_hp0      INT;
  v_hp1      INT;        -- 기존 패널티 되돌린 직후
  v_applied  INT;        -- 이번에 실제 차감한 양(0..-5)
  c_penalty  CONSTANT INT := 5;
BEGIN
  -- 어드민 검증 (app_metadata — D-58, NULL 안전)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT COALESCE(rejection_honor_delta, 0) INTO v_prev FROM feedbacks WHERE id = p_feedback_id;

  SELECT honor_points INTO v_hp0 FROM panels WHERE id = p_panel_id FOR UPDATE;
  IF v_hp0 IS NULL THEN
    RAISE EXCEPTION 'panel not found';
  END IF;

  -- 기존 패널티가 남아 있으면 먼저 정확히 되돌림(멱등 안전) → 그 위에 새 패널티 적용
  v_hp1     := GREATEST(0, v_hp0 - v_prev);              -- v_prev<=0 이므로 더해짐
  v_applied := GREATEST(0, v_hp1 - c_penalty) - v_hp1;   -- 실제 차감량(0..-5)

  UPDATE panels   SET honor_points = GREATEST(0, v_hp1 - c_penalty) WHERE id = p_panel_id;
  UPDATE feedbacks SET rejection_honor_delta = v_applied            WHERE id = p_feedback_id;

  RETURN jsonb_build_object('applied', v_applied);
END;
$$;

-- ── 반려 패널티 복원: 저장된 실제 차감량만큼만 정확히 되돌림 ──
CREATE OR REPLACE FUNCTION restore_feedback_honor(
  p_feedback_id UUID,
  p_panel_id    UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev INT := 0;   -- 되돌릴 실제 차감량(<=0)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT COALESCE(rejection_honor_delta, 0) INTO v_prev FROM feedbacks WHERE id = p_feedback_id;

  IF v_prev <> 0 THEN
    -- v_prev<=0 이므로 (honor - v_prev) = honor + |v_prev| → 0 밑으로 갈 일 없음
    UPDATE panels    SET honor_points = GREATEST(0, honor_points - v_prev) WHERE id = p_panel_id;
    UPDATE feedbacks SET rejection_honor_delta = 0                          WHERE id = p_feedback_id;
  END IF;

  RETURN jsonb_build_object('restored', -v_prev);
END;
$$;

GRANT EXECUTE ON FUNCTION reject_feedback_honor(UUID, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION restore_feedback_honor(UUID, UUID) TO authenticated;
