-- 041_pg_cron_deadline_alimtalk.sql
-- 마감 1시간 전 알림톡 자동 발송 스케줄 등록
--
-- ⚠️ 사전 작업 (Supabase 대시보드 → Database → Extensions 에서 수동 활성화 필요):
--    1. pg_cron   활성화
--    2. pg_net    활성화
--
-- ⚠️ 아래 두 값을 실제 프로젝트 값으로 교체 후 실행:
--    [YOUR_PROJECT_REF]  → Supabase 프로젝트 Reference ID (예: abcdefghijklmnop)
--    [YOUR_ANON_KEY]     → Supabase 프로젝트 anon public key

-- DB 설정값 저장 (Edge Function URL 조립에 사용)
ALTER DATABASE postgres SET app.supabase_url = 'https://[YOUR_PROJECT_REF].supabase.co';
ALTER DATABASE postgres SET app.supabase_anon_key = '[YOUR_ANON_KEY]';

-- 30분마다 마감 임박 알림 체크 실행
SELECT cron.schedule(
  'check-deadline-alimtalk',   -- 잡 이름 (중복 방지)
  '*/30 * * * *',              -- 매 30분 (0분, 30분)
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/check-deadline-alimtalk',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
