/**
 * 5개 메인 의뢰 생성 + panel1~10 피드백 50개 자동 제출
 * purit.admin@gmail.com 기업 계정 대상
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'node:crypto';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 누락'); process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 5개 의뢰 데이터 ─────────────────────────────────────────────────────────────

const MISSIONS_DATA = [
  {
    title: 'ActivePulse 스마트워치 랜딩페이지 전환율 검증',
    product: 'ActivePulse',
    lpUrl: 'https://activepulse.io',
    industry: '헬스/피트니스',
    personaAge: '25~40세',
    personaIncome: '월 350~600만원',
    personaRole: '운동을 즐기는 직장인 / 헬스 & 러닝 유저',
    personaContext: '웨어러블 기기에 관심이 많고 건강 데이터를 일상에서 활용하고 싶은 액티브 소비자',
    briefText: 'ActivePulse는 심박·산소포화도·수면질을 정밀 측정하는 스마트워치입니다. 이번 검증에서는 ①기능 전달력, ②타겟 공감도, ③가격 정당성, ④브랜드 신뢰도가 실제 구매 의향에 얼마나 영향을 주는지 확인합니다.',
    focusAreas: ['첫인상 / 가독성', 'CTA 전환율', '가격 및 가치 전달', '신뢰 요소', '타겟 일치도'],
    bgColors: ['#1a1a2e', '#16213e', '#0f3460'],
    imgLabels: ['히어로 — 기기 퍼포먼스', '기능 스펙 비교', '구매 CTA + 보증'],
    selectedQuestions: [
      { id: 'ap-q1', text: '이 스마트워치의 핵심 기능이 5초 안에 명확히 파악됩니까?', type: 'scale', options: [] },
      { id: 'ap-q2', text: '첫 화면을 보고 난 후 가장 먼저 드는 인상은 무엇입니까?', type: 'radio', options: ['고급스럽다', '기능적이다', '평범하다', '복잡하다'] },
      { id: 'ap-q3', text: '이 제품을 구매할 의향은 어느 정도입니까?', type: 'scale', options: [] },
      { id: 'ap-q4', text: '구매를 망설이게 하는 가장 큰 요인을 한 문장으로 적어주세요.', type: 'text', options: [] },
    ],
    overallHigh: [
      '기기 스펙이 시각적으로 잘 전달되어 "이 가격이 왜 합리적인가"에 대한 답이 명확합니다. 30일 무상 반품 정책을 CTA 근처로 이동하면 전환율이 더 올라갈 것으로 예상합니다.',
      '피트니스 유저의 실제 사용 시나리오(러닝 중 심박 모니터링, 수면 분석)가 잘 표현되어 있어 공감도가 높습니다. 실사용자 비포/애프터 데이터를 추가하면 구매 확신을 높일 수 있습니다.',
      '경쟁 제품 대비 배터리 수명과 정확도 비교표가 강력한 차별화 근거가 됩니다. 전문 운동선수 추천 배지가 신뢰를 크게 높입니다.',
    ],
    overallMid: [
      '기능 설명은 충분하나 일상 사용자 관점보다 스펙 중심 서술이 많아 비전문가에게 와닿지 않는 부분이 있습니다. 사용 시나리오를 좀 더 일상적으로 표현해주면 좋겠습니다.',
      '디자인은 세련됐으나 경쟁사 대비 이 제품만의 결정적 차이점이 명확하게 드러나지 않습니다. 핵심 USP를 히어로 섹션에 더 강조하면 좋겠습니다.',
    ],
    overallLow: [
      '전반적으로 기본적인 제품 소개는 이루어지고 있습니다. 스마트워치 랜딩으로서 무난한 구성이라 판단됩니다.',
    ],
  },
  {
    title: 'GreenProtein 식물성 단백질 보충제 구매 전환 최적화',
    product: 'GreenProtein',
    lpUrl: 'https://greenprotein.kr',
    industry: '식품/건강기능식품',
    personaAge: '20~35세',
    personaIncome: '월 250~450만원',
    personaRole: '비건·플렉시테리언 / 운동 병행 직장인·대학생',
    personaContext: '건강하고 지속 가능한 라이프스타일을 추구하며 성분 투명성을 중시하는 소비자',
    briefText: 'GreenProtein은 완두·대두·브라운라이스 3종 혼합 식물성 단백질 보충제입니다. 이번 검증에서는 ①성분 신뢰도 전달, ②맛·식감에 대한 불안 해소, ③가성비 인식, ④타겟(비건/운동러) 공감도를 확인합니다.',
    focusAreas: ['핵심 메시지 명확성', '신뢰 요소', '가격 및 가치 전달', '타겟 일치도', '비주얼 완성도'],
    bgColors: ['#1b4332', '#2d6a4f', '#40916c'],
    imgLabels: ['히어로 — 성분 강조', '영양 성분표 비교', '구매 CTA + 후기'],
    selectedQuestions: [
      { id: 'gp-q1', text: '이 제품의 핵심 성분 특징이 첫눈에 이해됩니까?', type: 'scale', options: [] },
      { id: 'gp-q2', text: '식물성 단백질 맛·식감에 대한 불안이 이 페이지에서 해소됩니까?', type: 'scale', options: [] },
      { id: 'gp-q3', text: '동물성 단백질 대비 이 제품을 선택하고 싶은 이유가 명확합니까?', type: 'radio', options: ['성분 투명성', '환경적 가치', '맛과 식감', '가성비', '잘 모르겠다'] },
      { id: 'gp-q4', text: '구매를 결정하기 전 추가로 알고 싶은 정보를 적어주세요.', type: 'text', options: [] },
    ],
    overallHigh: [
      '비건 소비자의 가장 큰 우려(맛, 단백질 완결성)를 정면으로 해소하는 콘텐츠 구성이 인상적입니다. "30일 만족 보장"과 체험 후기가 첫 구매 장벽을 효과적으로 낮춥니다.',
      '전성분 공개와 제3자 인증 배지가 성분 투명성을 강력히 어필합니다. 타 식물성 단백질 대비 아미노산 프로파일 비교표가 전문성을 높입니다.',
      '환경 임팩트 데이터(CO₂ 절감량)가 가치 소비 트렌드와 정확히 맞아 공감도를 높입니다.',
    ],
    overallMid: [
      '성분 구성은 좋으나 맛과 식감에 대한 불안을 해소하는 콘텐츠가 부족합니다. 실사용자 리뷰에서 맛 관련 후기를 더 부각시키면 좋겠습니다.',
      '비건 타겟을 어느 정도 겨냥하고 있으나, 일반 운동인 대상 메시지와 혼재되어 포커스가 분산됩니다.',
    ],
    overallLow: [
      '식물성 단백질 보충제 소개 페이지로서 기본 구성은 갖추고 있습니다. 전반적으로 평이한 수준입니다.',
    ],
  },
  {
    title: 'PeoplePilot HR SaaS 랜딩페이지 리드 전환 최적화',
    product: 'PeoplePilot',
    lpUrl: 'https://peoplepilot.io',
    industry: 'SaaS/소프트웨어',
    personaAge: '30~45세',
    personaIncome: '월 500~900만원',
    personaRole: 'HR 담당자 / 스타트업 대표 / 피플팀 리드',
    personaContext: '인사관리 자동화와 데이터 기반 조직 운영에 관심이 많은 실무 의사결정자',
    briefText: 'PeoplePilot은 채용·온보딩·성과관리·급여를 하나의 플랫폼에서 처리하는 HR SaaS입니다. 이번 검증에서는 ①가치 제안 명확성, ②ROI 납득성, ③경쟁사 대비 차별점, ④무료체험 CTA 전환 의향을 확인합니다.',
    focusAreas: ['첫인상 / 가독성', 'CTA 전환율', '핵심 메시지 명확성', '가격 및 가치 전달', '신뢰 요소'],
    bgColors: ['#1e3a5f', '#2b4f8a', '#3a6abf'],
    imgLabels: ['히어로 — 대시보드 목업', '기능 비교 매트릭스', '무료체험 CTA + 고객사'],
    selectedQuestions: [
      { id: 'pp-q1', text: '이 솔루션이 우리 회사 HR 업무에 실질적으로 도움이 될 것 같습니까?', type: 'scale', options: [] },
      { id: 'pp-q2', text: '경쟁 HR 도구(Workday, 그리팅 등) 대비 차별점이 명확히 전달됩니까?', type: 'scale', options: [] },
      { id: 'pp-q3', text: '"무료 14일 체험" CTA를 클릭할 의향이 있습니까?', type: 'radio', options: ['바로 클릭하겠다', '더 알아본 후 클릭하겠다', '잘 모르겠다', '클릭하지 않겠다'] },
      { id: 'pp-q4', text: '도입 결정에 앞서 가장 확인하고 싶은 정보는 무엇입니까?', type: 'text', options: [] },
    ],
    overallHigh: [
      '대시보드 목업이 실제 업무 효율화를 직관적으로 보여주어 구매 의향을 높입니다. G2·Capterra 별점과 사용 기업 로고가 신뢰를 효과적으로 구축합니다.',
      '"HR 담당자 1인이 100명 회사를 관리"하는 구체적 사용 시나리오가 ROI를 명확히 전달합니다. 14일 무료체험 CTA가 도입 장벽을 효과적으로 낮춥니다.',
      '기능 비교표에서 경쟁사 대비 우위가 명확해 의사결정을 돕습니다. 고객 사례(케이스 스터디)가 신뢰도를 크게 높입니다.',
    ],
    overallMid: [
      'HR SaaS 기능 설명은 충분하나 실제 도입 시 예상 ROI(시간 절감, 비용 절감)가 수치로 제시되면 더 설득력이 있을 것 같습니다.',
      '무료체험 CTA는 있으나 구현 난이도나 마이그레이션 과정에 대한 우려를 해소하는 콘텐츠가 부족합니다.',
    ],
    overallLow: [
      'HR SaaS 소개 페이지로서 기본적인 구성은 갖추고 있습니다. 전반적으로 무난한 랜딩페이지라 판단됩니다.',
    ],
  },
  {
    title: 'GreenHome 친환경 리빙 브랜드 랜딩페이지 브랜드 공감도 검증',
    product: 'GreenHome',
    lpUrl: 'https://greenhome.kr',
    industry: '라이프스타일/홈리빙',
    personaAge: '22~38세',
    personaIncome: '월 250~500만원',
    personaRole: 'MZ세대 가치소비 지향 / 환경 관심 1-2인 가구',
    personaContext: '플라스틱 프리, 제로웨이스트 라이프스타일에 관심 있으며 제품 구매 시 환경 영향을 고려하는 소비자',
    briefText: 'GreenHome은 바이오 플라스틱·천연 소재로 만든 친환경 주방·욕실 용품 브랜드입니다. 이번 검증에서는 ①브랜드 가치 전달, ②친환경 인증 신뢰도, ③프리미엄 가격 정당성, ④지속가능성 메시지 공감도를 확인합니다.',
    focusAreas: ['비주얼 완성도', '핵심 메시지 명확성', '신뢰 요소', '가격 및 가치 전달', '타겟 일치도'],
    bgColors: ['#386641', '#6a994e', '#a7c957'],
    imgLabels: ['히어로 — 제품 라이프스타일', '소재 원산지 스토리', '구매 CTA + 환경 임팩트'],
    selectedQuestions: [
      { id: 'gh-q1', text: '이 브랜드의 친환경 가치가 진정성 있게 전달됩니까?', type: 'scale', options: [] },
      { id: 'gh-q2', text: '일반 제품 대비 높은 가격이 납득됩니까?', type: 'scale', options: [] },
      { id: 'gh-q3', text: '이 브랜드에 대해 가장 먼저 드는 인상은 무엇입니까?', type: 'radio', options: ['진정성 있다', '트렌디하다', '비싸다', '평범하다'] },
      { id: 'gh-q4', text: '구매 전 추가로 확인하고 싶은 환경 관련 정보를 적어주세요.', type: 'text', options: [] },
    ],
    overallHigh: [
      '천연 소재 원산지 스토리와 투명한 탄소 발자국 데이터가 브랜드 진정성을 강력히 뒷받침합니다. 비슷한 가격대 경쟁 브랜드 대비 인증 마크 수가 눈에 띕니다.',
      '"매 구매마다 나무 한 그루 심기" 임팩트 시각화가 가치 소비 욕구를 자극합니다. 패키지 재활용 안내가 브랜드 일관성을 높입니다.',
      '제품 라이프사이클(생산→사용→재활용) 인포그래픽이 친환경 가치를 설득력 있게 전달합니다.',
    ],
    overallMid: [
      '친환경 가치는 있으나 "왜 이 가격이 합리적인가"에 대한 근거가 부족합니다. 제조 원가 투명성이나 소재 프리미엄 설명을 보강하면 좋겠습니다.',
      '비주얼은 깔끔하나 친환경 트렌드에 편승한 그린워싱이 아니라는 신뢰 증거가 더 필요합니다.',
    ],
    overallLow: [
      '친환경 리빙 브랜드 소개로서 기본 정보는 담겨있습니다. 전반적으로 무난한 구성이라 판단됩니다.',
    ],
  },
  {
    title: 'WealthBot AI 자산관리 앱 랜딩페이지 신뢰도 및 전환 검증',
    product: 'WealthBot',
    lpUrl: 'https://wealthbot.kr',
    industry: '핀테크/금융',
    personaAge: '25~42세',
    personaIncome: '월 350~700만원',
    personaRole: '재테크 관심 직장인 / 사회초년생 투자자',
    personaContext: 'ETF·적금·부동산 투자를 병행하며 자산 분산 관리에 어려움을 느끼는 직장인 투자자',
    briefText: 'WealthBot은 AI가 개인 자산을 분석해 리밸런싱 시점과 포트폴리오를 자동으로 제안하는 핀테크 앱입니다. 이번 검증에서는 ①AI 신뢰도 전달, ②보안·안정성 불안 해소, ③기대 수익 명확성, ④무료체험 전환 의향을 확인합니다.',
    focusAreas: ['신뢰 요소', '핵심 메시지 명확성', '가격 및 가치 전달', 'CTA 전환율', '모바일 최적화'],
    bgColors: ['#1a1a2e', '#0d253f', '#1b4977'],
    imgLabels: ['히어로 — AI 포트폴리오 대시보드', '수익률 시뮬레이션', '무료체험 CTA + 보안 인증'],
    selectedQuestions: [
      { id: 'wb-q1', text: 'AI 자산관리 알고리즘에 대한 신뢰감이 전달됩니까?', type: 'scale', options: [] },
      { id: 'wb-q2', text: '내 자산 정보 연동에 대한 보안 불안이 이 페이지에서 해소됩니까?', type: 'scale', options: [] },
      { id: 'wb-q3', text: '이 앱을 사용해보고 싶다면 가장 큰 이유는 무엇입니까?', type: 'radio', options: ['편리한 자산 통합 관리', 'AI 리밸런싱 자동화', '수수료 절감', '투자 초보자 지원', '관심 없다'] },
      { id: 'wb-q4', text: '앱 가입 전 꼭 확인하고 싶은 보안 또는 수익 관련 정보를 적어주세요.', type: 'text', options: [] },
    ],
    overallHigh: [
      'AI 포트폴리오 시뮬레이션 결과를 실제 수익률 데이터로 보여주는 것이 신뢰의 핵심 포인트입니다. 금융위원회 등록 및 ISMS 인증 배지가 보안 불안을 효과적으로 해소합니다.',
      '"3분 연동, 자동 리밸런싱" 단순화가 복잡한 투자 과정에 부담을 느끼는 타겟에게 강하게 어필합니다. 평균 수익률 비교(일반 적금 vs WealthBot)가 가치를 명확히 전달합니다.',
      '투자 초보자를 위한 가이드 콘텐츠가 진입 장벽을 낮추며, 실사용자 포트폴리오 공개가 강력한 사회적 증거가 됩니다.',
    ],
    overallMid: [
      'AI 알고리즘에 대한 설명이 있으나 "블랙박스" 느낌을 해소하는 구체적 근거가 부족합니다. 의사결정 기준을 좀 더 투명하게 공개하면 신뢰도가 오를 것 같습니다.',
      '수익률 데이터가 있으나 시뮬레이션인지 실제 운용 결과인지 구분이 불명확해 신뢰에 의구심이 생깁니다.',
    ],
    overallLow: [
      '핀테크 앱 소개 랜딩으로서 기본적인 구성은 갖추고 있습니다. 전반적으로 무난한 페이지라 판단됩니다.',
    ],
  },
];

// ── 공통 지표별 코멘트 풀 ──────────────────────────────────────────────────────

const COMMENTS = {
  clarity: {
    high: [
      '히어로 섹션에서 핵심 가치가 5초 안에 즉각적으로 전달됩니다. 서브헤드라인이 메인 카피를 효과적으로 보완합니다.',
      'CTA 버튼 주변에 배치된 가격·혜택 정보가 클릭 결정을 돕는 구조로 잘 설계되어 있습니다.',
      '3단계 사용 흐름 시각화가 복잡한 프로세스를 한눈에 이해하게 해주어 진입 장벽을 낮춥니다.',
      '섹션별 정보 위계가 명확해 사용자가 원하는 정보를 쉽게 탐색할 수 있습니다.',
    ],
    mid: [
      '핵심 메시지는 있으나 전문 용어가 많아 처음 접하는 사용자에게 이해하기 어려운 부분이 있습니다.',
      '브랜드 스토리와 제품 설명이 혼재되어 있어 집중해야 할 메시지가 분산됩니다.',
      'CTA는 있으나 직전 섹션과의 연결이 약해 "왜 지금 행동해야 하는가"의 설득이 약합니다.',
      '정보량이 많아 스캔독자가 핵심을 빠르게 파악하기 어려운 구조입니다.',
    ],
    low: [
      '첫 화면에서 이 제품이 정확히 무엇을 하는지 즉각 파악하기 어렵습니다.',
      '다양한 정보가 나열되어 있지만 무엇이 핵심인지 판단하기 어렵습니다.',
      '콘텐츠 흐름이 명확하지 않아 구매 결정까지의 여정이 불분명합니다.',
      '헤드라인과 서브카피의 연관성이 낮아 메시지 일관성이 부족합니다.',
    ],
  },
  relevance: {
    high: [
      '타겟 페르소나의 핵심 고민을 정확히 짚는 언어를 사용해 "내 이야기다"라는 공감대를 형성합니다.',
      '타겟이 일상에서 겪는 구체적 상황을 시각화해 몰입도를 높입니다.',
      '연령·라이프스타일에 맞는 사용 시나리오가 타겟 세분화를 효과적으로 구현합니다.',
      '타겟 언어와 통증 포인트 표현이 정확해 "이 브랜드가 나를 이해하고 있다"는 느낌을 줍니다.',
    ],
    mid: [
      '타겟 방향성은 있으나 더 세밀한 페르소나 세분화가 필요해 보입니다.',
      '이미지와 카피가 타겟에 어느 정도 맞지만 더 구체적인 사용 상황 묘사가 있으면 좋겠습니다.',
      '전반적으로 타겟 느낌은 있으나 특정 타겟을 강하게 겨냥하는 설득이 부족합니다.',
      '타겟 고민 표현이 다소 일반적이어서 강한 공감대 형성이 어렵습니다.',
    ],
    low: [
      '모든 사람을 대상으로 한 것처럼 느껴져 "나를 위한 제품"이라는 느낌이 약합니다.',
      '타겟 세분화 없이 광범위한 소비자를 겨냥해 누구에게도 강하게 어필하지 못합니다.',
      '사용 이미지와 카피가 타겟 페르소나와 거리가 있어 공감도가 낮습니다.',
      '타겟 고민 언어가 거의 없어 방문자가 "이게 나에게 맞는 제품인가"를 판단하기 어렵습니다.',
    ],
  },
  value: {
    high: [
      '구체적 수치 데이터(개선율, 절감액)가 제시되어 가격 대비 가치 납득이 쉽습니다.',
      '경쟁 제품 대비 비교표가 이 제품을 선택해야 하는 이유를 명확히 전달합니다.',
      '번들 혜택과 첫 구매 인센티브 조합이 도입 장벽을 효과적으로 낮춥니다.',
      '장기 사용 시 절감 금액을 시각화해 초기 비용에 대한 부담감을 해소합니다.',
    ],
    mid: [
      '가격은 표시되어 있으나 그 가격이 합리적인 이유에 대한 근거가 부족합니다.',
      '혜택 목록이 있으나 정량적 근거가 없어 체감 가치가 낮습니다.',
      '번들 옵션은 있으나 단품 대비 절약분이 직관적으로 보이지 않습니다.',
      '프리미엄 가격대임에도 이를 정당화할 차별화 데이터가 충분하지 않습니다.',
    ],
    low: [
      '가격 정보가 눈에 잘 띄지 않아 구매 결정 전 이탈이 많을 것 같습니다.',
      '효능/가치 주장만 있고 이를 뒷받침하는 근거 데이터가 없어 납득이 어렵습니다.',
      '타 제품 대비 가성비 포인트가 불명확해 구매 결정이 어렵습니다.',
      '혜택 설명이 추상적이어서 실제로 얼마나 도움이 될지 체감하기 어렵습니다.',
    ],
  },
  differentiation: {
    high: [
      '독자적 기술·특허·인증이 경쟁 제품과의 명확한 차별화 근거로 작동합니다.',
      '업계 최초·유일 포지셔닝이 구체적 근거와 함께 제시되어 설득력이 있습니다.',
      '경쟁사 대비 3가지 핵심 우위를 비교표로 보여주어 선택의 기준을 제공합니다.',
      '고유한 브랜드 철학과 스토리가 단순 제품 이상의 차별화를 만들어냅니다.',
    ],
    mid: [
      '브랜드만의 특색이 있으나 유사 제품들과의 차이점이 더 명확히 전달되어야 합니다.',
      '차별화 포인트는 언급되나 경쟁사 대비 직접적 비교 없이는 우위를 판단하기 어렵습니다.',
      '업계 트렌드를 반영하고 있으나 이 브랜드만의 고유한 기술이나 철학이 잘 보이지 않습니다.',
      '차별화 주장이 있으나 구체적 검증 기관이나 데이터가 없어 설득력이 제한적입니다.',
    ],
    low: [
      '경쟁 제품들과 거의 유사한 클레임을 하고 있어 차별점이 느껴지지 않습니다.',
      '일반적인 마케팅 문구만 사용되어 브랜드 고유 가치가 전달되지 않습니다.',
      '브랜드 고유 기술이나 특허에 대한 언급이 없어 평범한 제품으로 느껴집니다.',
      '수많은 유사 제품들 사이에서 "이것을 선택해야 하는 이유"가 불분명합니다.',
    ],
  },
  trust: {
    high: [
      '실제 사용자 후기와 정량적 결과 데이터가 강력한 사회적 증거를 만들어줍니다.',
      '공신력 있는 기관의 인증·수상 배지가 브랜드 신뢰를 효과적으로 구축합니다.',
      '환불 보장 정책이 구매 리스크를 제거해 첫 구매 결정을 돕습니다.',
      '투명한 정보 공개(성분·제조·원산지 등)가 브랜드에 대한 신뢰를 높입니다.',
    ],
    mid: [
      '후기가 있으나 구체성이 부족해 신뢰도가 상대적으로 낮습니다.',
      '인증 배지가 있으나 어느 기관의 것인지 명시되지 않아 신뢰도가 제한적입니다.',
      '브랜드 히스토리는 있으나 창업 철학이 진정성 있게 전달되지 않습니다.',
      '환불 정책이 있으나 눈에 잘 띄지 않아 구매 결정 시 불안감이 남습니다.',
    ],
    low: [
      '실제 사용자 후기나 검증 데이터가 없어 효능 주장을 믿기 어렵습니다.',
      '브랜드 신뢰 신호(인증, 수상, 언론)가 없어 처음 방문자에게 불안감을 줍니다.',
      '고객 지원 채널이 눈에 띄지 않아 구매 후 문제 발생 시 대응이 걱정됩니다.',
      '모든 클레임이 검증 없이 나열되어 있어 "과대광고 아닌가"라는 의심이 생깁니다.',
    ],
  },
};

const DIM_LABELS = { clarity: '명확성', relevance: '관련성', value: '가치', differentiation: '차별화', trust: '신뢰' };
const DIMENSIONS = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];

const SCALE_ANSWERS_POOL = [
  [2,3,2,3,2], [4,5,4,4,3], [3,3,4,3,3], [5,4,5,4,5],
  [3,4,3,4,4], [2,3,3,2,3], [4,4,3,4,4], [3,3,3,3,4],
  [5,5,4,5,4], [4,3,4,3,5],
];

const TEXT_ANSWERS_POOL = [
  '실제 사용 사례나 케이스 스터디가 더 있으면 도입 결정에 도움이 될 것 같습니다.',
  '경쟁 제품 대비 비교 정보가 있으면 선택 판단에 도움이 됩니다.',
  '무료 체험 또는 샘플 기회가 있으면 부담 없이 시작할 수 있을 것 같습니다.',
  '가격 구조가 좀 더 명확하게 안내되면 좋겠습니다.',
  '보안 및 개인정보 보호 정책을 더 상세히 안내해주면 신뢰가 생깁니다.',
  '도입 후 온보딩 지원 프로세스가 구체적으로 안내되면 좋겠습니다.',
  '전문가 또는 기관 추천 근거가 더 구체적으로 제시되면 신뢰도가 높아질 것 같습니다.',
  '실제 고객사의 전후 비교 데이터가 있으면 효과를 더 잘 납득할 수 있습니다.',
  '자주 묻는 질문(FAQ) 섹션이 있으면 구매 전 궁금증 해소에 도움이 됩니다.',
  '해지 및 환불 조건이 명확하게 명시되면 리스크 없이 시작할 수 있을 것 같습니다.',
];

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }
function randomBox() {
  const x = randFloat(5, 55), y = randFloat(5, 55);
  const w = randFloat(15, 35), h = randFloat(10, 25);
  return { x_pct: x, y_pct: y, w_pct: Math.min(w, 93 - x), h_pct: Math.min(h, 93 - y) };
}

const QUALITY_TIERS = ['low', 'mid', 'high'];
function randomQuality() { return QUALITY_TIERS[Math.floor(Math.random() * QUALITY_TIERS.length)]; }

function pickDimScore(quality, k) {
  if (quality === 'low')  return randInt(2, 3);
  if (quality === 'high') return randInt(3, 5);
  return k % 2 === 0 ? randInt(2, 3) : randInt(3, 4);
}

function pickComment(dim, score) {
  const bucket = score >= 4 ? 'high' : score >= 3 ? 'mid' : 'low';
  return randItem(COMMENTS[dim][bucket]);
}

function pickOverall(missionData, quality, idx) {
  if (quality === 'low')  return randItem(missionData.overallLow);
  if (quality === 'high') return randItem(missionData.overallHigh);
  return randItem(missionData.overallMid);
}

function generateCustomAnswer(question, panelIdx, qIdx) {
  const type = question.type || 'text';
  if (type === 'scale') {
    const row = SCALE_ANSWERS_POOL[panelIdx % SCALE_ANSWERS_POOL.length];
    return String(row[qIdx % row.length]);
  }
  if (type === 'radio') {
    const opts = question.options || [];
    return opts.length > 0 ? opts[panelIdx % opts.length] : '해당 없음';
  }
  return TEXT_ANSWERS_POOL[panelIdx % TEXT_ANSWERS_POOL.length];
}

function makeSvgBuffer(label, product, bgColor) {
  const w = 1200, h = 800;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${bgColor}"/>
  <rect x="60" y="60" width="${w-120}" height="${h-120}" rx="16" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <text x="${w/2}" y="${h*0.35}" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="white" text-anchor="middle">${product}</text>
  <text x="${w/2}" y="${h*0.47}" font-family="Arial,sans-serif" font-size="22" fill="rgba(255,255,255,0.75)" text-anchor="middle">${label}</text>
  <rect x="${w/2-110}" y="${h*0.57}" width="220" height="48" rx="24" fill="white"/>
  <text x="${w/2}" y="${h*0.57+30}" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="${bgColor}" text-anchor="middle">시작하기 →</text>
  <text x="${w/2}" y="${h*0.84}" font-family="Arial,sans-serif" font-size="14" fill="rgba(255,255,255,0.4)" text-anchor="middle">TEST IMAGE — PURIT QA ASSET</text>
</svg>`;
  return Buffer.from(svg);
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== 5개 메인 의뢰 생성 + panel1~10 피드백 50개 제출 ===\n');

  // 1. 어드민 유저 → company 레코드
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 조회 실패:', uErr.message); process.exit(1); }

  const adminUser = users.find(u => u.email === 'purit.admin@gmail.com');
  if (!adminUser) { console.error('❌ purit.admin@gmail.com 없음'); process.exit(1); }

  const { data: company, error: cErr } = await supabase
    .from('companies').select('id, name, plan').eq('user_id', adminUser.id).single();
  if (cErr || !company) { console.error('❌ company 레코드 없음:', cErr?.message); process.exit(1); }
  console.log(`✅ 기업: ${company.name || '(unnamed)'} (id: ${company.id})\n`);

  // 2. panel1~10 유저 조회
  const panelUsers = users
    .filter(u => /^panel(10|[1-9])@purit\.io$/.test(u.email || ''))
    .sort((a, b) => {
      const na = parseInt(a.email.match(/\d+/)[0], 10);
      const nb = parseInt(b.email.match(/\d+/)[0], 10);
      return na - nb;
    });

  console.log(`✅ panel1~10 계정 ${panelUsers.length}개 확인`);

  const { data: panelRecords, error: pErr } = await supabase
    .from('panels').select('id, user_id, name, honor_points, experience')
    .in('user_id', panelUsers.map(u => u.id));
  if (pErr) { console.error('panels 조회 오류:', pErr.message); process.exit(1); }

  const panelByUserId = {};
  panelRecords.forEach(p => { panelByUserId[p.user_id] = p; });
  console.log(`   panels 레코드 ${panelRecords.length}개 매핑\n`);

  let totalFeedbacks = 0;

  // 3. 의뢰별 처리
  for (let mi = 0; mi < MISSIONS_DATA.length; mi++) {
    const md = MISSIONS_DATA[mi];
    console.log(`${'━'.repeat(60)}`);
    console.log(`[의뢰 ${mi + 1}/5] ${md.title}`);
    console.log(`${'━'.repeat(60)}`);

    // 3a. SVG 이미지 업로드
    const missionUuid = randomUUID();
    const imageUrls = [];

    console.log(`📤 이미지 ${md.imgLabels.length}장 업로드 중...`);
    for (let ii = 0; ii < md.imgLabels.length; ii++) {
      const buf = makeSvgBuffer(md.imgLabels[ii], md.product, md.bgColors[ii % md.bgColors.length]);
      const path = `${company.id}/${missionUuid}/img${ii}.svg`;
      const { error: upErr } = await supabase.storage
        .from('mission-assets').upload(path, buf, { contentType: 'image/svg+xml', upsert: true });
      if (upErr) { console.warn(`  ⚠️  이미지 ${ii} 업로드 실패: ${upErr.message}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
      imageUrls.push(publicUrl);
      console.log(`  ✅ ${md.imgLabels[ii]}`);
    }

    if (imageUrls.length === 0) {
      console.error('❌ 이미지 없음, 의뢰 생성 건너뜀'); continue;
    }

    // 3b. description JSON
    const persona = `연령: ${md.personaAge} / 소득: ${md.personaIncome} / 직군: ${md.personaRole} / ${md.personaContext}`;
    const description = JSON.stringify({
      product: md.product,
      lpUrl: md.lpUrl,
      industry: md.industry,
      personaAge: md.personaAge,
      personaIncome: md.personaIncome,
      personaRole: md.personaRole,
      personaContext: md.personaContext,
      briefText: md.briefText,
      focusAreas: md.focusAreas,
      imageUrls,
      selectedQuestions: md.selectedQuestions,
      careerLevels: ['junior', 'middle', 'senior'],
      panels: 10,
      step: 4,
    });

    // 3c. mission INSERT
    const { error: mInsErr } = await supabase.from('missions').insert({
      id:                missionUuid,
      company_id:        company.id,
      title:             md.title,
      type:              'landing_page',
      target_url:        md.lpUrl,
      description,
      persona,
      panel_count:       10,
      reward_amount:     100000,
      status:            'active',
      assets:            md.focusAreas,
      image_urls:        imageUrls,
      estimated_minutes: 7,
      filled_count:      0,
    });

    if (mInsErr) { console.error('❌ 미션 INSERT 실패:', mInsErr.message); continue; }
    console.log(`✅ 미션 생성 완료 (id: ${missionUuid})\n`);

    const imageCount = imageUrls.length;

    // 3d. panel1~10 피드백 제출
    for (let pi = 0; pi < panelUsers.length; pi++) {
      const user = panelUsers[pi];
      const panel = panelByUserId[user.id];
      const quality = randomQuality();
      const tierLabel = quality === 'high' ? '고품질' : quality === 'mid' ? '중품질' : '저품질';

      process.stdout.write(`  [패널 ${pi+1}/10] ${user.email} (${tierLabel}) ... `);

      if (!panel) { console.log('panels 레코드 없음, 건너뜀'); continue; }

      // 기존 피드백 확인
      const { data: existing } = await supabase.from('feedbacks')
        .select('id, status').eq('mission_id', missionUuid).eq('panel_id', panel.id).maybeSingle();

      if (existing && (existing.status === 'submitted' || existing.status === 'approved')) {
        console.log('이미 제출됨'); totalFeedbacks++; continue;
      }

      // draft 생성
      let feedbackId;
      if (existing) {
        feedbackId = existing.id;
      } else {
        const { data: fb, error: fbErr } = await supabase.from('feedbacks')
          .insert({ mission_id: missionUuid, panel_id: panel.id, status: 'draft', purity_passed: false })
          .select('id').single();
        if (fbErr) { console.log(`❌ draft 생성 실패: ${fbErr.message}`); continue; }
        feedbackId = fb.id;
      }

      // 기존 어노테이션 삭제 후 재생성
      await supabase.from('feedback_annotations').delete().eq('feedback_id', feedbackId);

      // 5대 지표 어노테이션
      const annotations = [];
      const dimAvgScores = {};

      for (const dim of DIMENSIONS) {
        const count = randInt(1, 2);
        const scores = [];
        for (let k = 0; k < count; k++) {
          const score = pickDimScore(quality, k);
          scores.push(score);
          const box = randomBox();
          const imgIdx = imageCount > 1 ? (DIMENSIONS.indexOf(dim) + k) % imageCount : 0;
          annotations.push({
            feedback_id: feedbackId, mission_id: missionUuid, panel_id: panel.id,
            image_index: imgIdx,
            x_pct: box.x_pct, y_pct: box.y_pct, w_pct: box.w_pct, h_pct: box.h_pct,
            dimension: dim, score,
            comment: pickComment(dim, score),
          });
        }
        dimAvgScores[dim] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }

      const { error: annErr } = await supabase.from('feedback_annotations').insert(annotations);
      if (annErr) { console.log(`❌ 어노테이션 오류: ${annErr.message}`); continue; }

      // suggestions 텍스트
      const suggestionLines = DIMENSIONS.map(dim => {
        const dimAnns = annotations.filter(a => a.dimension === dim);
        return `[${DIM_LABELS[dim]}]\n${dimAnns.map(a => a.comment).join('\n')}`;
      });
      suggestionLines.push(`[총평]\n${pickOverall(md, quality, pi)}`);
      const suggestionsText = suggestionLines.join('\n');

      // custom_answers
      const customAnswers = md.selectedQuestions.map((q, qIdx) => ({
        questionId: q.id || `q-${qIdx}`,
        questionText: q.text || '',
        type: q.type || 'text',
        answer: generateCustomAnswer({ type: q.type, options: q.options || [] }, pi, qIdx),
      }));

      // 피드백 UPDATE → submitted
      const updatePayload = {
        status: 'submitted',
        clarity_score:        dimAvgScores.clarity,
        relevance_score:      dimAvgScores.relevance,
        value_score:          dimAvgScores.value,
        differentiation_score: dimAvgScores.differentiation,
        trust_score:          dimAvgScores.trust,
        suggestions:          suggestionsText,
        strengths:            null,
        custom_answers:       customAnswers,
      };

      const { error: upErr } = await supabase.from('feedbacks').update(updatePayload).eq('id', feedbackId);
      if (upErr) { console.log(`❌ UPDATE 실패: ${upErr.message}`); continue; }

      // RPCs
      const { error: r1 } = await supabase.rpc('increment_mission_filled_count', { mission_id: missionUuid });
      if (r1) process.stdout.write(`[filled_count⚠] `);

      const { error: r2 } = await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
      if (r2) process.stdout.write(`[total_missions⚠] `);

      const { error: r3 } = await supabase.rpc('add_panel_honor_points', { p_panel_id: panel.id });
      if (r3) process.stdout.write(`[honor⚠] `);

      const scoreStr = DIMENSIONS.map(d => `${DIM_LABELS[d][0]}${dimAvgScores[d]}`).join(' ');
      console.log(`✅ ${scoreStr}`);
      totalFeedbacks++;
    }

    // 최종 슬롯 확인
    const { data: finalM } = await supabase
      .from('missions').select('filled_count, panel_count').eq('id', missionUuid).single();
    console.log(`\n  슬롯: ${finalM?.filled_count ?? '?'}/${finalM?.panel_count ?? 10}\n`);
  }

  console.log(`${'='.repeat(60)}`);
  console.log(`🎉 완료: 피드백 ${totalFeedbacks}/50개 제출`);
  console.log(`   5개 의뢰 × 패널 10명 처리 완료`);
}

main().catch(e => { console.error('예상치 못한 오류:', e); process.exit(1); });
