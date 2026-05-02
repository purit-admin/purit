export const QUESTION_TEMPLATES = {
  preference: [
    {
      id: 't-pref-1a',
      name: '광고 소재 A/B',
      category: '광고소재',
      description: '첫 3초 시선 집중력과 클릭 충동을 기준으로 두 소재를 비교합니다.',
      icon: '●',
      questions: [
        { id: 'p1a-q1', text: '두 소재 중 첫 3초 안에 시선을 더 강력하게 끄는 것은 무엇입니까?', type: 'radio', options: ['A', 'B'] },
        { id: 'p1a-q2', text: '선택한 소재가 귀하의 현재 필요(Needs)를 얼마나 잘 짚어냈습니까?', type: 'scale', options: [] },
        { id: 'p1a-q3', text: '선택한 소재에서 가장 매력적으로 느껴진 요소는 무엇입니까?', type: 'radio', options: ['카피라이팅', '디자인/이미지', '혜택/할인', '신뢰성'] },
        { id: 'p1a-q4', text: '두 소재 중 \'클릭해서 더 알아보기\'를 누르고 싶은 충동이 더 큰 것은 무엇입니까?', type: 'radio', options: ['A', 'B'] },
        { id: 'p1a-q5', text: '선택한 소재가 상대방 소재보다 더 끌렸던 결정적인 이유를 한 문장으로 적어주세요.', type: 'text', options: [] },
      ],
    },
    {
      id: 't-pref-1b',
      name: '첫인상 & 전환력',
      category: '광고소재',
      description: '핵심 가치 전달 속도와 전환 가능성을 측정합니다.',
      icon: '◎',
      questions: [
        { id: 'p1b-q1', text: '두 소재 중 어떤 것이 서비스의 \'핵심 가치\'를 더 빠르고 명확하게 전달합니까?', type: 'radio', options: ['A', 'B'] },
        { id: 'p1b-q2', text: '선택한 소재가 제공하는 정보나 혜택은 얼마나 신뢰할 수 있어 보입니까?', type: 'scale', options: [] },
        { id: 'p1b-q3', text: '이 소재를 보고 났을 때 가장 기대되는 결과는 무엇입니까?', type: 'radio', options: ['시간 단축', '비용 절감', '문제 해결', '트렌드 확보'] },
        { id: 'p1b-q4', text: '두 소재 중 실제 결제나 회원가입(전환)으로 이어질 확률이 더 높은 것은 무엇입니까?', type: 'radio', options: ['A', 'B'] },
        { id: 'p1b-q5', text: '선택하지 않은 소재에서 \'이 부분은 별로다\'라고 느껴진 치명적인 이탈 포인트를 적어주세요.', type: 'text', options: [] },
      ],
    },
    {
      id: 't-pref-1c',
      name: '메시지 공명 분석',
      category: '광고소재',
      description: '메시지가 타겟의 고민을 얼마나 날카롭게 찌르는지 분석합니다.',
      icon: '◆',
      questions: [
        { id: 'p1c-q1', text: '두 소재 중 귀하의 상황을 더 잘 이해하고 있다고 느껴지는 것은 무엇입니까?', type: 'radio', options: ['A', 'B'] },
        { id: 'p1c-q2', text: '메인 카피(문구)가 귀하의 평소 고민을 얼마나 날카롭게 찌르고 있습니까?', type: 'scale', options: [] },
        { id: 'p1c-q3', text: '메시지를 읽었을 때 드는 가장 강한 감정은 무엇입니까?', type: 'radio', options: ['궁금함', '강한 공감', '필요성 느낌', '무관심/거부감'] },
        { id: 'p1c-q4', text: '두 소재 중 지인이나 동료에게 추천할 만한 명분을 더 잘 제시한 것은 무엇입니까?', type: 'radio', options: ['A', 'B'] },
        { id: 'p1c-q5', text: '이 메시지가 귀하에게 더 깊게 와닿기 위해 반드시 추가되어야 할 정보가 있다면 무엇입니까?', type: 'text', options: [] },
      ],
    },
  ],

  pricing: [
    {
      id: 't-price-2a',
      name: '가격 페이지 검증',
      category: '가격',
      description: '가격 대비 가치 인식과 구매 의향을 측정합니다.',
      icon: '₩',
      questions: [
        { id: 'p2a-q1', text: '제시된 가격 대비 제공되는 서비스 가치가 합리적이라고 생각하십니까?', type: 'scale', options: [] },
        { id: 'p2a-q2', text: '가격 페이지를 처음 보았을 때 가장 먼저 든 생각은 무엇입니까?', type: 'radio', options: ['예상보다 비싸다', '합리적이다', '예상보다 저렴하다', '판단하기 어렵다'] },
        { id: 'p2a-q3', text: '결제를 망설이게 만드는 가장 큰 요인은 무엇입니까?', type: 'radio', options: ['높은 가격 부담', '불확실한 ROI', '복잡한 요금제 구성', '타사 대비 메리트 부족'] },
        { id: 'p2a-q4', text: '현재 귀하의 비즈니스 상황에서 이 가격을 지불하고 도입할 의향이 있습니까?', type: 'scale', options: [] },
        { id: 'p2a-q5', text: '이 가격에 흔쾌히 결제하기 위해 반드시 추가되어야 할 기능이나 보장이 있다면 무엇입니까?', type: 'text', options: [] },
      ],
    },
    {
      id: 't-price-2b',
      name: '가격 감지 테스트',
      category: '가격',
      description: '심리적 가격 저항선과 경쟁 대비 포지셔닝을 분석합니다.',
      icon: '◎',
      questions: [
        { id: 'p2b-q1', text: '제시된 가격을 보았을 때 귀하의 심리적 저항감은 어느 정도입니까?', type: 'radio', options: ['너무 비싸서 절대 안 산다', '비싸지만 고민해본다', '예산 범위 내에 있다', '너무 싸서 품질이 의심된다'] },
        { id: 'p2b-q2', text: '이 서비스의 경쟁사 대비 가격 경쟁력은 어떻습니까?', type: 'radio', options: ['매우 우수', '우수', '보통', '열위'] },
        { id: 'p2b-q3', text: '첫 달 할인이나 프로모션이 제공된다면 즉시 결제할 의향이 있습니까?', type: 'scale', options: [] },
        { id: 'p2b-q4', text: '가격을 결정짓는 가장 중요한 요소는 무엇이라고 생각하십니까?', type: 'radio', options: ['핵심 기능의 성능', '데이터 보안/안정성', '고객 지원 속도', '브랜드 신뢰도'] },
        { id: 'p2b-q5', text: '귀하가 생각하는 이 서비스의 \'적정 월구독료\'는 얼마이며, 그 이유는 무엇입니까?', type: 'text', options: [] },
      ],
    },
    {
      id: 't-price-2c',
      name: '플랜 비교 명확성',
      category: '가격',
      description: '요금제 간 차이가 직관적으로 이해되는지 측정합니다.',
      icon: '◈',
      questions: [
        { id: 'p2c-q1', text: '각 요금제 간의 기능 차이점이 명확하게 이해됩니까?', type: 'scale', options: [] },
        { id: 'p2c-q2', text: '귀하의 회사 규모에 가장 적합해 보이는 플랜은 무엇입니까?', type: 'radio', options: ['가장 저렴한 하위 플랜', '중간 플랜', '최상위 플랜', '결정하지 못함'] },
        { id: 'p2c-q3', text: '상위 플랜으로 업그레이드하고 싶게 만드는 가장 강력한 유인은 무엇입니까?', type: 'radio', options: ['핵심 기능 무제한 사용', '고급 분석/리포트 제공', '우선 지원 권한', '기타'] },
        { id: 'p2c-q4', text: '각 플랜의 명칭이 타겟 고객을 직관적으로 잘 설명하고 있습니까?', type: 'scale', options: [] },
        { id: 'p2c-q5', text: '요금제 비교 표를 보면서 가장 헷갈렸거나 이해하기 어려웠던 단어나 조건은 무엇입니까?', type: 'text', options: [] },
      ],
    },
  ],

  email: [
    {
      id: 't-email-3a',
      name: '콜드메일 효과 측정',
      category: '이메일',
      description: '이메일 Hook 강도와 전반적인 설득력을 측정합니다.',
      icon: '✉',
      questions: [
        { id: 'p3a-q1', text: '이메일의 첫 문단(Hook)이 귀하의 주의를 끄는 데 성공했습니까?', type: 'scale', options: [] },
        { id: 'p3a-q2', text: '이메일이 제안하는 핵심 가치가 귀하의 현재 업무 고민과 관련이 있습니까?', type: 'radio', options: ['매우 밀접함', '약간 관련 있음', '거의 없음', '전혀 없음'] },
        { id: 'p3a-q3', text: '이메일을 끝까지 읽고 난 후, 서비스에 대한 호기심이나 기대감이 생겼습니까?', type: 'scale', options: [] },
        { id: 'p3a-q4', text: '이메일 본문의 텍스트 분량은 읽기에 적당합니까?', type: 'radio', options: ['너무 길고 복잡하다', '적당하다', '너무 짧고 정보가 부족하다'] },
        { id: 'p3a-q5', text: '이메일을 읽고 난 후, 가장 뇌리에 남는 단어나 문장 하나는 무엇입니까?', type: 'text', options: [] },
      ],
    },
    {
      id: 't-email-3b',
      name: '개봉률 최적화',
      category: '이메일',
      description: '제목줄과 미리보기 텍스트의 클릭 유인력을 분석합니다.',
      icon: '◎',
      questions: [
        { id: 'p3b-q1', text: '수신함에서 이 제목을 보았을 때, 클릭해서 열어볼 확률은 어느 정도입니까?', type: 'radio', options: ['무조건 연다', '호기심에 열어본다', '나중에 본다', '스팸으로 무시한다'] },
        { id: 'p3b-q2', text: '제목이 본문의 핵심 내용을 과장 없이 명확하게 암시하고 있습니까?', type: 'scale', options: [] },
        { id: 'p3b-q3', text: '제목에서 가장 시선을 끄는 강력한 요소는 무엇입니까?', type: 'radio', options: ['구체적인 수치/데이터', '도발적인 질문', '직관적인 혜택 제시', '개인화'] },
        { id: 'p3b-q4', text: '미리보기 텍스트(첫 문장)가 제목과 논리적으로 이어지며 본문에 대한 기대감을 높입니까?', type: 'scale', options: [] },
        { id: 'p3b-q5', text: '스팸처럼 느껴지거나 클릭을 주저하게 만든 단어/표현이 있다면 무엇입니까?', type: 'text', options: [] },
      ],
    },
    {
      id: 't-email-3c',
      name: '콜드 리치아웃 효과',
      category: '이메일',
      description: '발신자 신뢰도와 CTA 명확성 및 답장 의향을 측정합니다.',
      icon: '◆',
      questions: [
        { id: 'p3c-q1', text: '이메일을 보낸 발신자에 대한 전문성과 신뢰감이 느껴집니까?', type: 'scale', options: [] },
        { id: 'p3c-q2', text: '메일에서 제안하는 오퍼(미팅, 웨비나 등)가 시간을 투자할 만큼 매력적입니까?', type: 'radio', options: ['매우 매력적이다', '평범하다', '전혀 매력적이지 않다'] },
        { id: 'p3c-q3', text: '마지막에 요구하는 행동(CTA)이 명확하고 부담스럽지 않습니까?', type: 'scale', options: [] },
        { id: 'p3c-q4', text: '실제로 이 이메일에 답장하거나 CTA 버튼을 클릭할 의향이 있습니까?', type: 'radio', options: ['예', '아니오'] },
        { id: 'p3c-q5', text: '답장이나 액션을 하지 않겠다고 결정했다면, 그 결정적인 방해 요소는 무엇입니까?', type: 'text', options: [] },
      ],
    },
  ],

  lp: [
    {
      id: 't-lp-4a',
      name: '첫인상 & 전환 신호',
      category: '랜딩페이지',
      description: '첫 화면의 즉각적인 이해도와 CTA 클릭 충동을 검증합니다.',
      icon: '◎',
      questions: [
        { id: 'lp4a-q1', text: '이 랜딩페이지의 핵심 가치가 5초 안에 명확하게 이해됩니까?', type: 'scale', options: [] },
        { id: 'lp4a-q2', text: '첫 화면을 보고 난 후 가장 먼저 드는 감정은 무엇입니까?', type: 'radio', options: ['신뢰감', '궁금함', '무관심', '혼란스러움'] },
        { id: 'lp4a-q3', text: '메인 CTA 버튼을 클릭하고 싶은 충동이 생겼습니까?', type: 'scale', options: [] },
        { id: 'lp4a-q4', text: '이 페이지에서 가장 시선을 끄는 요소는 무엇입니까?', type: 'radio', options: ['헤드라인 카피', '비주얼/이미지', 'CTA 버튼', '혜택 목록'] },
        { id: 'lp4a-q5', text: '첫인상에서 가장 거슬리거나 신뢰를 깎아먹는 요소가 있다면 무엇입니까?', type: 'text', options: [] },
      ],
    },
    {
      id: 't-lp-4b',
      name: '메시지 명확성 & 공감도',
      category: '랜딩페이지',
      description: '핵심 카피가 타겟의 고민을 정확히 짚는지 측정합니다.',
      icon: '◆',
      questions: [
        { id: 'lp4b-q1', text: '헤드라인 카피가 귀하의 현재 상황이나 고민을 얼마나 정확히 묘사합니까?', type: 'scale', options: [] },
        { id: 'lp4b-q2', text: '이 서비스가 해결해준다고 주장하는 문제가 귀하에게 실제로 해당됩니까?', type: 'radio', options: ['매우 해당됨', '약간 해당됨', '거의 해당 안 됨', '전혀 아님'] },
        { id: 'lp4b-q3', text: '페이지를 읽고 난 후 이 제품/서비스의 핵심 차별점이 분명히 느껴집니까?', type: 'scale', options: [] },
        { id: 'lp4b-q4', text: '페이지에서 가장 공감되었던 카피나 섹션은 무엇이었습니까?', type: 'text', options: [] },
        { id: 'lp4b-q5', text: '과장되거나 신뢰를 잃게 만드는 표현이 있었습니까?', type: 'radio', options: ['예, 분명히 느껴짐', '약간 그런 부분 있음', '아니오, 전혀 없음'] },
      ],
    },
    {
      id: 't-lp-4c',
      name: '신뢰 & 전환 저해 요인',
      category: '랜딩페이지',
      description: '소셜 프루프, 보증, 이탈 포인트를 분석합니다.',
      icon: '◈',
      questions: [
        { id: 'lp4c-q1', text: '후기, 수치, 로고 등 신뢰 요소가 구매 결정에 충분합니까?', type: 'scale', options: [] },
        { id: 'lp4c-q2', text: '가격, 환불 정책 등 결제 전 반드시 알아야 할 정보가 명확히 제시되어 있습니까?', type: 'radio', options: ['명확하다', '애매하다', '찾기 어렵다', '아예 없다'] },
        { id: 'lp4c-q3', text: '스크롤을 멈추고 이탈하고 싶어지게 만든 섹션이 있었습니까?', type: 'radio', options: ['예, 상단', '예, 중간', '예, 하단', '없었음'] },
        { id: 'lp4c-q4', text: '최종적으로 이 페이지에서 전환(가입/구매/문의)할 의향은 어느 정도입니까?', type: 'scale', options: [] },
        { id: 'lp4c-q5', text: '전환을 가로막는 가장 결정적인 장애 요소를 한 문장으로 적어주세요.', type: 'text', options: [] },
      ],
    },
  ],
};

export const TEMPLATE_BY_NAME = Object.fromEntries(
  Object.values(QUESTION_TEMPLATES).flat().map(t => [t.name, t])
);

export const TYPE_LABEL = { radio: '옵션형', scale: '점수형', text: '서술형' };
export const TYPE_COLOR = { radio: 'var(--blue)', scale: 'var(--accent)', text: 'var(--green)' };
