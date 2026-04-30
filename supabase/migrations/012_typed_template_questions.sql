-- 012_typed_template_questions.sql
-- 1) template_questions에 question_type / options 컬럼 추가
-- 2) 응답 테이블에 custom_answers JSONB 컬럼 추가
-- 3) 기존 6개 템플릿 질문에 타입/옵션 적용
-- 4) 신규 3개 템플릿 (광고 소재 A/B, 가격 페이지 검증, 콜드메일 효과 측정) 삽입

-- =====================================================
-- 1. 컬럼 추가
-- =====================================================

ALTER TABLE template_questions
  ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]';

ALTER TABLE preference_responses
  ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '[]';

ALTER TABLE pricing_responses
  ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '[]';

ALTER TABLE email_responses
  ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '[]';

-- =====================================================
-- 2. 기존 템플릿 질문 type/options 업데이트
-- =====================================================

-- [첫인상 & 전환력] 5문항
DO $$
DECLARE tmpl_id UUID;
BEGIN
  SELECT id INTO tmpl_id FROM question_templates WHERE name = '첫인상 & 전환력' LIMIT 1;
  IF tmpl_id IS NOT NULL THEN
    UPDATE template_questions SET question_type='text',  options='[]'
      WHERE template_id=tmpl_id AND question_order=1;
    UPDATE template_questions SET question_type='radio', options='["소재 A","소재 B"]'
      WHERE template_id=tmpl_id AND question_order=2;
    UPDATE template_questions SET question_type='scale', options='[]'
      WHERE template_id=tmpl_id AND question_order=3;
    UPDATE template_questions SET question_type='scale', options='[]'
      WHERE template_id=tmpl_id AND question_order=4;
    UPDATE template_questions SET question_type='text',  options='[]'
      WHERE template_id=tmpl_id AND question_order=5;
  END IF;
END $$;

-- [메시지 공명 분석] 4문항
DO $$
DECLARE tmpl_id UUID;
BEGIN
  SELECT id INTO tmpl_id FROM question_templates WHERE name = '메시지 공명 분석' LIMIT 1;
  IF tmpl_id IS NOT NULL THEN
    UPDATE template_questions SET question_type='radio', options='["소재 A","소재 B"]'
      WHERE template_id=tmpl_id AND question_order=1;
    UPDATE template_questions SET question_type='scale', options='[]'
      WHERE template_id=tmpl_id AND question_order=2;
    UPDATE template_questions SET question_type='radio', options='["소재 A","소재 B"]'
      WHERE template_id=tmpl_id AND question_order=3;
    UPDATE template_questions SET question_type='text',  options='[]'
      WHERE template_id=tmpl_id AND question_order=4;
  END IF;
END $$;

-- [가격 감지 테스트] 5문항
DO $$
DECLARE tmpl_id UUID;
BEGIN
  SELECT id INTO tmpl_id FROM question_templates WHERE name = '가격 감지 테스트' LIMIT 1;
  IF tmpl_id IS NOT NULL THEN
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=1;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=2;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=3;
    UPDATE template_questions SET question_type='text',  options='[]' WHERE template_id=tmpl_id AND question_order=4;
    UPDATE template_questions SET question_type='text',  options='[]' WHERE template_id=tmpl_id AND question_order=5;
  END IF;
END $$;

-- [플랜 비교 명확성] 4문항
DO $$
DECLARE tmpl_id UUID;
BEGIN
  SELECT id INTO tmpl_id FROM question_templates WHERE name = '플랜 비교 명확성' LIMIT 1;
  IF tmpl_id IS NOT NULL THEN
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=1;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=2;
    UPDATE template_questions SET question_type='text',  options='[]' WHERE template_id=tmpl_id AND question_order=3;
    UPDATE template_questions SET question_type='text',  options='[]' WHERE template_id=tmpl_id AND question_order=4;
  END IF;
END $$;

-- [개봉률 최적화] 5문항
DO $$
DECLARE tmpl_id UUID;
BEGIN
  SELECT id INTO tmpl_id FROM question_templates WHERE name = '개봉률 최적화' LIMIT 1;
  IF tmpl_id IS NOT NULL THEN
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=1;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=2;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=3;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=4;
    UPDATE template_questions SET question_type='text',  options='[]' WHERE template_id=tmpl_id AND question_order=5;
  END IF;
END $$;

-- [콜드 리치아웃 효과] 4문항
DO $$
DECLARE tmpl_id UUID;
BEGIN
  SELECT id INTO tmpl_id FROM question_templates WHERE name = '콜드 리치아웃 효과' LIMIT 1;
  IF tmpl_id IS NOT NULL THEN
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=1;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=2;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=3;
    UPDATE template_questions SET question_type='scale', options='[]' WHERE template_id=tmpl_id AND question_order=4;
  END IF;
