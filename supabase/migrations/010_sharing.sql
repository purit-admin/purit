-- 010_sharing.sql
-- 미션 공유 링크 기능: share_token 컬럼 + 공개 조회 RPC

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS missions_share_token_idx
  ON missions(share_token)
  WHERE share_token IS NOT NULL;

-- 공개 공유 RPC: 토큰으로 미션 + 집계 피드백 데이터 반환 (인증 불필요)
CREATE OR REPLACE FUNCTION get_shared_mission(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id        UUID;
  v_title     TEXT;
  v_persona   TEXT;
  v_created   TIMESTAMPTZ;
  v_count     INT;
  v_clarity   NUMERIC;
  v_relevance NUMERIC;
  v_value     NUMERIC;
  v_diff      NUMERIC;
  v_trust     NUMERIC;
BEGIN
  SELECT id, title, persona, created_at
    INTO v_id, v_title, v_persona, v_created
    FROM missions
   WHERE share_token = p_token;

  IF v_id IS NULL THEN RETURN NULL; END IF;

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

  RETURN jsonb_build_object(
    'title',          v_title,
    'persona',        v_persona,
    'created_at',     v_created,
    'feedback_count', COALESCE(v_count, 0),
    'scores', jsonb_build_object(
      'clarity',         ROUND(COALESCE(v_clarity, 0)::NUMERIC,   1),
      'relevance',       ROUND(COALESCE(v_relevance, 0)::NUMERIC, 1),
      'value',           ROUND(COALESCE(v_value, 0)::NUMERIC,     1),
      'differentiation', ROUND(COALESCE(v_diff, 0)::NUMERIC,      1),
      'trust',           ROUND(COALESCE(v_trust, 0)::NUMERIC,     1)
    )
  );
END;
$$;
