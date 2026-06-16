-- 106_shared_mission_custom_answers.sql
-- 공유 페이지(get_shared_mission)가 "추가 질문 응답(custom_answers)"을 함께 반환하도록 확장
--   목적: 공유 링크(ShareResult.jsx)를 기업 결과 화면(Results.jsx)과 동일하게 — 추가 질문 드롭다운 표시
--   메인(이미지) 의뢰: feedbacks[] 각 행에 custom_answers 포함
--   서브 의뢰(소재/가격/이메일): sub_panel_responses = 패널별 전체 응답 행(점수·코멘트·추가질문·패널뱃지) 신규 반환
--     → 공유 페이지가 결과 화면(Results)의 PreferenceResults/PricingResults/EmailResults 렌더러를 그대로 재사용 (완전 동일)
--   ※ 085 본문 유지 + 무료 체험 미언락(v_locked) 시 show_comments=false → custom_answers/코멘트도 함께 비공개
--     (D-136 서버 마스킹 원칙 — 추가 질문 응답도 "코멘트" 콘텐츠로 간주해 show_comments 게이트 뒤에 둠)
--   ※ 질문 문구(selectedQuestions)는 description(JSON)에 들어있어 이미 반환됨 → 클라가 파싱 (응답만 신규 추가)

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
  v_sub_panels   JSONB;   -- 서브 의뢰 패널별 전체 응답 행 (점수·코멘트·추가질문·패널뱃지) — 결과화면 렌더러 재사용용 (신규)
  v_show_comm    BOOLEAN;
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

  v_show_comm := COALESCE((v_perms->>'show_comments')::boolean, true);
  v_is_image  := (v_image_urls IS NOT NULL AND array_length(v_image_urls, 1) > 0);
  v_is_sub    := v_type IN ('preference', 'pricing', 'email');

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

  IF v_show_comm THEN
    SELECT jsonb_agg(row_data)
    INTO v_feedbacks
    FROM (
      SELECT jsonb_build_object(
        'idx',                    ROW_NUMBER() OVER (ORDER BY created_at),
        'suggestions',            suggestions,
        'custom_answers',         COALESCE(custom_answers, '[]'::jsonb),  -- 신규: 메인(이미지) 추가 질문 응답
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

  -- 서브 의뢰: 결과 화면(Results) 렌더러가 클라에서 집계하므로 패널별 전체 응답 행을 반환
  --   (점수·코멘트·추가질문 + 패널 뱃지용 industry/experience)
  --   ※ 서브는 공개 토글(show_comments) 대상에서 제외 — 항상 공개. 단 무료 체험 미언락(v_locked)이면 비공개(페이월)
  IF v_is_sub AND NOT v_locked THEN
    IF v_type = 'preference' THEN
      SELECT jsonb_agg(jsonb_build_object(
        'id',               pr.id,
        'panel_id',         pr.panel_id,
        'preference',       pr.preference,
        'message_clarity',  pr.message_clarity,
        'purchase_intent',  pr.purchase_intent,
        'comment',          pr.comment,
        'custom_answers',   COALESCE(pr.custom_answers, '[]'::jsonb),
        'panel_industry',   pl.industry,
        'panel_experience', pl.experience
      ) ORDER BY pr.created_at)
      INTO v_sub_panels
      FROM preference_responses pr
      LEFT JOIN panels pl ON pl.id = pr.panel_id
      WHERE pr.mission_id = v_id
        AND pr.panel_id IN (
          SELECT f.panel_id FROM feedbacks f
          WHERE f.mission_id = v_id AND f.purity_passed = true AND f.status != 'draft'
        );

    ELSIF v_type = 'pricing' THEN
      SELECT jsonb_agg(jsonb_build_object(
        'id',               pr.id,
        'panel_id',         pr.panel_id,
        'would_buy',        pr.would_buy,
        'price_fairness',   pr.price_fairness,
        'value_perception', pr.value_perception,
        'key_comment',      pr.key_comment,
        'custom_answers',   COALESCE(pr.custom_answers, '[]'::jsonb),
        'panel_industry',   pl.industry,
        'panel_experience', pl.experience
      ) ORDER BY pr.created_at)
      INTO v_sub_panels
      FROM pricing_responses pr
      LEFT JOIN panels pl ON pl.id = pr.panel_id
      WHERE pr.mission_id = v_id
        AND pr.panel_id IN (
          SELECT f.panel_id FROM feedbacks f
          WHERE f.mission_id = v_id AND f.purity_passed = true AND f.status != 'draft'
        );

    ELSIF v_type = 'email' THEN
      SELECT jsonb_agg(jsonb_build_object(
        'id',               er.id,
        'panel_id',         er.panel_id,
        'would_reply',      er.would_reply,
        'open_intent',      er.open_intent,
        'hook_score',       er.hook_score,
        'clarity_score',    er.clarity_score,
        'curiosity_score',  er.curiosity_score,
        'comment',          er.comment,
        'custom_answers',   COALESCE(er.custom_answers, '[]'::jsonb),
        'panel_industry',   pl.industry,
        'panel_experience', pl.experience
      ) ORDER BY er.created_at)
      INTO v_sub_panels
      FROM email_responses er
      LEFT JOIN panels pl ON pl.id = er.panel_id
      WHERE er.mission_id = v_id
        AND er.panel_id IN (
          SELECT f.panel_id FROM feedbacks f
          WHERE f.mission_id = v_id AND f.purity_passed = true AND f.status != 'draft'
        );
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
    'feedbacks',            COALESCE(v_feedbacks,   '[]'::jsonb),
    'annotations',          COALESCE(v_annotations, '[]'::jsonb),
    'sub_panel_responses',  COALESCE(v_sub_panels,  '[]'::jsonb)   -- 신규: 서브 의뢰 패널별 전체 응답 행 (결과화면 렌더러 재사용)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_mission(TEXT) TO anon, authenticated;
