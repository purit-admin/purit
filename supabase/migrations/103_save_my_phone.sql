-- 102_save_my_phone.sql
-- 가입 휴대폰 인증 저장 보강 — 팀원(team_members) 휴대폰 미저장 문제 해소 (설계-1)
-- 배경: 기업 팀원은 본인 companies 행이 없어 VerifyPhone의 companies UPDATE가 0행 처리 → 휴대폰이 DB에 저장 안 됨.
--       team_members에 self-UPDATE RLS를 열면 role/status까지 바꿀 수 있어 권한 상승 위험 →
--       컬럼만 갱신하는 SECURITY DEFINER RPC(save_my_phone)로 안전하게 처리.
-- 변경점:
--   1) team_members.phone / phone_verified 컬럼 추가
--   2) save_my_phone(p_phone) — 호출자(auth.uid()) 본인 행(panels/companies/team_members)에만 phone·phone_verified 저장
--      · SECURITY DEFINER로 RLS 우회하되 WHERE user_id = auth.uid()로 본인 행만 → IDOR/권한 상승 없음
--      · 사용자는 셋 중 하나에만 해당하므로 나머지 UPDATE는 0행(무해)

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.save_my_phone(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 숫자 10자리 미만은 거부 (Mock 검증 — 클라이언트와 동일 기준)
  IF p_phone IS NULL OR length(regexp_replace(p_phone, '\D', '', 'g')) < 10 THEN
    RETURN false;
  END IF;

  UPDATE public.panels       SET phone = p_phone, phone_verified = true WHERE user_id = auth.uid();
  UPDATE public.companies    SET phone = p_phone, phone_verified = true WHERE user_id = auth.uid();
  UPDATE public.team_members SET phone = p_phone, phone_verified = true WHERE user_id = auth.uid();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_my_phone(TEXT) TO authenticated;
