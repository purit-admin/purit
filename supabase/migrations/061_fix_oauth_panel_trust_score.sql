-- 061_fix_oauth_panel_trust_score.sql
-- create_oauth_user_profile RPC 수정 — panels INSERT의 trust_score 0으로 정정
-- 배경: 060에서 trust_score = 100 하드코딩 → 신규 OAuth 패널이 제출 0건임에도
--       신뢰도 100%로 시작하는 버그. trust_score 계산 공식(migration 009)은
--       ROUND(approved / total * 100)이므로 신규 패널은 반드시 0에서 시작해야 함.
-- 수정: trust_score = 0 으로 정정
-- 추가: 이미 잘못 생성된 OAuth 패널(total_missions=0인데 trust_score=100) 일괄 보정

CREATE OR REPLACE FUNCTION create_oauth_user_profile(
  p_role         TEXT,
  p_display_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_user_email  TEXT;
  v_existing_id UUID;
BEGIN
  -- 인증된 유저만 호출 가능
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- auth.users에서 이메일 조회 (NOT NULL 컬럼 값 공급용)
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF p_role = 'panel' THEN
    SELECT id INTO v_existing_id FROM panels WHERE user_id = v_user_id;
    IF v_existing_id IS NULL THEN
      INSERT INTO panels (
        user_id, name, email, status, trust_score, total_missions, honor_points, selected_badge
      ) VALUES (
        v_user_id, p_display_name, v_user_email, 'active', 0, 0, 0, NULL
      );
    END IF;

  ELSIF p_role = 'company' THEN
    SELECT id INTO v_existing_id FROM companies WHERE user_id = v_user_id;
    IF v_existing_id IS NULL THEN
      INSERT INTO companies (
        user_id, name, email, plan, credit_balance
      ) VALUES (
        v_user_id, p_display_name, v_user_email, 'starter', 0
      );
    END IF;

  ELSE
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- authenticated 유저만 호출 가능 (anonymous 제외)
GRANT EXECUTE ON FUNCTION create_oauth_user_profile(TEXT, TEXT) TO authenticated;

-- 기존 잘못 생성된 OAuth 패널 일괄 보정
-- total_missions = 0 이고 trust_score = 100 인 패널은 잘못된 초기값을 가진 신규 OAuth 패널
UPDATE panels
SET trust_score = 0
WHERE total_missions = 0
  AND trust_score = 100;
