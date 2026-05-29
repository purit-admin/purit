-- 067: team_members에 초대 토큰 컬럼 추가 + 수락 RPC 생성

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS invite_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_invite_token_idx
  ON team_members(invite_token) WHERE invite_token IS NOT NULL;

-- 초대 수락 RPC
-- SECURITY DEFINER: 비로그인 상태에서도 토큰으로 호출 가능
-- 단, 수락 처리 자체는 클라이언트에서 로그인 후 호출하도록 유도
CREATE OR REPLACE FUNCTION accept_team_invite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member team_members%ROWTYPE;
BEGIN
  SELECT * INTO v_member
  FROM team_members
  WHERE invite_token = p_token
    AND status = 'invited'
    AND invite_expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired');
  END IF;

  UPDATE team_members SET
    status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    joined_at = CURRENT_DATE
  WHERE id = v_member.id;

  RETURN jsonb_build_object(
    'ok', true,
    'company_id', v_member.company_id,
    'role', v_member.role,
    'email', v_member.email
  );
END;
$$;

-- 토큰으로 초대 정보만 조회 (비로그인 peek용)
CREATE OR REPLACE FUNCTION peek_team_invite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member team_members%ROWTYPE;
  v_company_name TEXT;
BEGIN
  SELECT tm.* INTO v_member
  FROM team_members tm
  WHERE tm.invite_token = p_token
    AND tm.status = 'invited'
    AND tm.invite_expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired');
  END IF;

  SELECT name INTO v_company_name FROM companies WHERE id = v_member.company_id;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_member.email,
    'role', v_member.role,
    'company_name', COALESCE(v_company_name, ''),
    'expires_at', v_member.invite_expires_at
  );
END;
$$;
