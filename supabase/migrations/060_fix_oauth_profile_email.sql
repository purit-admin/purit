-- 060_fix_oauth_profile_email.sql
-- create_oauth_user_profile RPC 수정 — panels/companies INSERT에 email 컬럼 추가
-- 배경: 실제 DB의 panels.email, companies.email이 NOT NULL 컬럼으로 존재하는데
--       059에서 INSERT 시 해당 컬럼을 누락 → 'not-null constraint' 오류로 프로필 생성 항상 실패
-- 수정: auth.users 테이블에서 이메일 조회 후 두 INSERT에 포함

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
        v_user_id, p_display_name, v_user_email, 'active', 100, 0, 0, NULL
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
