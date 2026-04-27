-- 어드민 계정(purit.admin@gmail.com)에 panels + companies 레코드 생성
-- Supabase SQL Editor에서 실행하세요.

DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = 'purit.admin@gmail.com'
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'purit.admin@gmail.com 계정을 찾을 수 없습니다. 이메일을 확인하세요.';
  END IF;

  -- panels 레코드 생성 (없을 때만)
  INSERT INTO panels (user_id, name, industry, experience, total_missions, status, tier, trust_score)
  VALUES (admin_id, 'PURIT Admin', '플랫폼 운영', '5년 이상', 0, 'active', 'EXPERT', 100)
  ON CONFLICT (user_id) DO NOTHING;

  -- companies 레코드 생성 (없을 때만)
  INSERT INTO companies (user_id, name, plan)
  VALUES (admin_id, 'PURIT Inc.', 'pro')
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE '완료: admin_id = %', admin_id;
END $$;
