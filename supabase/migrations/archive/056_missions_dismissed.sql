-- missions 테이블에 dismissed 컬럼 추가 (기업 포털 소프트 삭제)
-- 기업 사용자는 "삭제" 버튼으로 숨김 처리하지만, 어드민 및 DB에는 데이터 유지

ALTER TABLE missions ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE;

-- 기업 포털 쿼리에서 dismissed=false 필터로 숨김 처리
-- 어드민 포털은 dismissed 필터 없이 전체 조회
