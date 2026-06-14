-- 패널·기업 알림 수신 설정 저장용 JSONB 컬럼
-- 키 부재 또는 true = 수신, false = 차단
ALTER TABLE panels    ADD COLUMN IF NOT EXISTS notif_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notif_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
