-- 123_company_name_and_contact.sql
-- 1순위(니체-AUTH-B): 가입 시 회사명을 받지 않아 companies.name에 '담당자 이름'이 저장되던 문제 수정
--   · B2B 서비스인데 가입 폼이 '담당자 이름'만 받아 companies.name이 사람 이름으로 채워짐
--     → 어드민 기업 관리·정산·구독해지 목록에서 회사가 사람 이름으로 표기
-- 변경점:
--   1) companies.contact_name 컬럼 신설 (담당자 이름 별도 보관)
--   2) handle_new_user 재정의 — 101 본문 100% 유지 + 회사 분기 INSERT만 수정
--        name         = company_name (없으면 구 name → 이메일prefix 폴백 = 하위호환)
--        contact_name = name (담당자 이름)
--   ※ 패널 분기·invite 스킵 조건·phone 저장은 101과 동일 (무수정)
--   ※ Google OAuth 가입은 create_oauth_user_profile(별도 함수) 경로라 영향 없음
--     (OAuth 기업은 회사명 미수집 → companies.name은 추후 /company/account에서 편집)

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_name TEXT;

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
    INSERT INTO public.companies (user_id, name, contact_name, email, plan, phone, phone_verified)
    VALUES (
      NEW.id,
      -- 회사명: 신규 폼은 company_name 전달 / 구 클라(없음)는 name → 이메일prefix 폴백
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'name', ''),
        split_part(NEW.email, '@', 1)
      ),
      -- 담당자 이름
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
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
