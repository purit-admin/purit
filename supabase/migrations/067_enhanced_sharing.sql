-- 067_enhanced_sharing.sql
-- 공유 페이지 고도화: share_permissions 컬럼 추가 + get_shared_mission RPC 전면 확장

-- 1. missions 테이블에 share_permissions JSONB 컬럼 추가
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS share_permissions JSONB NOT NULL DEFAULT '{"show_comments": true, "show_annotations": true}'::jsonb;

-- 2. get_shared_mission RPC 재정의 (SECURITY DEFINER 유지 — 인증 없이 공개 접근)
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
  v_persona      JSONB;
  v_created      TIMESTAMPTZ;
  v_perms        JSONB;
  v_count        INT;
  v_clarity      NUMERIC;
  v_relevance    NUMERIC;
  v_value        NUMERIC;
  v_diff         NUMERIC;
  v_trust        NUMERIC;
  v_feedbacks    JSONB;
  v_annotations  JSONB;
  v_sub_resp     JSONB;
  v_is_image     BOOLEAN;
  v_is_sub       BOOLEAN;
BEGIN
  -- 미션 기본 정보 조회
  SELECT id, title, type, description, image_urls, persona, created_at,
         COALESCE(share_permissions, '{"show_comments": true, "show_annotations": true}'::jsonb)
    INTO v_id, v_title, v_type, v_description, v_image_urls, v_persona, v_created, v_perms
    FROM missions
   WHERE share_token = p_token;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  v_is_image := (v_image_urls IS NOT NULL AND array_length(v_image_urls, 1) > 0);
  v_is_sub   := v_type IN ('preference', 'pricing', 'email');

  -- 집계 점수 (purity_passed=true 피드백)
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

  -- 개별 피드백 (show_comments=true일 때만, 패널 정보 없는 익명 데이터)
  IF COALESCE((v_perms->>'show_comments')::boolean, true) THEN
    SELECT jsonb_agg(row_data)
    INTO v_feedbacks
    FROM (
      SELECT jsonb_build_object(
        'idx',                    ROW_NUMBER() OVER (ORDER BY created_at),
        'suggestions',            suggestions,
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

  -- 어노테이션 (이미지 미션 + show_annotations=true일 때만)
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

  -- 서브 미션 응답 집계
  IF v_is_sub THEN
    IF v_type = 'preference' THEN
      SELECT jsonb_build_object(
        'choice_a_count',       COUNT(*) FILTER (WHERE preference = 'A'),
        'choice_b_count',       COUNT(*) FILTER (WHERE preference = 'B'),
        'avg_message_clarity',  ROUND(COALESCE(AVG(message_clarity),  0)::NUMERIC, 1),
        'avg_purchase_intent',  ROUND(COALESCE(AVG(purchase_intent),  0)::NUMERIC, 1)
      )
      INTO v_sub_resp
      FROM preference_responses
      WHERE mission_id = v_id;

    ELSIF v_type = 'pricing' THEN
      SELECT jsonb_build_object(
        'would_buy_count',      COUNT(*) FILTER (WHERE would_buy = true),
        'total_count',          COUNT(*),
        'avg_price_fairness',   ROUND(COALESCE(AVG(price_fairness),   0)::NUMERIC, 1),
        'avg_value_perception', ROUND(COALESCE(AVG(value_perception), 0)::NUMERIC, 1)
      )
      INTO v_sub_resp
      FROM pricing_responses
      WHERE mission_id = v_id;

    ELSIF v_type = 'email' THEN
      SELECT jsonb_build_object(
        'would_reply_count',    COUNT(*) FILTER (WHERE would_reply = true),
        'total_count',          COUNT(*),
        'avg_open_intent',      ROUND(COALESCE(AVG(open_intent),      0)::NUMERIC, 1),
        'avg_hook_score',       ROUND(COALESCE(AVG(hook_score),       0)::NUMERIC, 1),
        'avg_clarity_score',    ROUND(COALESCE(AVG(clarity_score),    0)::NUMERIC, 1),
        'avg_curiosity_score',  ROUND(COALESCE(AVG(curiosity_score),  0)::NUMERIC, 1)
      )
      INTO v_sub_resp
      FROM email_responses
      WHERE mission_id = v_id;
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
    'feedbacks',         COALESCE(v_feedbacks,   '[]'::jsonb),
    'annotations',       COALESCE(v_annotations, '[]'::jsonb),
    'sub_responses',     v_sub_resp
  );
END;
$$;
