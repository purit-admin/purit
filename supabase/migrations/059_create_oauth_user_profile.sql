-- 059_create_oauth_user_profile.sql
-- Google OAuth 신규 유저의 panels/companies 레코드를 안전하게 생성하는 SECURITY DEFINER RPC
-- 배경: panels/companies에 INSERT RLS 정책이 없어 클라이언트 직접 INSERT가 조용히 차단됨 (D-5 패턴)
-- OAuthCallback.jsx가 직접 INSERT 대신 이 RPC를 호출해 RLS 우회

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
  v_existing_id UUID;
BEGIN
  -- 인증된 유저만 호출 가능
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_role = 'panel' THEN
    SELECT id INTO v_existing_id FROM panels WHERE user_id = v_user_id;
    IF v_existing_id IS NULL THEN
      INSERT INTO panels (
        user_id, name, status, trust_score, total_missions, honor_points, selected_badge
      ) VALUES (
        v_user_id, p_display_name, 'active', 100, 0, 0, NULL
      );
    END IF;

  ELSIF p_role = 'company' THEN
    SELECT id INTO v_existing_id FROM companies WHERE user_id = v_user_id;
    IF v_existing_id IS NULL THEN
      INSERT INTO companies (
        user_id, name, plan, credit_balance
      ) VALUES (
        v_user_id, p_display_name, 'starter', 0
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
