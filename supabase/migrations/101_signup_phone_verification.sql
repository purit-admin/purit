-- 101_signup_phone_verification.sql
-- 가입 시 휴대폰 인증(Mock) — 알림톡 도달을 위해 전 사용자 휴대폰 확보
--   · 이메일 가입: 가입 폼에서 인증 후 user_metadata(phone·phone_verified)로 전달 → 본 트리거가 DB에 저장
--   · Google 가입: 가입 폼을 거치지 않으므로 가입 후 /verify-phone 게이트에서 본인이 직접 인증·저장
-- 변경점:
--   1) companies.phone_verified 컬럼 추가 (panels.phone_verified는 012에서 이미 존재)
--   2) handle_new_user 재정의 — 085 본문 100% 유지 + INSERT에 phone·phone_verified 추가
--      ※ phone_verified는 metadata 텍스트('true'/'false')로 들어오므로 = 'true' 비교

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'panel' THEN
    INSERT INTO public.panels (user_id, name, email, status, phone, phone_verified)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'pending',
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone_verified', 'false') = 'true'
    )
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF NEW.raw_user_meta_data->>'role' = 'company'
    AND (
      NEW.raw_user_meta_data->>'invite_token' IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE invite_token::text = NEW.raw_user_meta_data->>'invite_token'
          AND status = 'invited'
      )
    ) THEN
    INSERT INTO public.companies (user_id, name, email, plan, phone, phone_verified)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'free_trial',
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone_verified', 'false') = 'true'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
