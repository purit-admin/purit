-- 072: create_oauth_user_profile RPC에 invite_token 처리 추가
-- Google OAuth 경로에서 초대된 팀원이 가입 시 companies 레코드 생성을 건너뜀
-- → migration 071(handle_new_user 이메일 경로)과 대칭 구조 완성

-- 기존 함수 제거 — 파라미터 시그니처 변경(2개→3개)으로 CREATE OR REPLACE 단독 불충분
DROP FUNCTION IF EXISTS public.create_oauth_user_profile(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_oauth_user_profile(
  p_role         TEXT,
  p_display_name TEXT,
  p_invite_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_user_email   TEXT;
  v_existing_id  UUID;
  v_skip_company BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

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
    -- invite_token이 유효한 team_members 초대 레코드와 매칭되면 companies 생성 건너뜀
    -- (migration 071 handle_new_user 이메일 경로와 동일한 검증 로직)
    v_skip_company := (
      p_invite_token IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE invite_token::text = p_invite_token
          AND status = 'invited'
      )
    );

    IF NOT v_skip_company THEN
      SELECT id INTO v_existing_id FROM companies WHERE user_id = v_user_id;
      IF v_existing_id IS NULL THEN
        INSERT INTO companies (
          user_id, name, email, plan, credit_balance
        ) VALUES (
          v_user_id, p_display_name, v_user_email, 'starter', 0
        );
      END IF;
    END IF;

  ELSE
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_oauth_user_profile(TEXT, TEXT, TEXT) TO authenticated;
