// Mock data store — replace with real API calls later

export const MISSIONS = [
  {
    id: 'm1',
    company: '어반핏 코리아',
    industry: '패션/커머스',
    product: '프리미엄 러닝화 LP',
    targetPersona: '35-45세 직장인 러너, 월 소득 500만 원 이상',
    reward: 45000,
    deadline: '2025-07-18',
    slots: 8,
    filled: 5,
    status: 'active',
    tags: ['랜딩페이지', '헤드라인 카피', 'CTA 분석'],
    briefUrl: '#',
    lpUrl: 'https://example.com',
    createdAt: '2025-07-10',
  },
  {
    id: 'm2',
    company: '뉴트리아 랩스',
    industry: '헬스/보충제',
    product: '단백질 보충제 구독 LP',
    targetPersona: '20-30대 헬스 입문자, 구독 서비스 경험자',
    reward: 38000,
    deadline: '2025-07-20',
    slots: 10,
    filled: 10,
    status: 'closed',
    tags: ['가격 앵커링', '후기 섹션', '구독 CTA'],
    briefUrl: '#',
    lpUrl: 'https://example.com',
    createdAt: '2025-07-08',
  },
  {
    id: 'm3',
    company: '핀테크베이스',
    industry: '금융/핀테크',
    product: '중소기업 법인카드 신청 LP',
    targetPersona: '3-50인 규모 법인 대표/CFO',
    reward: 80000,
    deadline: '2025-07-25',
    slots: 6,
    filled: 1,
    status: 'active',
    tags: ['신뢰 지표', 'B2B 카피', '폼 최적화'],
    briefUrl: '#',
    lpUrl: 'https://example.com',
    createdAt: '2025-07-12',
  },
];

export const FEEDBACKS = [
  {
    id: 'f1',
    missionId: 'm1',
    panelId: 'p1',
    panelName: '김서연',
    panelScore: 92,
    overallScore: 3,
    heatmapPoints: [
      { x: 45, y: 18, type: 'negative', label: '헤드라인이 너무 추상적' },
      { x: 70, y: 42, type: 'positive', label: '가격 제시 타이밍 좋음' },
      { x: 30, y: 68, type: 'negative', label: 'CTA 버튼 눈에 안 띔' },
    ],
    sections: {
      headline: { score: 2, comment: '러닝화 LP인데 "새로운 나를 만나다"는 너무 범용적. 실제 페이스 개선 수치나 소재 스펙으로 바꿔야 클릭률 올라감.' },
      social: { score: 4, comment: '리뷰 수 표기와 별점이 즉시 눈에 들어와서 신뢰감 줌. 다만 리뷰 원문 없이 요약만 있어 아쉬움.' },
      cta: { score: 2, comment: '"지금 구매하기" CTA가 스크롤 중간에 사라짐. 플로팅 CTA 필수. 배경색이 제품 이미지와 유사해 시인성 낮음.' },
      pricing: { score: 3, comment: '정가 대비 할인가 앵커링은 되어있으나, 경쟁 제품 대비 가성비 근거가 없음.' },
    },
    purityScore: 88,
    submittedAt: '2025-07-14 14:32',
    status: 'approved',
  },
  {
    id: 'f2',
    missionId: 'm1',
    panelId: 'p2',
    panelName: '이준혁',
    panelScore: 78,
    overallScore: 2,
    heatmapPoints: [
      { x: 50, y: 22, type: 'negative', label: '모바일에서 이미지 깨짐' },
      { x: 60, y: 55, type: 'negative', label: '스펙 설명 너무 기술적' },
    ],
    sections: {
      headline: { score: 2, comment: '타겟 페르소나(직장인 러너)가 공감할 구체적 상황 묘사 없음. "퇴근 후 5km"처럼 구체적인 맥락 필요.' },
      social: { score: 3, comment: '사용자 후기가 있긴 한데, 러너 프로필이 없어서 신뢰가 반감됨.' },
      cta: { score: 1, comment: 'CTA 위에 "지금 한정 수량" 텍스트가 있는데, 실제 재고 수가 안 보여서 오히려 불신 유발.' },
      pricing: { score: 2, comment: '할부 정보가 너무 작게 표기됨. 고관여 제품일수록 월 부담액 강조가 전환율 높임.' },
    },
    purityScore: 74,
    submittedAt: '2025-07-14 16:10',
    status: 'approved',
  },
];

export const PANELS = [
  { id: 'p1', name: '김서연', email: 'sy.kim@email.com', industry: '이커머스 마케터', experience: '7년', trustScore: 92, tier: 'EXPERT', completedMissions: 34, totalEarned: 1240000, joinedAt: '2024-02-10', status: 'active' },
  { id: 'p2', name: '이준혁', email: 'jh.lee@email.com', industry: 'B2B SaaS 세일즈', experience: '5년', trustScore: 78, tier: 'PRO', completedMissions: 19, totalEarned: 680000, joinedAt: '2024-05-22', status: 'active' },
  { id: 'p3', name: '박지민', email: 'jm.park@email.com', industry: '스타트업 PM', experience: '4년', trustScore: 85, tier: 'PRO', completedMissions: 27, totalEarned: 920000, joinedAt: '2024-03-15', status: 'active' },
];

export const COMPANY_PROJECTS = [
  { id: 'c1', missionId: 'm1', status: 'reviewing', feedbackCount: 2, maxFeedback: 8, avgScore: 2.5, spent: 360000 },
];

export const CURRENT_PANEL = PANELS[0];
export const CURRENT_COMPANY = { id: 'co1', name: '어반핏 코리아', plan: 'standard' };

// Helpers
export const getTierColor = (tier) => {
  if (tier === 'EXPERT') return 'tag-gold';
  if (tier === 'PRO') return 'tag-blue';
  return 'tag-gray';
};

export const getStatusColor = (status) => {
  if (status === 'active') return 'tag-green';
  if (status === 'closed') return 'tag-red';
  if (status === 'reviewing') return 'tag-gold';
  return 'tag-gray';
};
