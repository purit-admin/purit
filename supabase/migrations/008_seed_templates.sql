-- 008_seed_templates.sql
-- 브랜드 포지셔닝 템플릿 삭제 + 서브 의뢰 유형별 고품질 템플릿 추가

-- =====================================================
-- 1. 브랜드 포지셔닝 삭제
-- =====================================================

DELETE FROM template_questions
  WHERE template_id IN (SELECT id FROM question_templates WHERE category = '브랜드');
DELETE FROM question_templates WHERE category = '브랜드';

-- =====================================================
-- 2. 기존 category 값 업데이트 (코드 매핑에 맞게)
-- =====================================================

-- '광고' → '광고소재' (소재 비교 A/B 탭과 매핑)
UPDATE question_templates SET category = '광고소재' WHERE category = '광고';

-- =====================================================
-- 3. 소재 비교 A/B 템플릿 2개 신규 삽입
-- =====================================================

-- 3-1. 첫인상 & 전환력 (5문항)
WITH ins AS (
  INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
  VALUES (
    '첫인상 & 전환력',
    '⚡',
    '광고소재',
    '두 소재를 나란히 비교해 첫 시선, 메시지 명확성, 구매 전환력을 다각도로 검증합니다.',
    0,
    true
  )
  RETURNING id
)
INSERT INTO template_questions (template_id, question_text, question_order)
SELECT ins.id, q.text, q.ord FROM ins,
(VALUES
  (1, '첫눈에 더 시선을 끈 소재는 어느 쪽인가요? 그 이유를 구체적으로 적어주세요.'),
  (2, '어떤 소재의 핵심 메시지가 더 명확하게 전달됐나요? (소재 A / 소재 B + 이유)'),
  (3, '어떤 소재가 클릭하거나 구매하고 싶게 만드나요? (1=전혀 없다 / 5=매우 그렇다)'),
  (4, '어떤 소재가 브랜드를 더 신뢰하게 만드나요? (1=전혀 없다 / 5=매우 그렇다)'),
  (5, '두 소재 중 개선이 더 시급한 쪽과 그 핵심 이유를 말씀해 주세요.')
) AS q(ord, text);

-- 3-2. 메시지 공명 분석 (4문항)
WITH ins AS (
  INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
  VALUES (
    '메시지 공명 분석',
    '🎯',
    '광고소재',
    '패널의 실제 문제 의식과 소재 메시지가 얼마나 공명하는지, 기억에 남는 카피인지 검증합니다.',
    0,
    true
  )
  RETURNING id
)
INSERT INTO template_questions (template_id, question_text, question_order)
SELECT ins.id, q.text, q.ord FROM ins,
(VALUES
  (1, '어떤 소재가 당신의 실제 문제나 상황을 더 잘 표현하나요? (소재 A / 소재 B)'),
  (2, '어떤 소재에서 "나를 위한 제품이다"라는 느낌이 드나요? (1=전혀 없다 / 5=매우 강하게)'),
  (3, '어떤 소재의 카피(문구)가 일주일 뒤에도 기억에 남을 것 같나요? (소재 A / 소재 B + 이유)'),
  (4, '최종적으로 선택한 소재와, 그 소재를 선택한 이유를 한 문장으로 요약해 주세요.')
) AS q(ord, text);

-- =====================================================
-- 4. 가격 페이지 검증 템플릿 2개 신규 삽입
-- =====================================================

-- 4-1. 가격 감지 테스트 (5문항)
WITH ins AS (
  INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
  VALUES (
    '가격 감지 테스트',
    '💰',
    '가격',
    '제시된 가격의 적절성, 구매 의향, 가격 대비 가치 인식을 정밀하게 측정합니다.',
    0,
    true
  )
  RETURNING id
)
INSERT INTO template_questions (template_id, question_text, question_order)
SELECT ins.id, q.text, q.ord FROM ins,
(VALUES
  (1, '이 가격이 시장 평균 대비 적절하다고 느끼나요? (1=매우 비싸다 / 5=매우 합리적이다)'),
  (2, '이 가격에 즉시 구매할 의향이 있나요? (1=전혀 없다 / 5=즉시 구매하겠다)'),
  (3, '가격 대비 받게 되는 가치가 충분하다고 느끼나요? (1=전혀 충분하지 않다 / 5=매우 충분하다)'),
  (4, '구매를 망설이게 만드는 가격 관련 요소가 있다면 구체적으로 적어주세요.'),
  (5, '이 제품/서비스에 기꺼이 지불할 적정 최대 금액은 얼마라고 생각하시나요?')
) AS q(ord, text);

