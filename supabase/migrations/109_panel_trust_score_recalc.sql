-- 109_panel_trust_score_recalc.sql
-- 패널 신뢰도(trust_score) 자동 재계산 트리거
--
-- 배경: trust_score(Purit Filter 통과율)를 갱신하던 update_panel_gamification RPC가
--       [신규-J]에서 "Dead RPC"로 제거됨(그 함수는 trust_score 외에 구 badges·폐기된 tier까지
--       덮어써 19개 뱃지 시스템 check_and_award_badges와 충돌). 제거 후 trust_score를 다시
--       계산하는 코드가 전무 → 신규 패널은 0%에 영구 고정, 구 패널은 마지막 값에 동결.
--
-- 해결: 승인/반려 지점(PurityFilter 5곳 + TrialMissions 2곳 등)에 클라 호출을 흩뿌리는 대신
--       feedbacks.status 변경 시 DB가 자동으로 trust_score만 재계산하는 트리거로 단일화(D-35 회피).
--       trust_score = 승인(purity_passed) / 심사 완료(승인+반려) × 100  [decided-only]
--       ※ 분모에 심사 대기(submitted)를 넣으면 대기 건이 점수를 희석(예: 승인3+대기5=38%)해
--         실제 통과만 한 패널이 저점·위험으로 오판 → 심사 완료분만 분모로 둠.
--       ※ admin/PanelManagement.jsx loadStats 의 s.passRate 도 동일하게 decided-only로 맞춰
--         '전체' 기간에서 '신뢰도'(trust_score)와 '통과율'(s.passRate)이 일치(꼬임 방지).
--
--       trust_score_count: 심사 완료 건수(승인+반려)를 같이 저장 → 프론트가 "표본 부족"을 판정.
--         3건 미만이면 0%/100% 극단·신규 위험 낙인 대신 "집계 중" 표시(표시 전용 임계).

-- ── 동반 카운트 컬럼 (표본 수 = trust_score 분모, 표시 임계용) ────────────────
ALTER TABLE panels ADD COLUMN IF NOT EXISTS trust_score_count INT DEFAULT 0;

-- ── trust_score 전용 재계산 함수 (badges·tier·streak 미변경) ──────────────────
CREATE OR REPLACE FUNCTION recalc_panel_trust_score(p_panel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_passed  INT;
  v_decided INT;
BEGIN
  IF p_panel_id IS NULL THEN RETURN; END IF;

  -- decided-only: passed=승인(purity_passed), decided=심사 완료(승인+반려). 대기(submitted) 제외
  SELECT
    COUNT(*) FILTER (WHERE purity_passed = true),
    COUNT(*) FILTER (WHERE status IN ('approved', 'rejected'))
    INTO v_passed, v_decided
    FROM feedbacks
   WHERE panel_id = p_panel_id;

  UPDATE panels
     SET trust_score = CASE WHEN v_decided > 0
                            THEN ROUND((v_passed::NUMERIC / v_decided) * 100)
                            ELSE 0 END,
         trust_score_count = v_decided
   WHERE id = p_panel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION recalc_panel_trust_score(UUID) TO authenticated, service_role;

-- ── 트리거 함수: status 변경 시 해당 패널 trust_score 재계산 ──────────────────
CREATE OR REPLACE FUNCTION trg_recalc_trust_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.panel_id IS NOT NULL THEN
    PERFORM recalc_panel_trust_score(NEW.panel_id);
  END IF;
  RETURN NEW;
END;
$$;

-- feedbacks.status 가 실제로 바뀔 때만 발화 (panels UPDATE이므로 재귀 없음)
DROP TRIGGER IF EXISTS on_feedback_status_trust ON feedbacks;
CREATE TRIGGER on_feedback_status_trust
  AFTER UPDATE OF status ON feedbacks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_recalc_trust_score();

-- ── 기존 패널 1회 백필 (동결돼 있던 값 즉시 정정) ────────────────────────────
UPDATE panels p
   SET trust_score = sub.ts,
       trust_score_count = sub.cnt
  FROM (
    SELECT panel_id,
           COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')) AS cnt,
           CASE WHEN COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')) > 0
                THEN ROUND(
                       COUNT(*) FILTER (WHERE purity_passed = true)::NUMERIC
                       / COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')) * 100)
                ELSE 0 END AS ts
      FROM feedbacks
     WHERE panel_id IS NOT NULL
     GROUP BY panel_id
  ) sub
 WHERE p.id = sub.panel_id;
