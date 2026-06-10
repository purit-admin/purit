-- 086_fix_companies_plan_check.sql
-- 085가 신규 가입 plan을 'free_trial'로 바꿨으나, 운영 DB의 companies_plan_check 제약은
-- 구 값('starter'/'pro'/'enterprise')만 허용 → 모든 신규 가입(이메일·구글) INSERT가 제약 위반으로 실패.
--   증상: 구글 가입 시 create_oauth_user_profile RPC가 "violates check constraint companies_plan_check"
--         → OAuthCallback 오류 화면 → 회사 레코드 미생성 → 로그인 시 "초대 수락이 필요합니다" 오표시
--   ※ 085 주석("companies.plan CHECK 제약 없음 — D-117 무관")이 틀렸음. 운영 DB에 제약 존재(대시보드 수동 생성).
-- 해결: 제약을 'free_trial' 포함 4종으로 재정의 (D-117 — enum 추가 시 DB CHECK 동기화 필수).
--      ※ 085가 무료 등급명을 'free' → 'free_trial'로 바꾸며 기존 'free' 행을 이관하지 않음.
--        기존 'free' 회사(구 무료 등급)를 'free_trial'로 먼저 정규화해야 4종 제약을 걸 수 있음.
--        (정규화 없이 ADD CONSTRAINT 시 "violated by some row" 에러)

-- 기존 제약 제거 (이름은 PostgreSQL 자동 명명 규칙 companies_plan_check)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_plan_check;

-- 구 무료 등급('free') → 신 무료체험('free_trial') 데이터 이관
-- 'free'가 'free_trial'이 대체한 바로 그 무료 등급이므로 의미상 정확한 매핑.
-- free_trial_used 는 085 DEFAULT(false) 유지 → 이관된 계정도 무료체험 1회 제공.
UPDATE companies SET plan = 'free_trial' WHERE plan = 'free';

-- 'free_trial' 포함 4종으로 재생성 (admin_change_plan / grant_plan_credits 허용 목록과 일치)
ALTER TABLE companies
  ADD CONSTRAINT companies_plan_check
  CHECK (plan IN ('free_trial', 'starter', 'pro', 'enterprise'));
