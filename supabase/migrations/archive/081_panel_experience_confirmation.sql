-- 081_panel_experience_confirmation.sql
-- 패널 경력(연차) 확정·잠금 시스템
-- 배경: 기존엔 패널이 Profile에서 experience("N년" 텍스트)를 자유롭게 수정 → 보상·자격 부풀리기 가능.
--       가입 시 건강보험 자격득실 확인서 기준 연차를 패널이 입력 → 어드민이 확정 → 패널 변경 불가.
--       확정일 기준 매년 자동 +1, 어드민 수동 상/하향도 가능. C레벨/임원은 어드민이 별도 지정(3.0배).
--
-- 핵심 원칙: 기존 experience TEXT는 '파생 필드'로 유지한다.
--   모든 다운스트림(getExperienceMultiplier/getExperienceCareerKey/미션 필터/보상/기업 타겟팅)은
--   experience 텍스트만 읽으므로 건드리지 않는다. 확정/조정/자동증가 시 아래 규칙으로 동기화:
--     is_executive=true  → experience = '임원'        (기존 정규식이 3.0배=clevel로 해석)
--     else               → experience = experience_years || '년'  (연차→tier 자동)

-- ① 신규 컬럼 3개
ALTER TABLE panels
  ADD COLUMN IF NOT EXISTS experience_years        INTEGER     DEFAULT NULL,  -- 확정 연차(가입 시 자가입력 → 어드민 확정·조정 대상)
  ADD COLUMN IF NOT EXISTS experience_confirmed_at TIMESTAMPTZ DEFAULT NULL,  -- 어드민 확정일(NULL=미확정) · 자동 +1 기준점
  ADD COLUMN IF NOT EXISTS is_executive            BOOLEAN     DEFAULT FALSE; -- 어드민 지정 C레벨/임원(3.0배)

-- ② 기존 패널 백필 (best-effort) — experience 텍스트에서 연차 숫자 파싱 + C레벨 키워드 매칭
--    confirmed_at은 NULL로 두어 어드민이 재확정하도록 함(기존 experience 텍스트는 그대로라 동작 불변)
UPDATE panels
SET
  experience_years = NULLIF(substring(experience from '\d+'), '')::int,
  is_executive     = (experience ~* 'c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사')
WHERE experience IS NOT NULL AND experience <> '';

-- ③ save_panel_verification_docs RPC 재정의 (파라미터 5→6개, 시그니처 변경이라 DROP 후 CREATE)
--    가입 단계 패널 자가입력 연차 저장 추가. 단, 이미 어드민이 확정한 값(confirmed_at NOT NULL)은 덮어쓰지 않음.
DROP FUNCTION IF EXISTS public.save_panel_verification_docs(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.save_panel_verification_docs(
  p_user_id              UUID,
  p_health_insurance_url TEXT DEFAULT NULL,
  p_linkedin_url         TEXT DEFAULT NULL,
  p_portfolio_url        TEXT DEFAULT NULL,
  p_portfolio_file_url   TEXT DEFAULT NULL,
  p_experience_years     INT  DEFAULT NULL
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
  -- experience_years: 미확정(confirmed_at NULL) 상태에서만 자가입력 반영 → 어드민 확정값 보호
  UPDATE panels
  SET
    health_insurance_url = COALESCE(p_health_insurance_url, health_insurance_url),
    linkedin_url         = COALESCE(p_linkedin_url,         linkedin_url),
    portfolio_url        = COALESCE(p_portfolio_url,        portfolio_url),
    portfolio_file_url   = COALESCE(p_portfolio_file_url,   portfolio_file_url),
    experience_years     = CASE
                             WHEN experience_confirmed_at IS NULL AND p_experience_years IS NOT NULL
                             THEN p_experience_years
                             ELSE experience_years
                           END
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_panel_verification_docs(UUID, TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;

-- ④ 어드민 경력 확정·조정 RPC — 최초 확정 / 수동 상향·하향 / C레벨 지정 모두 이 함수로 처리
--    확정 시점을 now()로 리셋(자동 +1 앵커 갱신) + experience 텍스트 동기화
CREATE OR REPLACE FUNCTION public.admin_confirm_panel_experience(
  p_panel_id     UUID,
  p_years        INT,
  p_is_executive BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 어드민 전용 (app_metadata.role — user_metadata 변조 방지, D-58)
  IF (auth.jwt()->'app_metadata'->>'role') IS DISTINCT FROM 'admin' THEN
    RETURN FALSE;
  END IF;
  IF p_years IS NULL OR p_years < 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE panels
  SET
    experience_years        = p_years,
    is_executive            = COALESCE(p_is_executive, FALSE),
    experience_confirmed_at = NOW(),
    experience              = CASE
                                WHEN COALESCE(p_is_executive, FALSE) THEN '임원'
                                ELSE p_years::text || '년'
                              END
  WHERE id = p_panel_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_panel_experience(UUID, INT, BOOLEAN) TO authenticated;

-- ⑤ 확정 후 1년 경과 자동 +1 (pg_cron용) — 다년 누락도 한 번에 보정(경과 만년 수만큼)
CREATE OR REPLACE FUNCTION public.auto_increment_panel_experience()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH due AS (
    SELECT id,
           EXTRACT(YEAR FROM AGE(NOW(), experience_confirmed_at))::int AS yrs
    FROM panels
    WHERE experience_confirmed_at IS NOT NULL
      AND experience_years IS NOT NULL
      AND AGE(NOW(), experience_confirmed_at) >= INTERVAL '1 year'
  )
  UPDATE panels p
  SET
    experience_years        = p.experience_years + d.yrs,
    experience_confirmed_at = p.experience_confirmed_at + (d.yrs * INTERVAL '1 year'),
    experience              = CASE
                                WHEN p.is_executive THEN '임원'
                                ELSE (p.experience_years + d.yrs)::text || '년'
                              END
  FROM due d
  WHERE p.id = d.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_increment_panel_experience() TO service_role;

-- ⑥ pg_cron 자동 실행 스케줄 (매일 1회 03:10 KST 가정 — UTC 18:10)
-- ※ Supabase SQL Editor에서 아래 구문을 별도로 실행해야 함
-- SELECT cron.schedule(
--   'auto-increment-panel-experience',
--   '10 18 * * *',
--   $$SELECT public.auto_increment_panel_experience()$$
-- );
