-- 040_alimtalk_setup.sql
-- AlimTalk 발송을 위한 컬럼 추가

-- feedbacks: 마감 1시간 전 알림톡 중복 발송 방지 플래그
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS deadline_alimtalk_sent BOOLEAN DEFAULT FALSE;

-- companies: 알림톡 수신용 전화번호 (패널과 동일하게 추가)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
