-- 071: handle_new_user 트리거 재정의
-- 초대 토큰이 있고 유효한 team_members 초대 레코드와 매칭되면 companies 레코드 생성을 건너뜀
-- → 팀원 가입 시 빈 회사가 만들어지는 근본 원인 해결

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'panel' THEN
    INSERT INTO public.panels (user_id, name, email, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF NEW.raw_user_meta_data->>'role' = 'company'
    AND (
      -- invite_token 없음: 일반 기업 가입 → companies 생성
      NEW.raw_user_meta_data->>'invite_token' IS NULL
      -- invite_token 있지만 유효한 초대 레코드가 없음: 임의 토큰 → companies 생성
      OR NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE invite_token::text = NEW.raw_user_meta_data->>'invite_token'
          AND status = 'invited'
      )
    ) THEN
    INSERT INTO public.companies (user_id, name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
