-- 009_gamification.sql
-- 패널 게이미피케이션 + 미션 소요시간/난이도 컬럼 추가

-- ── panels 신규 컬럼 ──────────────────────────────────────────────────────────
ALTER TABLE panels
  ADD COLUMN IF NOT EXISTS streak_count      INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_mission_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS badges            TEXT[]       DEFAULT '{}';

-- ── missions 신규 컬럼 ───────────────────────────────────────────────────────
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS estimated_minutes INT  DEFAULT 5,
  ADD COLUMN IF NOT EXISTS difficulty        TEXT DEFAULT 'normal'
    CONSTRAINT missions_difficulty_check CHECK (difficulty IN ('easy', 'normal', 'hard'));

-- ── RPC: update_panel_gamification ───────────────────────────────────────────
-- 피드백 제출 직후 클라이언트에서 호출. tier·trust_score·streak·badges 자동 계산.
CREATE OR REPLACE FUNCTION update_panel_gamification(p_panel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_missions  INT;
  v_approved_count  INT;
  v_total_submitted INT;
  v_trust_score     INT;
  v_tier            TEXT;
  v_streak_count    INT;
  v_last_date       TIMESTAMPTZ;
  v_badges          TEXT[];
BEGIN
  -- 기본 카운터 조회
  SELECT total_missions, COALESCE(badges, '{}')
    INTO v_total_missions, v_badges
    FROM panels
   WHERE id = p_panel_id;

  SELECT COUNT(*)
    INTO v_approved_count
    FROM feedbacks
   WHERE panel_id = p_panel_id
     AND purity_passed = true;

  SELECT COUNT(*)
    INTO v_total_submitted
    FROM feedbacks
   WHERE panel_id = p_panel_id
     AND status IN ('submitted', 'approved', 'rejected');

  -- trust_score (품질 통과율 × 100)
  IF v_total_submitted > 0 THEN
    v_trust_score := ROUND((v_approved_count::NUMERIC / v_total_submitted) * 100);
  ELSE
    v_trust_score := 0;
  END IF;

  -- tier (total_missions 기준)
  IF v_total_missions >= 30 THEN
    v_tier := 'ELITE';
  ELSIF v_total_missions >= 15 THEN
    v_tier := 'EXPERT';
  ELSIF v_total_missions >= 5 THEN
    v_tier := 'PRO';
  ELSE
    v_tier := 'ROOKIE';
  END IF;

  -- streak_count (최근 7일 내 제출 건수 — rolling week)
  SELECT COUNT(*)
    INTO v_streak_count
    FROM feedbacks
   WHERE panel_id = p_panel_id
     AND status IN ('submitted', 'approved', 'rejected')
     AND created_at >= NOW() - INTERVAL '7 days';

  -- last_mission_date
  SELECT MAX(created_at)
    INTO v_last_date
    FROM feedbacks
   WHERE panel_id = p_panel_id
     AND status IN ('submitted', 'approved', 'rejected');

  -- 뱃지 부여 (중복 방지)
  IF v_total_missions >= 1 AND NOT ('첫 미션' = ANY(v_badges)) THEN
    v_badges := array_append(v_badges, '첫 미션');
  END IF;
  IF v_total_missions >= 5 AND NOT ('5회 완료' = ANY(v_badges)) THEN
    v_badges := array_append(v_badges, '5회 완료');
  END IF;
  IF v_total_missions >= 10 AND NOT ('10회 완료' = ANY(v_badges)) THEN
    v_badges := array_append(v_badges, '10회 완료');
  END IF;
  IF v_total_missions >= 30 AND NOT ('30회 완료' = ANY(v_badges)) THEN
    v_badges := array_append(v_badges, '30회 완료');
  END IF;
  IF v_approved_count >= 5 AND NOT ('품질 검증자' = ANY(v_badges)) THEN
    v_badges := array_append(v_badges, '품질 검증자');
  END IF;
  IF v_streak_count >= 3 AND NOT ('연속 3회' = ANY(v_badges)) THEN
    v_badges := array_append(v_badges, '연속 3회');
  END IF;
  IF v_streak_count >= 7 AND NOT ('연속 7회' = ANY(v_badges)) THEN
    v_badges := array_append(v_badges, '연속 7회');
  END IF;

  -- panels 업데이트
  UPDATE panels SET
    trust_score       = v_trust_score,
    tier              = v_tier,
    streak_count      = v_streak_count,
    last_mission_date = v_last_date,
    badges            = v_badges
  WHERE id = p_panel_id;
END;
$$;
