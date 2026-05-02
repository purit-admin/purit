-- feedbacks 테이블에 custom_answers JSONB 컬럼 추가
-- 메인 의뢰(LP검증)에서 선택한 질문 템플릿 응답 저장용
-- 형식: [{ questionId, questionText, type, answer }]
ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT NULL;
