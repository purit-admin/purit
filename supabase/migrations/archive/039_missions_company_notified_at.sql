-- 039_missions_company_notified_at.sql
-- 취소 의뢰 기업 공개 게이트 컬럼 추가
-- 문제: 조기종료(cancelled) 의뢰가 어드민 완료 처리(earlyCompleteMission) 없이도 기업 Results.jsx에 즉시 노출됨
-- 해결: earlyCompleteMission 호출 시 이 컬럼을 SET → Results.jsx에서 NULL이면 취소 의뢰 미노출

ALTER TABLE missions ADD COLUMN IF NOT EXISTS company_notified_at TIMESTAMPTZ DEFAULT NULL;
