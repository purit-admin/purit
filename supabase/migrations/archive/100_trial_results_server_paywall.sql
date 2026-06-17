-- 100_trial_results_server_paywall.sql
-- 무료 체험 결과 페이월 서버 차단 (니체-TRIAL-페이월, P1 — 수익 직결)
--
-- 문제:
--   Results.jsx가 feedbacks / feedback_annotations 를 select('*') 로 통째 로드한 뒤(라인 1084·1111),
--   잠긴 패널의 텍스트(suggestions·custom_answers·어노테이션 comment)를 CSS filter:blur() 로만 가렸다.
--   → 원문이 브라우저(Network 응답·React state)에 그대로 존재 → DevTools 로 blur 한 줄만 지우면
--     크레딧 결제(언락) 없이 전체 피드백 열람 가능. Freemium 페이월이 사실상 무력화.
--   공유 페이지(get_shared_mission)는 서버에서 막혀 있었으나, 정작 본 열람 경로(/company/results)는 미차단.
--
-- 해결:
--   본인 미션 결과를 서버에서 마스킹해 반환하는 RPC. 무료 체험 + 미언락이면 잠긴 패널(공개 2명 제외)의
--   "텍스트만" NULL/placeholder 로 마스킹한다. 점수(5축)·구조·개수는 유지 →
--   클라의 레이더·티저·공개판정(unlockedPanelIds)·"응답 N건" 표시가 점수 기반이라 그대로 정확히 동작.
--
-- 공개 판정 기준은 unlock_free_trial_mission(095) 과 동일:
--   trial_public_panel_ids 가 있으면 그 2명, 없으면 avg_score(5축 평균) 상위 2명 (panel_id ASC tiebreaker). D-121 정합.
--
-- 마스킹 형태(클라 렌더 호환):
--   · suggestions      → '[총평]\n🔒' (extractOverallComment 가 '🔒' 추출 → 총평 카드가 목록에 남아 blur+언락 CTA 유지)
--   · strengths        → NULL (draft 임시저장용, 제출 후 보통 NULL)
--   · custom_answers   → 각 원소의 answer 값만 '🔒' 로(questionId/type 유지 → "응답 N건"·질문 표시 정상)
--   · annotation.comment → 원문이 있을 때만 '🔒' (없던 것은 그대로 → '코멘트 없음' 표시 유지)

CREATE OR REPLACE FUNCTION get_company_trial_feedbacks(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id   UUID;
  v_is_free      BOOLEAN;
  v_unlocked     BOOLEAN;
  v_public       UUID[];
  v_locked       BOOLEAN;
  v_unlocked_ids UUID[] := '{}';
  v_feedbacks    jsonb;
  v_annotations  jsonb;
BEGIN
  SELECT company_id, is_free_trial, trial_unlocked, trial_public_panel_ids
  INTO v_company_id, v_is_free, v_unlocked, v_public
  FROM missions WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 소유권: 본인 회사(오너) 또는 활성 팀원만 (타사 미션 결과 열람 차단)
  IF NOT EXISTS (
        SELECT 1 FROM companies WHERE id = v_company_id AND user_id = auth.uid()
      )
     AND NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE company_id = v_company_id AND user_id = auth.uid() AND status = 'active'
      ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  v_locked := COALESCE(v_is_free, false) AND NOT COALESCE(v_unlocked, false);

  -- 잠금 상태일 때만 공개 패널 판정 (unlock_free_trial_mission 과 동일 기준)
  IF v_locked THEN
    IF v_public IS NOT NULL AND array_length(v_public, 1) > 0 THEN
      v_unlocked_ids := v_public;
    ELSE
      SELECT COALESCE(array_agg(panel_id), '{}') INTO v_unlocked_ids
      FROM (
        SELECT f.panel_id,
               ROW_NUMBER() OVER (
                 ORDER BY AVG((COALESCE(f.clarity_score,0) + COALESCE(f.relevance_score,0)
                   + COALESCE(f.value_score,0) + COALESCE(f.differentiation_score,0)
                   + COALESCE(f.trust_score,0)) / 5.0) DESC, f.panel_id ASC
               ) AS rn
        FROM feedbacks f
        WHERE f.mission_id = p_mission_id AND f.purity_passed = true
        GROUP BY f.panel_id
      ) t
      WHERE rn <= 2;
    END IF;
  END IF;

  -- feedbacks: 점수·구조 유지, 잠긴 패널 텍스트만 마스킹
  SELECT COALESCE(jsonb_agg(row_obj ORDER BY (row_obj->>'created_at') DESC), '[]'::jsonb)
  INTO v_feedbacks
  FROM (
    SELECT jsonb_build_object(
      'id', f.id,
      'mission_id', f.mission_id,
      'panel_id', f.panel_id,
      'clarity_score', f.clarity_score,
      'relevance_score', f.relevance_score,
      'value_score', f.value_score,
      'differentiation_score', f.differentiation_score,
      'trust_score', f.trust_score,
      'purity_passed', f.purity_passed,
      'created_at', f.created_at,
      'suggestions', CASE
        WHEN v_locked AND NOT (f.panel_id = ANY(v_unlocked_ids))
          THEN '[총평]' || chr(10) || '🔒'
        ELSE f.suggestions END,
      'strengths', CASE
        WHEN v_locked AND NOT (f.panel_id = ANY(v_unlocked_ids))
          THEN NULL
        ELSE f.strengths END,
      -- custom_answers: 추가질문 응답은 클라 UI(CustomQuestionsSection)가 미언락 시 패널 구분 없이
      -- 전체를 잠그므로, 누출 방지를 위해 잠금 상태면 공개/잠금 무관 모든 패널의 answer 값을 마스킹
      -- (questionId/type 은 유지 → "응답 N건"·질문 표시 정상). 언락 시 원본 노출.
      'custom_answers', CASE
        WHEN v_locked
          THEN (
            SELECT jsonb_agg(jsonb_build_object(
                     'questionId',   e->>'questionId',
                     'questionText', e->>'questionText',
                     'type',         e->>'type',
                     'answer',       '🔒'))
            FROM jsonb_array_elements(COALESCE(f.custom_answers, '[]'::jsonb)) e
          )
        ELSE f.custom_answers END
    ) AS row_obj
    FROM feedbacks f
    WHERE f.mission_id = p_mission_id AND f.purity_passed = true
  ) s;

  -- annotations: 위치/지표/점수 유지, 잠긴 패널 comment(원문 있을 때만) 마스킹
  SELECT COALESCE(jsonb_agg(row_obj ORDER BY (row_obj->>'created_at') ASC), '[]'::jsonb)
  INTO v_annotations
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'feedback_id', a.feedback_id,
      'mission_id', a.mission_id,
      'panel_id', a.panel_id,
      'image_index', a.image_index,
      'x_pct', a.x_pct,
      'y_pct', a.y_pct,
      'w_pct', a.w_pct,
      'h_pct', a.h_pct,
      'dimension', a.dimension,
      'score', a.score,
      'created_at', a.created_at,
      'comment', CASE
        WHEN v_locked AND NOT (a.panel_id = ANY(v_unlocked_ids)) AND COALESCE(a.comment, '') <> ''
          THEN '🔒'
        ELSE a.comment END
    ) AS row_obj
    FROM feedback_annotations a
    JOIN feedbacks f ON f.id = a.feedback_id AND f.purity_passed = true
    WHERE a.mission_id = p_mission_id
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'locked', v_locked,
    'feedbacks', v_feedbacks,
    'annotations', v_annotations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_trial_feedbacks(UUID) TO authenticated;