END $$;

-- =====================================================
-- 3. 신규 3개 템플릿 삽입 (중복 방지 체크 포함)
-- =====================================================

-- 3-1. 광고 소재 A/B (5문항)
DO $$
DECLARE tmpl_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM question_templates WHERE name = '광고 소재 A/B') THEN
    INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
    VALUES ('광고 소재 A/B', '●', '광고소재', '첫 3초 시선 집중력과 클릭 충동을 기준으로 두 소재를 비교합니다.', 0, true)
    RETURNING id INTO tmpl_id;

    INSERT INTO template_questions (template_id, question_text, question_type, options, question_order) VALUES
      (tmpl_id, '두 소재 중 첫 3초 안에 시선을 더 강력하게 끄는 것은 무엇입니까?', 'radio', '["A","B"]', 1),
      (tmpl_id, '선택한 소재가 귀하의 현재 필요(Needs)를 얼마나 잘 짚어냈습니까?', 'scale', '[]', 2),
      (tmpl_id, '선택한 소재에서 가장 매력적으로 느껴진 요소는 무엇입니까?', 'radio', '["카피라이팅","디자인/이미지","혜택/할인","신뢰성"]', 3),
      (tmpl_id, '''클릭해서 더 알아보기''를 누르고 싶은 충동이 더 큰 소재는 무엇입니까?', 'radio', '["A","B"]', 4),
      (tmpl_id, '선택한 소재가 상대방 소재보다 더 끌렸던 결정적인 이유를 한 문장으로 적어주세요.', 'text', '[]', 5);
  END IF;
END $$;

-- 3-2. 가격 페이지 검증 (5문항)
DO $$
DECLARE tmpl_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM question_templates WHERE name = '가격 페이지 검증') THEN
    INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
    VALUES ('가격 페이지 검증', '₩', '가격', '가격 대비 가치 인식과 구매 의향을 측정합니다.', 0, true)
    RETURNING id INTO tmpl_id;

    INSERT INTO template_questions (template_id, question_text, question_type, options, question_order) VALUES
      (tmpl_id, '제시된 가격 대비 제공되는 서비스 가치가 합리적이라고 생각하십니까?', 'scale', '[]', 1),
      (tmpl_id, '가격 페이지를 처음 보았을 때 가장 먼저 든 생각은 무엇입니까?', 'radio', '["예상보다 비싸다","합리적이다","예상보다 저렴하다","판단하기 어렵다"]', 2),
      (tmpl_id, '결제를 망설이게 만드는 가장 큰 요인은 무엇입니까?', 'radio', '["높은 가격 부담","불확실한 ROI","복잡한 요금제 구성","타사 대비 메리트 부족"]', 3),
      (tmpl_id, '현재 귀하의 비즈니스 상황에서 이 가격을 지불하고 도입할 의향이 있습니까?', 'scale', '[]', 4),
      (tmpl_id, '이 가격에 흔쾌히 결제하기 위해 반드시 추가되어야 할 기능이나 보장이 있다면 무엇입니까?', 'text', '[]', 5);
  END IF;
END $$;

-- 3-3. 콜드메일 효과 측정 (5문항)
DO $$
DECLARE tmpl_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM question_templates WHERE name = '콜드메일 효과 측정') THEN
    INSERT INTO question_templates (name, icon, category, description, use_count, is_default)
    VALUES ('콜드메일 효과 측정', '✉', '이메일', '이메일 Hook 강도와 전반적인 설득력을 측정합니다.', 0, true)
    RETURNING id INTO tmpl_id;

    INSERT INTO template_questions (template_id, question_text, question_type, options, question_order) VALUES
      (tmpl_id, '이메일의 첫 문단(Hook)이 귀하의 주의를 끄는 데 성공했습니까?', 'scale', '[]', 1),
      (tmpl_id, '이메일이 제안하는 핵심 가치가 귀하의 현재 업무 고민과 관련이 있습니까?', 'radio', '["매우 밀접함","약간 관련 있음","거의 없음","전혀 없음"]', 2),
      (tmpl_id, '이메일을 끝까지 읽고 난 후, 서비스에 대한 호기심이나 기대감이 생겼습니까?', 'scale', '[]', 3),
      (tmpl_id, '이메일 본문의 텍스트 분량은 읽기에 적당합니까?', 'radio', '["너무 길고 복잡하다","적당하다","너무 짧고 정보가 부족하다"]', 4),
      (tmpl_id, '이메일을 읽고 난 후, 가장 뇌리에 남는 단어나 문장 하나는 무엇입니까?', 'text', '[]', 5);
  END IF;
END $$;
