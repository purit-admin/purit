-- 065_save_panel_verification_docs.sql
-- 패널 검증 자료(건강보험·LinkedIn·포트폴리오)를 panels 테이블에 저장하는 SECURITY DEFINER RPC
-- 이유: 이메일 가입 직후 이메일 미확인 상태(또는 RLS 설정)로 인해 직접 UPDATE가 차단될 수 있음
--       SECURITY DEFINER로 RLS를 우회하되, auth.uid() = p_user_id 검증으로 본인 데이터만 수정 보장

CREATE OR REPLACE FUNCTION public.save_panel_verification_docs(
  p_user_id              UUID,
  p_health_insurance_url TEXT DEFAULT NULL,
  p_linkedin_url         TEXT DEFAULT NULL,
  p_portfolio_url        TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 인증 체크: 호출자가 본인이어야 함
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN FALSE;
  END IF;

  -- 전달된 값만 업데이트 (NULL이면 기존 값 유지 — COALESCE 패턴)
  UPDATE panels
  SET
    health_insurance_url = COALESCE(p_health_insurance_url, health_insurance_url),
    linkedin_url         = COALESCE(p_linkedin_url,         linkedin_url),
    portfolio_url        = COALESCE(p_portfolio_url,        portfolio_url)
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;
