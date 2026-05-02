-- 015_honor_level_system.sql
-- 10단계 명예 레벨 시스템: panels HP 컬럼, 평가 기록 테이블, RPC 3개

-- ── panels 신규 컬럼 ──────────────────────────────────────────────────────────
ALTER TABLE panels
  ADD COLUMN IF NOT EXISTS honor_points           INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS honor_decay_applied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS panels_honor_points_idx ON panels(honor_points);

-- ── feedback_helpfulness_ratings 테이블 ──────────────────────────────────────
-- 기업이 패널 답변에 '도움 됨/안 됨'을 평가한 기록.
-- UNIQUE(company_id, ref_type, ref_id): 기업당 댓글당 1회 평가 보장.
CREATE TABLE IF NOT EXISTS feedback_helpfulness_ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  panel_id    UUID        NOT NULL REFERENCES panels(id)    ON DELETE CASCADE,
  ref_type    TEXT        NOT NULL,  -- 'feedback'|'annotation'|'preference'|'pricing'|'email'
  ref_id      UUID        NOT NULL,  -- 해당 행의 PK
  is_helpful  BOOLEAN     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fhr_unique UNIQUE (company_id, ref_type, ref_id)
);

CREATE INDEX IF NOT EXISTS fhr_company_idx ON feedback_helpfulness_ratings(company_id);
CREATE INDEX IF NOT EXISTS fhr_panel_idx   ON feedback_helpfulness_ratings(panel_id);
CREATE INDEX IF NOT EXISTS fhr_ref_idx     ON feedback_helpfulness_ratings(ref_type, ref_id);

-- ── RLS: feedback_helpfulness_ratings ────────────────────────────────────────
ALTER TABLE feedback_helpfulness_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhr_company_own"       ON feedback_helpfulness_ratings;
DROP POLICY IF EXISTS "fhr_panel_read_own"    ON feedback_helpfulness_ratings;
DROP POLICY IF EXISTS "fhr_admin_all"         ON feedback_helpfulness_ratings;

-- 기업: 본인 평가만 읽기/쓰기
CREATE POLICY "fhr_company_own" ON feedback_helpfulness_ratings
  FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- 패널: 자신의 댓글에 달린 평가 읽기 (선택적 — 추후 UI 확장용)
CREATE POLICY "fhr_panel_read_own" ON feedback_helpfulness_ratings
  FOR SELECT
  USING (panel_id IN (SELECT id FROM panels WHERE user_id = auth.uid()));

-- 어드민: 전체 접근
CREATE POLICY "fhr_admin_all" ON feedback_helpfulness_ratings
  FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ── RPC 1: add_panel_honor_points ─────────────────────────────────────────────
-- 미션 완료 시 +5, 어드민 직접 조정 등 단순 HP 변경에 사용.
CREATE OR REPLACE FUNCTION add_panel_honor_points(
  p_panel_id UUID,
  p_delta    INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE panels
     SET honor_points = GREATEST(0, honor_points + p_delta)
   WHERE id = p_panel_id;
END;
$$;

-- ── RPC 2: rate_panel_feedback_helpfulness ────────────────────────────────────
-- 기업이 패널 답변에 '도움 됨/안 됨' 평가. 토글 오프(같은 버튼 재클릭) 지원.
-- Returns: { action: 'inserted'|'updated_changed'|'deleted', hp_delta: N }
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
  v_existing_helpful BOOLEAN;
  v_hp_delta         INT  := 0;
  v_action           TEXT;
BEGIN
  SELECT is_helpful INTO v_existing_helpful
    FROM feedback_helpfulness_ratings
   WHERE company_id = p_company_id
     AND ref_type   = p_ref_type
     AND ref_id     = p_ref_id;

  IF NOT FOUND THEN
    INSERT INTO feedback_helpfulness_ratings
      (company_id, panel_id, ref_type, ref_id, is_helpful)
    VALUES
      (p_company_id, p_panel_id, p_ref_type, p_ref_id, p_is_helpful);

    v_hp_delta := CASE WHEN p_is_helpful THEN 15 ELSE -20 END;
    v_action   := 'inserted';

  ELSIF v_existing_helpful = p_is_helpful THEN
    -- 같은 버튼 재클릭 → 평가 취소
    DELETE FROM feedback_helpfulness_ratings
     WHERE company_id = p_company_id
       AND ref_type   = p_ref_type
       AND ref_id     = p_ref_id;

    v_hp_delta := CASE WHEN p_is_helpful THEN -15 ELSE 20 END;
    v_action   := 'deleted';

  ELSE
    -- 반대 버튼으로 변경
    UPDATE feedback_helpfulness_ratings
       SET is_helpful = p_is_helpful, created_at = now()
     WHERE company_id = p_company_id
       AND ref_type   = p_ref_type
       AND ref_id     = p_ref_id;

    v_hp_delta := CASE WHEN p_is_helpful THEN 35 ELSE -35 END;
    v_action   := 'updated_changed';
  END IF;

  IF v_hp_delta <> 0 THEN
    UPDATE panels
       SET honor_points = GREATEST(0, honor_points + v_hp_delta)
     WHERE id = p_panel_id;
  END IF;

  RETURN jsonb_build_object('action', v_action, 'hp_delta', v_hp_delta);
END;
$$;

-- ── RPC 3: apply_honor_decay ─────────────────────────────────────────────────
-- 패널 대시보드 로드 시 호출. 30일 비활동 후 매주 -200 지연 적용.
-- honor_decay_applied_at 커서로 이중 적용 방지.
CREATE OR REPLACE FUNCTION apply_honor_decay(p_panel_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_cursor   TIMESTAMPTZ;
  v_honor_points   INT;
  v_now            TIMESTAMPTZ := now();
  v_decay_start    TIMESTAMPTZ;
  v_weeks_pending  INT;
  v_points_removed INT;
BEGIN
  SELECT
    COALESCE(honor_decay_applied_at, last_mission_date),
    honor_points
  INTO v_decay_cursor, v_honor_points
  FROM panels
  WHERE id = p_panel_id;

  IF v_decay_cursor IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'weeks_decayed', 0, 'points_removed', 0);
  END IF;

  v_decay_start := v_decay_cursor + INTERVAL '30 days';

  IF v_now < v_decay_start THEN
    RETURN jsonb_build_object('applied', false, 'weeks_decayed', 0, 'points_removed', 0);
  END IF;

  v_weeks_pending  := FLOOR(EXTRACT(EPOCH FROM (v_now - v_decay_start)) / (7 * 86400))::INT + 1;
  v_points_removed := LEAST(v_honor_points, v_weeks_pending * 200);

  UPDATE panels
     SET honor_points           = GREATEST(0, honor_points - v_points_removed),
         honor_decay_applied_at = v_now
   WHERE id = p_panel_id;

  RETURN jsonb_build_object(
    'applied',        true,
    'weeks_decayed',  v_weeks_pending,
    'points_removed', v_points_removed
  );
END;
$$;

-- ── GRANT ─────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION add_panel_honor_points(UUID, INT)                                     TO authenticated;
GRANT EXECUTE ON FUNCTION rate_panel_feedback_helpfulness(UUID, UUID, TEXT, UUID, BOOLEAN)      TO authenticated;
GRANT EXECUTE ON FUNCTION apply_honor_decay(UUID)                                               TO authenticated;
