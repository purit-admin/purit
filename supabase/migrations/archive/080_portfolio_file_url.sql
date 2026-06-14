-- 080_portfolio_file_url.sql
-- 포트폴리오 링크와 파일을 분리 저장하기 위한 신규 컬럼 + RPC 5-param 재정의
-- 배경: 기존엔 portfolio_url 단일 컬럼에 링크/파일을 함께 저장 → 둘 다 제출 시 파일만 남고 링크 유실
--       portfolio_url = 링크 전용, portfolio_file_url = 파일 경로 전용으로 분리

-- ① 신규 컬럼: 포트폴리오 파일 Storage 경로 전용
ALTER TABLE panels
  ADD COLUMN IF NOT EXISTS portfolio_file_url TEXT;

-- ② save_panel_verification_docs RPC 재정의 (파라미터 4→5개, 시그니처 변경이라 DROP 후 CREATE)
DROP FUNCTION IF EXISTS public.save_panel_verification_docs(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.save_panel_verification_docs(
  p_user_id              UUID,
  p_health_insurance_url TEXT DEFAULT NULL,
  p_linkedin_url         TEXT DEFAULT NULL,
  p_portfolio_url        TEXT DEFAULT NULL,
  p_portfolio_file_url   TEXT DEFAULT NULL
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
    portfolio_url        = COALESCE(p_portfolio_url,        portfolio_url),
    portfolio_file_url   = COALESCE(p_portfolio_file_url,   portfolio_file_url)
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_panel_verification_docs(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
