-- 077_badge_system_v3.sql
-- 뱃지 7개 추가: 첫_발사·삼연타(rookie) / 댓글_장인·스피드런·듀얼_코어(elite) / 센추리·인사이트_코어(master)
-- check_and_award_badges RPC 재정의 (021 대체)

CREATE OR REPLACE FUNCTION check_and_award_badges(p_panel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid    UUID := auth.uid();
  v_is_admin      BOOLEAN := FALSE;
  v_panel_user_id UUID;
  v_badges        TEXT[];

  v_count         INT;
  v_count2        INT;
  v_ratio         NUMERIC;
  v_total_missions INT;
  v_platform_pct  NUMERIC;

  -- ── 기존 뱃지 키 (021) ──────────────────────────────────────────────────
  k1  CONSTANT TEXT := '영점_조준';
  k2  CONSTANT TEXT := '유효_타격';
  k3  CONSTANT TEXT := '데이터_스캐너';
  k4  CONSTANT TEXT := '제로_데펙트';
  k5  CONSTANT TEXT := '크리티컬_샷';
  k6  CONSTANT TEXT := '트렌드_오라클';
  k7  CONSTANT TEXT := '절대_영도';
  k8  CONSTANT TEXT := '픽셀_아키텍트';
  k9  CONSTANT TEXT := '에이펙스_노드';
  k10 CONSTANT TEXT := '마이크로스코프';
  k11 CONSTANT TEXT := '퀵_타겟팅';
  k12 CONSTANT TEXT := '블랙_스완';
  -- ── v3 신규 뱃지 키 ──────────────────────────────────────────────────────
  k13 CONSTANT TEXT := '첫_발사';
  k14 CONSTANT TEXT := '삼연타';
  k15 CONSTANT TEXT := '댓글_장인';
  k16 CONSTANT TEXT := '스피드런';
  k17 CONSTANT TEXT := '듀얼_코어';
  k18 CONSTANT TEXT := '센추리';
  k19 CONSTANT TEXT := '인사이트_코어';
BEGIN
  -- ── 호출자 검증 ─────────────────────────────────────────────────────────
  SELECT (raw_user_meta_data ->> 'role') = 'admin'
    INTO v_is_admin
    FROM auth.users
   WHERE id = v_caller_uid;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    SELECT user_id INTO v_panel_user_id
      FROM panels WHERE id = p_panel_id;
    IF v_panel_user_id IS NULL OR v_panel_user_id != v_caller_uid THEN
      RAISE EXCEPTION 'Unauthorized: can only award badges to own panel';
    END IF;
  END IF;

  -- 현재 보유 뱃지 로드
  SELECT COALESCE(badges, '{}') INTO v_badges
    FROM panels WHERE id = p_panel_id;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 기존 뱃지 (021 로직 동일 유지)
  -- ══════════════════════════════════════════════════════════════════════════

  -- ── 뱃지 1: 영점 조준 — Purit Filter 첫 통과 ────────────────────────────
  IF NOT (k1 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedbacks
     WHERE panel_id = p_panel_id AND purity_passed = true;
    IF v_count >= 1 THEN
      v_badges := array_append(v_badges, k1);
    END IF;
  END IF;

  -- ── 뱃지 2: 유효 타격 — 도움 됨 평가 첫 수령 ────────────────────────────
  IF NOT (k2 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings
     WHERE panel_id = p_panel_id AND is_helpful = true;
    IF v_count >= 1 THEN
      v_badges := array_append(v_badges, k2);
    END IF;
  END IF;

  -- ── 뱃지 3: 데이터 스캐너 — 3가지 이상 의뢰 유형 참여 ──────────────────
  IF NOT (k3 = ANY(v_badges)) THEN
    SELECT COUNT(DISTINCT COALESCE(m.type, 'landing_page')) INTO v_count
      FROM feedbacks f
      JOIN missions m ON m.id = f.mission_id
     WHERE f.panel_id = p_panel_id
       AND f.status IN ('submitted', 'approved', 'rejected');
    IF v_count >= 3 THEN
      v_badges := array_append(v_badges, k3);
    END IF;
  END IF;

  -- ── 뱃지 4: 제로 데펙트 — 최근 10개 완결 피드백 모두 purity_passed=true ─
  IF NOT (k4 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM (
        SELECT purity_passed
          FROM feedbacks
         WHERE panel_id = p_panel_id
           AND status IN ('approved', 'rejected')
         ORDER BY created_at DESC
         LIMIT 10
      ) sub;
    SELECT COUNT(*) INTO v_count2
      FROM (
        SELECT purity_passed
          FROM feedbacks
         WHERE panel_id = p_panel_id
           AND status IN ('approved', 'rejected')
         ORDER BY created_at DESC
         LIMIT 10
      ) sub
     WHERE purity_passed = true;
    IF v_count >= 10 AND v_count = v_count2 THEN
      v_badges := array_append(v_badges, k4);
    END IF;
  END IF;

  -- ── 뱃지 5: 크리티컬 샷 — 30일 내 도움 됨 10회 이상 ─────────────────────
  IF NOT (k5 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings
     WHERE panel_id = p_panel_id
       AND is_helpful = true
       AND created_at >= NOW() - INTERVAL '30 days';
    IF v_count >= 10 THEN
      v_badges := array_append(v_badges, k5);
    END IF;
  END IF;

  -- ── 뱃지 6: 트렌드 오라클 — 최근 10개 A/B 선택이 미션 최다 선택 variant 일치
  IF NOT (k6 = ANY(v_badges)) THEN
    WITH panel_prefs AS (
      SELECT pr.mission_id, pr.preference AS panel_choice
        FROM preference_responses pr
        JOIN feedbacks f ON f.mission_id = pr.mission_id AND f.panel_id = p_panel_id
       WHERE pr.panel_id = p_panel_id
       ORDER BY pr.created_at DESC
       LIMIT 10
    ),
    mission_top AS (
      SELECT mission_id,
             preference AS top_choice,
             COUNT(*) AS cnt
        FROM preference_responses
       WHERE mission_id IN (SELECT mission_id FROM panel_prefs)
       GROUP BY mission_id, preference
    ),
    mission_winner AS (
      SELECT DISTINCT ON (mission_id) mission_id, top_choice
        FROM mission_top
       ORDER BY mission_id, cnt DESC
    )
    SELECT COUNT(*) INTO v_count
      FROM panel_prefs pp
      JOIN mission_winner mw ON mw.mission_id = pp.mission_id
     WHERE pp.panel_choice = mw.top_choice;

    SELECT COUNT(*) INTO v_count2 FROM (
      SELECT pr.mission_id
        FROM preference_responses pr
        JOIN feedbacks f ON f.mission_id = pr.mission_id AND f.panel_id = p_panel_id
       WHERE pr.panel_id = p_panel_id
       ORDER BY pr.created_at DESC
       LIMIT 10
    ) sub;

    IF v_count2 >= 10 AND v_count >= 10 THEN
      v_badges := array_append(v_badges, k6);
    END IF;
  END IF;

  -- ── 뱃지 7: 절대 영도 — 미션 50회+ AND 도움됨 비율 상위 1% ─────────────
  IF NOT (k7 = ANY(v_badges)) THEN
    SELECT total_missions INTO v_total_missions
      FROM panels WHERE id = p_panel_id;

    IF v_total_missions >= 50 THEN
      SELECT COUNT(*)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE status IN ('submitted','approved','rejected')), 0)
        INTO v_ratio
        FROM feedbacks
       WHERE panel_id = p_panel_id
         AND purity_passed = true;

      SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY helpful_ratio)
        INTO v_platform_pct
        FROM (
          SELECT panel_id,
                 COUNT(*) FILTER (WHERE is_helpful = true)::NUMERIC
                   / NULLIF(COUNT(*), 0) AS helpful_ratio
            FROM feedback_helpfulness_ratings
           GROUP BY panel_id
        ) sub;

      IF COALESCE(v_ratio, 0) >= COALESCE(v_platform_pct, 1) THEN
        v_badges := array_append(v_badges, k7);
      END IF;
    END IF;
  END IF;

  -- ── 뱃지 8: 픽셀 아키텍트 — 이미지 기반 피드백 도움됨 30회+ ────────────
  IF NOT (k8 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings fhr
      JOIN feedbacks f ON f.id = fhr.ref_id AND fhr.ref_type = 'feedback'
      JOIN missions m ON m.id = f.mission_id
     WHERE fhr.panel_id = p_panel_id
       AND fhr.is_helpful = true
       AND m.image_urls IS NOT NULL
       AND array_length(m.image_urls, 1) > 0;
    IF v_count >= 30 THEN
      v_badges := array_append(v_badges, k8);
    END IF;
  END IF;

  -- ── 뱃지 9: 에이펙스 노드 — 프리미엄 기업 의뢰 도움됨 3회+ ─────────────
  IF NOT (k9 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings fhr
      JOIN feedbacks f ON f.id = fhr.ref_id AND fhr.ref_type = 'feedback'
      JOIN missions m ON m.id = f.mission_id
      JOIN companies c ON c.id = m.company_id
     WHERE fhr.panel_id = p_panel_id
       AND fhr.is_helpful = true
       AND c.plan IN ('pro', 'enterprise');
    IF v_count >= 3 THEN
      v_badges := array_append(v_badges, k9);
    END IF;
  END IF;

  -- ── 뱃지 10: 마이크로스코프 (히든) — 500자+ 제안 도움됨 1회+ ─────────────
  IF NOT (k10 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings fhr
      JOIN feedbacks f ON f.id = fhr.ref_id AND fhr.ref_type = 'feedback'
     WHERE fhr.panel_id = p_panel_id
       AND fhr.is_helpful = true
       AND LENGTH(f.suggestions) >= 500;
    IF v_count >= 1 THEN
      v_badges := array_append(v_badges, k10);
    END IF;
  END IF;

  -- ── 뱃지 11: 퀵 타겟팅 (히든) — 5분 내 제출 + 도움됨 1회+ ──────────────
  IF NOT (k11 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings fhr
      JOIN feedbacks f ON f.id = fhr.ref_id AND fhr.ref_type = 'feedback'
      JOIN missions m ON m.id = f.mission_id
     WHERE fhr.panel_id = p_panel_id
       AND fhr.is_helpful = true
       AND (f.created_at - m.created_at) <= INTERVAL '5 minutes';
    IF v_count >= 1 THEN
      v_badges := array_append(v_badges, k11);
    END IF;
  END IF;

  -- ── 뱃지 12: 블랙 스완 (히든) — 이 패널 평균 ≤2.5 & 타 패널 평균 ≥4.0 & 도움됨 1회+
  IF NOT (k12 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings fhr
      JOIN feedbacks fp ON fp.id = fhr.ref_id AND fhr.ref_type = 'feedback'
     WHERE fhr.panel_id = p_panel_id
       AND fhr.is_helpful = true
       AND fp.panel_id = p_panel_id
       AND EXISTS (
         SELECT 1
           FROM feedbacks fo
          WHERE fo.mission_id = fp.mission_id
            AND fo.panel_id != p_panel_id
            AND fo.status IN ('submitted', 'approved')
          GROUP BY fo.mission_id
         HAVING AVG((fo.clarity_score + fo.relevance_score + fo.value_score
                     + fo.differentiation_score + fo.trust_score)::NUMERIC / 5) >= 4.0
       )
       AND (fp.clarity_score + fp.relevance_score + fp.value_score
            + fp.differentiation_score + fp.trust_score)::NUMERIC / 5 <= 2.5;
    IF v_count >= 1 THEN
      v_badges := array_append(v_badges, k12);
    END IF;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- v3 신규 뱃지
  -- ══════════════════════════════════════════════════════════════════════════

  -- ── 뱃지 13: 첫 발사 (rookie) — 첫 번째 피드백 제출 ─────────────────────
  IF NOT (k13 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedbacks
     WHERE panel_id = p_panel_id
       AND status IN ('submitted', 'approved', 'rejected');
    IF v_count >= 1 THEN
      v_badges := array_append(v_badges, k13);
    END IF;
  END IF;

  -- ── 뱃지 14: 삼연타 (rookie) — 30일 내 Purit Filter 3회 통과 ─────────────
  IF NOT (k14 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedbacks
     WHERE panel_id = p_panel_id
       AND purity_passed = true
       AND updated_at >= NOW() - INTERVAL '30 days';
    IF v_count >= 3 THEN
      v_badges := array_append(v_badges, k14);
    END IF;
  END IF;

  -- ── 뱃지 15: 댓글 장인 (elite) — 300자+ 상세 피드백으로 Purit Filter 10회 통과
  IF NOT (k15 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedbacks
     WHERE panel_id = p_panel_id
       AND purity_passed = true
       AND LENGTH(suggestions) >= 300;
    IF v_count >= 10 THEN
      v_badges := array_append(v_badges, k15);
    END IF;
  END IF;

  -- ── 뱃지 16: 스피드런 (elite) — 7일 내 Purit Filter 5회 통과 ─────────────
  IF NOT (k16 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedbacks
     WHERE panel_id = p_panel_id
       AND purity_passed = true
       AND updated_at >= NOW() - INTERVAL '7 days';
    IF v_count >= 5 THEN
      v_badges := array_append(v_badges, k16);
    END IF;
  END IF;

  -- ── 뱃지 17: 듀얼 코어 (elite) — 메인 5건 + 서브 5건 이상 Purit Filter 통과
  IF NOT (k17 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedbacks f
      JOIN missions m ON m.id = f.mission_id
     WHERE f.panel_id = p_panel_id
       AND f.purity_passed = true
       AND COALESCE(m.type, 'landing_page') = 'landing_page';

    SELECT COUNT(*) INTO v_count2
      FROM feedbacks f
      JOIN missions m ON m.id = f.mission_id
     WHERE f.panel_id = p_panel_id
       AND f.purity_passed = true
       AND m.type IN ('preference', 'pricing', 'email');

    IF v_count >= 5 AND v_count2 >= 5 THEN
      v_badges := array_append(v_badges, k17);
    END IF;
  END IF;

  -- ── 뱃지 18: 센추리 (master) — Purit Filter 누적 100회 통과 ─────────────
  IF NOT (k18 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedbacks
     WHERE panel_id = p_panel_id
       AND purity_passed = true;
    IF v_count >= 100 THEN
      v_badges := array_append(v_badges, k18);
    END IF;
  END IF;

  -- ── 뱃지 19: 인사이트 코어 (master) — 도움됨 누적 50회 이상 ─────────────
  IF NOT (k19 = ANY(v_badges)) THEN
    SELECT COUNT(*) INTO v_count
      FROM feedback_helpfulness_ratings
     WHERE panel_id = p_panel_id
       AND is_helpful = true;
    IF v_count >= 50 THEN
      v_badges := array_append(v_badges, k19);
    END IF;
  END IF;

  -- ── 최종 저장 ────────────────────────────────────────────────────────────
  UPDATE panels SET badges = v_badges WHERE id = p_panel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_award_badges(UUID) TO authenticated;
