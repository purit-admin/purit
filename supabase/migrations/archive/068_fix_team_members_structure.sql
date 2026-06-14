-- 068: team_members 구조 정비 + accept_team_invite RPC 보안 강화
-- 해결 버그: 완성도-B / BUG-STRUCT-2 / BUG-NEW-4 / BUG-NEW-2

-- 1. user_id 컬럼 추가 (수락한 사용자 저장)
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 2. role CHECK 제약 수정: 'member' 제거 → 'editor' 추가
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('admin', 'editor', 'viewer'));

-- 3. accept_team_invite RPC 재정의
--    - user_id = auth.uid() 저장 (소유권 기록)
--    - 초대받은 이메일과 로그인 계정 이메일 일치 검증
CREATE OR REPLACE FUNCTION accept_team_invite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member team_members%ROWTYPE;
  v_caller_email TEXT;
BEGIN
  -- 호출자 이메일 조회
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

  -- 토큰으로 초대 검색
  SELECT * INTO v_member
  FROM team_members
  WHERE invite_token = p_token
    AND status = 'invited'
    AND invite_expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired');
  END IF;

  -- 이메일 일치 검증 (BUG-NEW-2 해결)
  IF v_caller_email IS NULL OR lower(v_caller_email) != lower(v_member.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch', 'expected_email', v_member.email);
  END IF;

  -- 수락 처리: user_id 저장 (BUG-NEW-4 해결)
  UPDATE team_members SET
    status = 'active',
    user_id = auth.uid(),
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
