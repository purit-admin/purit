-- 064_fix_oauth_panel_status_pending.sql
-- create_oauth_user_profile RPC 재정의: 신규 패널 status='pending'으로 수정
-- (migration 061에서 'active' 하드코딩 → 'pending'으로 변경)
-- RETURNS BOOLEAN 시그니처 유지 (OAuthCallback.jsx 호환)

CREATE OR REPLACE FUNCTION public.create_oauth_user_profile(
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
        v_user_id, p_display_name, v_user_email, 'pending', 0, 0, 0, NULL
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
GRANT EXECUTE ON FUNCTION public.create_oauth_user_profile(TEXT, TEXT) TO authenticated;