-- 4-2. 플랜 비교 명확성 (4문항)
WITH ins AS (
  INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
  VALUES (
    '플랜 비교 명확성',
    '📊',
    '가격',
    '여러 플랜을 제시할 때 각 플랜의 차이점이 명확히 전달되는지, 의사결정 과정이 쉬운지 검증합니다.',
    0,
    true
  )
  RETURNING id
)
INSERT INTO template_questions (template_id, question_text, question_order)
SELECT ins.id, q.text, q.ord FROM ins,
(VALUES
  (1, '각 플랜 간의 차이점이 명확하게 이해됐나요? (1=전혀 이해 안 됨 / 5=매우 명확하게 이해됨)'),
  (2, '나에게 맞는 플랜을 쉽게 선택할 수 있었나요? (1=매우 어려웠다 / 5=매우 쉬웠다)'),
  (3, '어떤 플랜을 선택하겠으며, 그 이유는 무엇인가요?'),
  (4, '가격 페이지에서 더 명확히 설명됐으면 하는 부분이 있다면 구체적으로 적어주세요.')
) AS q(ord, text);

-- =====================================================
-- 5. 이메일 검증 템플릿 2개 신규 삽입
-- =====================================================

-- 5-1. 개봉률 최적화 (5문항)
WITH ins AS (
  INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
  VALUES (
    '개봉률 최적화',
    '📬',
    '이메일',
    '이메일 제목줄과 첫 문장이 개봉을 유도하는지, 전체 메시지가 명확히 전달되는지 검증합니다.',
    0,
    true
  )
  RETURNING id
)
INSERT INTO template_questions (template_id, question_text, question_order)
SELECT ins.id, q.text, q.ord FROM ins,
(VALUES
  (1, '제목줄만 보고 이 이메일을 열어볼 것 같나요? (1=절대 열지 않는다 / 5=바로 열어본다)'),
  (2, '첫 두 문장이 계속 읽고 싶게 만드나요? (1=전혀 그렇지 않다 / 5=매우 그렇다)'),
  (3, '이메일 전체 메시지가 명확하게 전달됐나요? (1=전혀 이해 못 함 / 5=매우 명확히 이해됨)'),
  (4, '이 이메일에 답장하거나 링크를 클릭할 의향이 있나요? (1=전혀 없다 / 5=바로 클릭하겠다)'),
  (5, '가장 인상적인 부분과 가장 아쉬운 부분을 각각 적어주세요.')
) AS q(ord, text);

-- 5-2. 콜드 리치아웃 효과 분석 (4문항)
WITH ins AS (
  INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
  VALUES (
    '콜드 리치아웃 효과',
    '🎣',
    '이메일',
    '처음 받는 영업 이메일로서 타겟 적합성, 제안 매력도, 신뢰감, CTA 효과를 측정합니다.',
    0,
    true
  )
  RETURNING id
)
INSERT INTO template_questions (template_id, question_text, question_order)
SELECT ins.id, q.text, q.ord FROM ins,
(VALUES
  (1, '이 이메일이 나를 정확히 타겟으로 한 것 같나요? (1=전혀 아니다 / 5=완벽하게 나를 위한 것이다)'),
  (2, '발신자의 제안이 매력적이고 구체적으로 느껴지나요? (1=전혀 그렇지 않다 / 5=매우 매력적이다)'),
  (3, '이 이메일이 스팸처럼 느껴지지 않고 신뢰가 가나요? (1=스팸 같다 / 5=매우 신뢰가 간다)'),
  (4, '행동을 이끌어내는 CTA(call-to-action)가 효과적인가요? (1=전혀 그렇지 않다 / 5=매우 효과적이다)')
) AS q(ord, text);
