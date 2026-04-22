-- ============================================================
-- PURIT — 시드 데이터 (목업 데이터를 실제 DB 데이터로 변환)
-- 001_all_tables.sql 실행 후 실행
-- ============================================================

-- GMV 스냅샷 (3월~7월 2025)
INSERT INTO gmv_snapshots (month_label, year, month_num, gmv, panel_pay, margin) VALUES
  ('3월', 2025, 3, 180, 108, 72),
  ('4월', 2025, 4, 240, 144, 96),
  ('5월', 2025, 5, 310, 186, 124),
  ('6월', 2025, 6, 420, 252, 168),
  ('7월', 2025, 7, 280, 168, 112)
ON CONFLICT DO NOTHING;

-- 정산 데이터 (panel_id는 실제 panels 테이블 연동 전 NULL 허용)
INSERT INTO settlements (panel_name, tier, missions_count, amount, status, due_date) VALUES
  ('김서연', 'EXPERT', 2, 83000, 'pending', '2025-07-20'),
  ('이준혁', 'PRO',    1, 38000, 'pending', '2025-07-20'),
  ('박지민', 'PRO',    3, 114000, 'paid',   '2025-07-13'),
  ('한소희', 'EXPERT', 4, 192000, 'paid',   '2025-07-10'),
  ('최민준', 'PRO',    1, 30000, 'rejected','2025-07-08')
ON CONFLICT DO NOTHING;

-- 청구서 데이터 (company_id는 실제 companies 테이블 연동 전 NULL 허용)
INSERT INTO invoices (company_name, plan, amount, status, invoice_date) VALUES
  ('어반핏 코리아', 'Pro',   1980000, 'paid',    '2025-07-01'),
  ('뉴트리아 랩스', 'Starter', 790000, 'paid',   '2025-07-01'),
  ('핀테크베이스',  '건당',   800000, 'pending', '2025-07-15')
ON CONFLICT DO NOTHING;

-- 기본 질문 템플릿 (5개 플랫폼 기본 제공)
INSERT INTO question_templates (name, icon, category, description, use_count, is_default) VALUES
  ('LP 전환 최적화', '◎', 'LP', '랜딩페이지 전환율을 높이기 위한 5차원 피드백 세트', 128, true),
  ('가격 페이지 검증', '₩', '가격', '가격 제시 방식·가치 지각·구매 장벽을 진단하는 질문 세트', 94, true),
  ('콜드메일 효과 측정', '✉', '이메일', '훅·명확성·호기심·관련성 4축으로 메일을 평가하는 질문 세트', 67, true),
  ('브랜드 포지셔닝', '◆', '브랜드', '브랜드 인지도·차별화·연상 이미지를 추적하는 질문 세트', 52, true),
  ('광고 소재 A/B', '▲', '광고', '두 소재의 훅·관련성·행동 유발력을 비교하는 질문 세트', 41, true)
ON CONFLICT DO NOTHING;

-- 질문 템플릿 세부 문항
DO $$
DECLARE
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid;
BEGIN
  SELECT id INTO t1 FROM question_templates WHERE name = 'LP 전환 최적화' LIMIT 1;
  SELECT id INTO t2 FROM question_templates WHERE name = '가격 페이지 검증' LIMIT 1;
  SELECT id INTO t3 FROM question_templates WHERE name = '콜드메일 효과 측정' LIMIT 1;
  SELECT id INTO t4 FROM question_templates WHERE name = '브랜드 포지셔닝' LIMIT 1;
  SELECT id INTO t5 FROM question_templates WHERE name = '광고 소재 A/B' LIMIT 1;

  IF t1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM template_questions WHERE template_id = t1) THEN
    INSERT INTO template_questions (template_id, question_text, question_order) VALUES
      (t1, '무엇을 파는지 3초 안에 이해할 수 있었나요?', 1),
      (t1, '이 제품이 나를 위한 것처럼 느껴졌나요?', 2),
      (t1, '가격 대비 가치가 충분하다고 느꼈나요?', 3),
      (t1, '다른 제품과 무엇이 다른지 알 수 있었나요?', 4),
      (t1, '이 브랜드를 신뢰할 수 있다고 느꼈나요?', 5);
  END IF;

  IF t2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM template_questions WHERE template_id = t2) THEN
    INSERT INTO template_questions (template_id, question_text, question_order) VALUES
      (t2, '가격이 명확하게 표시되어 있었나요?', 1),
      (t2, '가격 대비 얻을 수 있는 가치가 분명했나요?', 2),
      (t2, '구매를 망설이게 만드는 요소가 있었나요?', 3),
      (t2, '경쟁사 대비 가격이 합리적으로 느껴졌나요?', 4);
  END IF;

  IF t3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM template_questions WHERE template_id = t3) THEN
    INSERT INTO template_questions (template_id, question_text, question_order) VALUES
      (t3, '첫 문장이 계속 읽고 싶게 만들었나요?', 1),
      (t3, '제안 내용이 명확하게 이해됐나요?', 2),
      (t3, '더 알고 싶다는 호기심이 생겼나요?', 3),
      (t3, '내 상황과 관련있는 내용이었나요?', 4);
  END IF;

  IF t4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM template_questions WHERE template_id = t4) THEN
    INSERT INTO template_questions (template_id, question_text, question_order) VALUES
      (t4, '이 브랜드를 이전에 알고 있었나요?', 1),
      (t4, '브랜드 메시지가 명확하게 전달됐나요?', 2),
      (t4, '이 브랜드만의 차별점이 느껴졌나요?', 3),
      (t4, '이 브랜드를 추천할 의향이 있나요? (1-10)', 4);
  END IF;

  IF t5 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM template_questions WHERE template_id = t5) THEN
    INSERT INTO template_questions (template_id, question_text, question_order) VALUES
      (t5, '어떤 소재가 더 눈길을 끌었나요? (A/B)', 1),
      (t5, '선택한 이유를 간략히 적어주세요', 2),
      (t5, '어떤 소재가 더 클릭하고 싶었나요?', 3);
  END IF;
END $$;
