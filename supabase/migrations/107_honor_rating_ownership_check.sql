-- 107_honor_rating_ownership_check.sql
-- rate_panel_feedback_helpfulness 소유권/대상 검증 추가 (니체-HonorIDOR, 보안).
-- ※ 당초 106으로 작성했으나 별도 작업 106_shared_mission_custom_answers.sql 과 번호 충돌로 107로 이동.
--
-- 배경(기존 결함 — 015/020부터):
--   이 RPC는 p_company_id 가 호출자 회사인지만 검증하고,
--   p_ref_id 가 실재하는지 / 그 행의 panel_id 가 p_panel_id 와 일치하는지 /
--   평가 기업이 그 피드백·응답이 속한 미션의 소유 기업인지를 검증하지 않았다.
--   → 셸 기업 계정(가입 무료)으로 임의 UUID 를 p_ref_id 로, 자기 패널을 p_panel_id 로 넣고
--     helpful=true 를 반복 호출하면 호출마다 +15 가 적립(고유 ref 마다 신규 INSERT)되어
--     명예점수(honor_points)를 무한 부풀릴 수 있었다. UNIQUE(company,ref_type,ref_id)는
--     매번 새 random UUID 로 우회됨. honor↑ → 레벨↑ → 보상배율↑ 의 경제적 악용.
--
-- 해결: 호출자 회사 검증 직후, 대상 ref 의 실재 + panel_id 일치 + 미션 소유 기업 일치를 검증.
--   ref_type 별 대상 테이블: feedback→feedbacks / annotation→feedback_annotations /
--                            preference→preference_responses / pricing→pricing_responses / email→email_responses
--   (네 테이블 모두 panel_id·mission_id 보유, missions.company_id 로 소유 기업 확인)
--
-- ※ 105 의 0 바닥 가역 로직(applied_hp_delta)은 그대로 유지 — 검증 블록만 추가.
--   105 에서 추가한 컬럼/ reject_feedback_honor / restore_feedback_honor 는 변경 없음(재실행 불필요).
--   정상 사용(Results.jsx)은 항상 ref 의 실제 panel_id·본인 미션으로 호출하므로 영향 없음.

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
  v_ref_panel_id     UUID;
  v_ref_mission_id   UUID;
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
  -- ① 소유권 검증: p_company_id 가 호출자 회사인지 (기업 본인만)
  SELECT user_id INTO v_company_user_id FROM companies WHERE id = p_company_id;
  IF v_company_user_id IS NULL OR v_company_user_id <> v_caller_uid THEN
    RAISE EXCEPTION 'Unauthorized: company_id does not belong to caller';
  END IF;

  -- ② 대상 검증: ref 실재 + 그 행의 panel_id 와 mission_id 확보 (ref_type 별 테이블)
  IF p_ref_type = 'feedback' THEN
    SELECT panel_id, mission_id INTO v_ref_panel_id, v_ref_mission_id FROM feedbacks WHERE id = p_ref_id;
  ELSIF p_ref_type = 'annotation' THEN
    SELECT panel_id, mission_id INTO v_ref_panel_id, v_ref_mission_id FROM feedback_annotations WHERE id = p_ref_id;
  ELSIF p_ref_type = 'preference' THEN
    SELECT panel_id, mission_id INTO v_ref_panel_id, v_ref_mission_id FROM preference_responses WHERE id = p_ref_id;
  ELSIF p_ref_type = 'pricing' THEN
    SELECT panel_id, mission_id INTO v_ref_panel_id, v_ref_mission_id FROM pricing_responses WHERE id = p_ref_id;
  ELSIF p_ref_type = 'email' THEN
    SELECT panel_id, mission_id INTO v_ref_panel_id, v_ref_mission_id FROM email_responses WHERE id = p_ref_id;
  ELSE
    RAISE EXCEPTION 'Invalid ref_type: %', p_ref_type;
  END IF;

  IF v_ref_panel_id IS NULL THEN
    RAISE EXCEPTION 'ref not found: % %', p_ref_type, p_ref_id;
  END IF;

  -- ③ 대상 패널 일치: 평가 대상 ref 의 실제 작성 패널 == p_panel_id (타 패널 지목 차단)
  IF v_ref_panel_id <> p_panel_id THEN
    RAISE EXCEPTION 'panel_id mismatch for ref';
  END IF;

  -- ④ 미션 소유 기업 일치: 그 ref 가 속한 미션을 평가 기업이 소유 (남의 미션 평가로 honor 조작 차단)
  IF NOT EXISTS (
    SELECT 1 FROM missions WHERE id = v_ref_mission_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'company does not own the mission of this ref';
  END IF;

  -- ── 이하 105 의 0 바닥 가역 로직(applied_hp_delta) 그대로 ──────────────────────────
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
