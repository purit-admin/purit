-- 124_phone_otp.sql
-- 2순위(완성도-D): 휴대폰 OTP 인증 정식화 — Mock(아무 6자리나 통과) → 실제 SMS + 서버 검증
--   · 인증번호를 서버에서 생성·저장하고 5분 만료·시도 제한을 서버가 강제
--   · 클라이언트는 phone_otps에 직접 접근 불가(RLS 전면 차단) — send-otp/verify-otp Edge Function(service_role)만 접근
--
-- 테이블: phone_otps
--   phone        정규화된 숫자만(예: 01012345678)
--   code         6자리 인증번호
--   expires_at   만료 시각 (발송 + 5분)
--   attempts     검증 시도 횟수 (5회 초과 시 차단)
--   verified     검증 성공 여부

CREATE TABLE IF NOT EXISTS public.phone_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  code        text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  verified    boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 최신 발송 행 조회·재발송 제한(rate limit) 계산용
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_created
  ON public.phone_otps (phone, created_at DESC);

-- RLS 활성화 + 정책 없음 → anon/authenticated 직접 접근 전면 차단
--   (Edge Function은 service_role 키라 RLS 우회 — D-79/D-136 서버 마스킹 원칙과 동일)
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- 만료/사용 완료 행 정리용 RPC (선택적 pg_cron — 미등록이어도 기능엔 무관, 테이블 위생용)
CREATE OR REPLACE FUNCTION public.cleanup_expired_phone_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.phone_otps
  WHERE created_at < now() - INTERVAL '1 day';
$$;
