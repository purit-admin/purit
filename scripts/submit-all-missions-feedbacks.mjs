/**
 * 전체 활성 의뢰(메인3 + 소재비교4 + 가격검증4 + 이메일검증4)에
 * 패널 1~10 완전한 피드백 자동 제출 스크립트
 *
 * 메인(LP검증):
 *   - 5대 지표 이미지 어노테이션 (좌표+점수+코멘트, 다중 이미지 분산)
 *   - 패널별 랜덤 skip 지표 (어노테이션 없이 넘어감)
 *   - LP 추가 질문 custom_answers (scale/radio/text)
 * 서브(preference/pricing/email):
 *   - 타입별 응답 테이블 INSERT
 *   - 커스텀 질문 custom_answers
 *   - 패널마다 다른 선택/점수/코멘트 패턴
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env.local 환경변수 로드
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수 누락');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ══════════════════════════════════════════════════════════════
// 패널별 특성 정의 (10명이 실제로 한 것처럼 다양하게)
// ══════════════════════════════════════════════════════════════

const PANEL_PROFILES = [
  // idx 0: 꼼꼼한 비판적 평가자, clarity skip, A 선호
  { scoreBase: [2,3,2,3,2], skipDim: 'clarity',        preferVariant: 'A', wouldBuy: false, wouldReply: false, commentStyle: 'critical' },
  // idx 1: 긍정적 얼리어답터, skip 없음, B 선호
  { scoreBase: [4,5,4,4,5], skipDim: null,             preferVariant: 'B', wouldBuy: true,  wouldReply: true,  commentStyle: 'positive' },
  // idx 2: 중립적 실용주의자, relevance skip, A 선호
  { scoreBase: [3,3,4,3,3], skipDim: 'relevance',      preferVariant: 'A', wouldBuy: true,  wouldReply: false, commentStyle: 'neutral'  },
  // idx 3: 열정적 지지자, skip 없음, A 선호
  { scoreBase: [5,4,5,5,4], skipDim: null,             preferVariant: 'A', wouldBuy: true,  wouldReply: true,  commentStyle: 'enthusiast' },
  // idx 4: 가성비 중시, value skip, B 선호
  { scoreBase: [3,4,3,4,4], skipDim: 'value',          preferVariant: 'B', wouldBuy: true,  wouldReply: true,  commentStyle: 'practical' },
  // idx 5: 회의적 분석가, skip 없음, B 선호
  { scoreBase: [2,2,3,2,3], skipDim: null,             preferVariant: 'B', wouldBuy: false, wouldReply: false, commentStyle: 'skeptic'  },
  // idx 6: 디자인 민감 사용자, skip 없음, A 선호
  { scoreBase: [4,4,3,4,4], skipDim: null,             preferVariant: 'A', wouldBuy: true,  wouldReply: true,  commentStyle: 'design'   },
  // idx 7: 데이터 지향 평가자, differentiation skip, B 선호
  { scoreBase: [3,3,3,3,4], skipDim: 'differentiation', preferVariant: 'B', wouldBuy: false, wouldReply: true, commentStyle: 'data'     },
  // idx 8: 브랜드 신뢰 중시, skip 없음, A 선호
  { scoreBase: [5,5,4,4,5], skipDim: null,             preferVariant: 'A', wouldBuy: true,  wouldReply: true,  commentStyle: 'brand'    },
  // idx 9: 경험 많은 마케터, trust skip, B 선호
  { scoreBase: [4,3,4,3,4], skipDim: 'trust',          preferVariant: 'B', wouldBuy: true,  wouldReply: false, commentStyle: 'marketer' },
];

// ══════════════════════════════════════════════════════════════
// 코멘트 풀 — 메인(LP) 5대 지표
// ══════════════════════════════════════════════════════════════

const COMMENTS = {
  clarity: {
    high: [
      '히어로 섹션의 헤드라인이 즉각적으로 무슨 서비스인지 파악하게 해줍니다. 매우 명확합니다.',
      '핵심 가치 제안이 상단에 큼직하게 배치되어 첫 스크롤 없이도 이해됩니다.',
      'CTA 버튼 주변 문구가 행동을 유도하기에 충분히 구체적입니다.',
      '섹션 흐름이 논리적이어서 자연스럽게 읽히고 정보가 쉽게 흡수됩니다.',
    ],
    mid: [
      '핵심 메시지는 전달되지만 부가 설명이 너무 많아 집중이 분산됩니다.',
      '서비스 설명이 어느 정도 명확하지만 구체적인 예시가 부족합니다.',
      '중요 정보는 있으나 텍스트 밀도가 높아 스캔하기 어렵습니다.',
      'CTA 근처 설명 텍스트가 많아 버튼이 다소 묻혀 보입니다.',
    ],
    low: [
      '첫 화면에서 무엇을 제공하는 서비스인지 즉시 파악하기 어렵습니다.',
      '핵심 메시지보다 부가 설명이 더 눈에 띄어 혼란을 줍니다.',
      '텍스트가 너무 밀집되어 무엇을 먼저 읽어야 할지 모르겠습니다.',
      '섹션 간 연결이 자연스럽지 않아 전체 흐름 파악에 시간이 걸립니다.',
    ],
  },
  relevance: {
    high: [
      '타겟 고객의 언어와 페인포인트를 정확히 사용하여 강한 공감대를 형성합니다.',
      '페르소나의 일상적인 고민을 직접 언급해 "나를 위한 서비스"라는 느낌이 강합니다.',
      '사용된 이미지와 예시가 타겟 사용자의 실제 업무 환경과 잘 맞아떨어집니다.',
      '타겟 직군이 자주 마주치는 문제를 구체적으로 묘사해 관련성이 높습니다.',
    ],
    mid: [
      '전반적으로 타겟과 맞는 편이나 더 구체적인 페르소나 맞춤이 필요합니다.',
      '타겟 키워드는 사용하고 있으나 왜 이 서비스여야 하는지 설득이 약합니다.',
      '라이프스타일 이미지가 타겟과 어느 정도 일치하지만 더 구체화가 필요합니다.',
      '메시지가 너무 광범위해 특정 타겟에게 핀포인트하지 못합니다.',
    ],
    low: [
      '타겟 고객의 일상과 연결되는 구체적 표현이 부족합니다.',
      '일반적인 마케팅 문구라 이 분야 특유의 공감대가 없습니다.',
      '사용된 사례나 예시가 타겟 페르소나와 거리가 있습니다.',
      '광범위한 타겟을 겨냥하다보니 누구에게도 강하게 어필하지 못합니다.',
    ],
  },
  value: {
    high: [
      'ROI와 구체적인 효과가 수치로 제시되어 가치가 명확하게 전달됩니다.',
      '경쟁사 대비 절감 효과가 구체적 금액으로 표시되어 납득이 됩니다.',
      '무료 체험 혜택이 도입 진입 장벽을 크게 낮춰줍니다.',
      '비용 대비 기대 효익이 수치와 사례로 잘 설명되어 있습니다.',
    ],
    mid: [
      '가격은 명시되어 있으나 같은 금액으로 얻는 가치 설명이 부족합니다.',
      '혜택 목록은 있으나 경쟁사 대비 우위가 명확히 드러나지 않습니다.',
      '기능 나열은 충분하지만 실제 업무에서 얼마나 도움이 될지 체감이 어렵습니다.',
      '가격 정책은 있으나 구체적인 성과 사례가 뒷받침되어야 설득력이 올라갑니다.',
    ],
    low: [
      '요금제 대비 무엇을 얼마나 받는지 불명확합니다.',
      '가격이 표시되어 있지만 그 가격이 적절한지 판단할 근거가 없습니다.',
      '혜택이 추상적으로 서술되어 실제 가치 판단이 어렵습니다.',
      '비슷한 서비스들과 가격 비교 없이는 경쟁력 파악이 불가능합니다.',
    ],
  },
  differentiation: {
    high: [
      '실제 타겟 패널 피드백 기반이라는 점이 AI 분석 도구들과 강력하게 차별화됩니다.',
      '정량적 평가 프레임이 독자적인 방법론으로 분명히 부각됩니다.',
      '실시간 어노테이션 기능이 타 서비스에서 볼 수 없는 고유한 가치입니다.',
      '도메인 전문 패널 큐레이션이 일반 설문 플랫폼과의 차별점을 명확히 합니다.',
    ],
    mid: [
      '차별화 포인트가 있으나 경쟁 서비스 대비 우위가 명시적으로 드러나지 않습니다.',
      '"실제 패널" 강조는 좋으나 그것이 왜 더 나은지 설명이 필요합니다.',
      '독자적 기술이나 프로세스에 대한 설명이 보강되면 차별화가 강해질 것입니다.',
      '기능 자체는 독특하지만 그 독특함이 충분히 강조되지 않습니다.',
    ],
    low: [
      '기존 A/B 테스트 도구나 설문 서비스와 뚜렷한 차이점이 보이지 않습니다.',
      '"패널 피드백" 외에 이 서비스만의 고유 가치가 드러나지 않습니다.',
      '경쟁사 제품과 비슷한 혜택을 비슷한 방식으로 제시하고 있습니다.',
      '차별화 메시지가 없어 다른 리서치 플랫폼과 혼동됩니다.',
    ],
  },
  trust: {
    high: [
      '실제 도입 사례와 구체적인 전환율 개선 수치가 신뢰도를 크게 높입니다.',
      '패널의 NDA 보장 안내가 기업 고객의 정보 보안 불안을 직접 해소합니다.',
      '고객사 로고 배치와 담당자 실명 인터뷰가 진정성 있게 느껴집니다.',
      '보안 인증과 개인정보처리 정책이 눈에 잘 띄어 신뢰가 형성됩니다.',
    ],
    mid: [
      '후기 섹션은 있으나 구체적 수치 없는 텍스트 위주라 신뢰도가 제한적입니다.',
      '로고 배치는 있으나 실제 도입 사례로 연결되지 않아 효과가 약합니다.',
      '고객 지원 연락처가 있으나 눈에 잘 띄지 않습니다.',
      '후기 수가 적어 사회적 증거로서의 효과가 제한적입니다.',
    ],
    low: [
      '도입 사례나 사회적 증거가 거의 없어 첫 방문자에게 신뢰가 생기지 않습니다.',
      '패널의 전문성이나 검증 프로세스에 대한 설명이 없어 품질이 의심됩니다.',
      '결제 보안 관련 표시가 없어 구독 결정을 주저하게 됩니다.',
      '브랜드 히스토리나 팀 정보가 전혀 없어 신뢰 형성이 어렵습니다.',
    ],
  },
};

// commentStyle → quality 매핑
// high: positive/enthusiast/brand → 키워드 풍부 ~85~95점
// low:  critical/skeptic          → AI 패널티 ~30점
// mid:  그 외                     → 키워드 절제 ~50~70점
const QUALITY_BY_STYLE = {
  positive: 'high', enthusiast: 'high', brand: 'high',
  critical: 'low',  skeptic:    'low',
  neutral:  'mid',  practical:  'mid',  design: 'mid', data: 'mid', marketer: 'mid',
};

const OVERALL_HIGH = [
  '전체적으로 깔끔하고 타겟에게 적합한 메시지를 전달하고 있습니다. 히어로 섹션 카피를 좀 더 결과 중심으로 바꾸고 구체적인 수치를 상단에 배치하면 첫인상이 크게 개선될 것입니다. 신뢰 요소 보강이 가장 시급해 보입니다.',
  '서비스의 핵심 가치가 명확하게 전달됩니다. CTA 버튼이 스크롤 없이 상단에서도 보이면 전환율이 올라갈 것 같습니다. 특히 패널 검증 프로세스 설명이 신뢰도를 높이는 데 효과적이었습니다.',
  '가장 잘 된 부분은 독자적인 방법론 소개입니다. 가격 가치 전달이 약해서 ROI 계산 섹션이 추가되면 전환율이 높아질 것입니다.',
  '타겟 고객의 언어를 잘 사용하고 있으며 CTA 문구가 명확합니다. 도입 기업 구체 사례와 30일 무료 체험 제안이 추가되면 최종 전환에 결정적인 역할을 할 것입니다.',
];

// actionable 1~2개 수준 → dim 기여분 포함 시 50~70점대 형성
const OVERALL_MID = [
  '서비스의 방향성은 이해되지만 방문자가 즉시 가치를 체감하기에는 설명이 다소 부족합니다. 고객 도입 사례나 효과 데이터가 보강되면 설득력이 올라갈 것 같습니다.',
  '전반적인 구성은 무난하지만 경쟁 서비스 대비 차별점이 더 강조될 필요가 있습니다. 각 섹션 메시지를 명확하게 수정하면 방문자 이탈을 줄이는 데 도움이 될 것입니다.',
  '서비스의 특징은 파악되지만 처음 방문한 사람이 왜 이 서비스를 선택해야 하는지 설득이 약합니다. 고객 후기나 비교 정보를 추가하면 의사결정에 도움이 될 것입니다.',
  '랜딩페이지의 첫인상은 좋지만 핵심 가치 메시지가 더 앞에 배치될 필요가 있습니다. 전환을 유도하는 요소를 상단으로 올리면 체류 시간이 늘어날 것입니다.',
  '서비스 컨셉과 기능은 이해됩니다. 다만 방문자가 즉각적으로 기억할 만한 핵심 메시지가 좀 더 강조되면 좋겠다는 느낌을 받았습니다.',
];

// AI 패널티 문구 포함 → -15점 → ~30점대 형성
const OVERALL_LOW = [
  '랜딩페이지를 전반적으로 살펴봤는데 크게 문제될 부분은 없어 보입니다. 서비스의 방향성이 잘 잡혀 있다고 생각됩니다.',
  '전체적인 구성이 깔끔하게 정리되어 있어서 보기에 좋습니다. 방문자에게 서비스가 무난하게 전달될 것이라 판단됩니다.',
  '서비스 소개가 기본적인 역할은 충분히 하고 있습니다. 전체적으로 무난하게 잘 되어있다고 생각됩니다.',
];

function pickOverallByStyle(style, panelIdx) {
  const q = QUALITY_BY_STYLE[style] || 'mid';
  if (q === 'low')  return OVERALL_LOW[panelIdx % OVERALL_LOW.length];
  if (q === 'high') return OVERALL_HIGH[panelIdx % OVERALL_HIGH.length];
  return OVERALL_MID[panelIdx % OVERALL_MID.length];
}

// ── 서브 미션 코멘트 풀 ──────────────────────────────────────────────────────

const PREFERENCE_COMMENTS = [
  ['소재 A', '감성적 접근이 타겟의 일상적 고민을 직접 건드립니다. 첫인상에서 공감이 형성되는 느낌이 강했습니다. B는 기능 위주라 차갑게 느껴졌습니다.'],
  ['소재 B', '기능과 스펙을 명확하게 보여줘서 실제로 뭘 쓸 수 있는지 빠르게 파악됐습니다. A는 감성적이지만 실제 효과를 가늠하기 어려웠습니다.'],
  ['소재 A', 'Before/After나 구체적인 결과물 이미지가 신뢰를 주었습니다. B는 정보가 너무 많아 한눈에 파악이 안 됐습니다.'],
  ['소재 B', 'CTA 문구와 위치가 더 명확하고 즉각적인 행동을 유도합니다. A는 분위기는 좋지만 다음 단계가 불명확합니다.'],
  ['소재 A', '타겟 페르소나의 실제 고민을 정확히 포착해서 공감이 잘 됩니다. 다만 B도 정보 전달 측면에서는 더 효율적이었습니다.'],
  ['소재 B', '심플하고 직관적인 구성이 좋습니다. A는 텍스트가 많아 스크롤 없이 핵심을 파악하기 어렵습니다.'],
  ['소재 A', '비주얼 임팩트가 강해서 스크롤을 멈추게 만드는 힘이 있습니다. B는 밋밋해서 피드에서 스크롤로 넘어갈 것 같습니다.'],
  ['소재 B', '정보 구조가 명확해서 의사결정이 빠릅니다. A는 감성에 치중되어 있어 이성적 구매 결정에는 약합니다.'],
  ['소재 A', '첫인상에서 강한 감정을 불러일으킵니다. 이 감정이 구매 충동으로 이어지는 흐름이 자연스럽습니다.'],
  ['소재 B', 'AI 기술 강조가 차별화 포인트를 명확히 합니다. A는 비슷한 제품들과 차별화가 덜 됩니다.'],
];

const PRICING_COMMENTS = [
  '가격 대비 제공 가치가 명확하게 표현되어 있습니다. 다만 실제 사용 사례가 없어 추상적으로 느껴집니다.',
  '요금제 구성이 직관적이고 비교하기 쉽습니다. 엔터프라이즈 가격 공개가 되면 더 좋을 것 같습니다.',
  '무료 체험 기간이 결제 진입 장벽을 낮추는 데 효과적입니다. 취소가 쉽다는 안내도 도움이 됩니다.',
  '중간 요금제의 기능 차별화가 업그레이드를 자연스럽게 유도합니다. 가격이 조금 더 저렴했으면 합니다.',
  '가격 정책은 합리적이지만 경쟁사 대비 비교가 없어 상대적 가치 판단이 어렵습니다.',
  '환불 보장 정책이 있어 리스크 없이 시작할 수 있다는 느낌이 좋습니다. 요금제 간 기능 차이가 더 부각되면 좋겠습니다.',
  '월간/연간 옵션과 절감액이 명확해서 연간 구독을 고려하게 됩니다. 추가 혜택이 있으면 더 좋겠습니다.',
  '최고가 요금제의 차별화 기능이 충분히 매력적으로 표현되지 않았습니다. 실제 ROI 수치가 있으면 설득력이 올라갈 것 같습니다.',
  '가격 표현 방식이 깔끔하고 비교가 쉽습니다. 학생/스타트업 할인 옵션이 있으면 더 좋겠습니다.',
  '프리미엄 혜택의 가치가 납득됩니다. 처음에는 비싸 보였지만 기능 목록을 보면서 수긍이 됐습니다.',
];

const EMAIL_COMMENTS = [
  '제목에서 즉각적인 호기심이 생겼습니다. 본문이 간결하면서도 핵심을 잘 짚어 읽기 편했습니다.',
  '개인화된 느낌이 강해서 스팸으로 느껴지지 않았습니다. CTA가 명확하고 부담스럽지 않습니다.',
  '문제 제기 → 해결책 → CTA 구조가 논리적이고 설득력이 있습니다. 발신자 신원이 명확한 점도 좋습니다.',
  '통계와 구체적인 수치가 신뢰를 줍니다. 이런 증거 기반 접근이 B2B 이메일에서 특히 효과적입니다.',
  '본문 길이가 적절해서 바쁜 독자도 끝까지 읽을 수 있을 것 같습니다. CTA 문구가 더 구체적이면 좋겠습니다.',
  '제목이 직접적인 질문 형태라 나를 위한 메일인지 빠르게 판단하게 해줍니다. 본문의 페인포인트 묘사가 정확합니다.',
  '감성적 톤이 브랜드와 잘 맞고 부담 없이 읽힙니다. 긴급성 요소가 추가되면 전환율이 올라갈 것 같습니다.',
  '발신자 소개가 자연스럽고 과도한 영업 느낌이 없습니다. 소셜 프루프가 더 있으면 좋겠습니다.',
  '제목과 본문이 일관된 메시지를 전달해서 기대감이 깨지지 않습니다. 이미지나 리치미디어가 추가되면 더 좋겠습니다.',
  '명확한 한 가지 CTA에 집중한 구성이 좋습니다. 본문에서 더 구체적인 혜택을 먼저 언급하면 더 효과적일 것 같습니다.',
];

// ── 추가 질문 답변 풀 ─────────────────────────────────────────────────────────

const SCALE_POOL = [[2,3,2,3,2],[4,5,4,4,3],[3,3,4,3,3],[5,4,5,4,5],[3,4,3,4,4],[2,3,3,2,3],[4,4,3,4,4],[3,3,3,3,4],[5,5,4,5,4],[4,3,4,3,3]];
const RADIO_PICKS = [1,0,1,0,2,1,0,2,0,1];
const TEXT_ANSWERS = [
  '구체적인 ROI 수치와 실제 도입 기업의 개선 사례가 없어 가격 대비 효과를 판단하기 어렵습니다.',
  '서비스 결과물의 실제 샘플이 없어 도입 후 어떤 인사이트를 얻을 수 있는지 막막합니다.',
  '패널의 전문성과 선발 기준이 명확하지 않아 피드백의 품질을 신뢰하기 어렵습니다.',
  '경쟁사와의 비교 없이는 가격 경쟁력을 판단할 수 없습니다.',
  '무료 체험이나 소규모 파일럿 없이 구독을 결정하기에는 초기 비용 부담이 있습니다.',
  '평가 프레임이 우리 서비스에 어떻게 맞춤 적용되는지 구체적인 설명이 없습니다.',
  '피드백 수집부터 최종 리포트까지 소요 기간이 명시되어 있지 않아 의사결정이 어렵습니다.',
  '실제 사용 화면 없이 기능만 나열되어 있어 실사용 경험을 상상하기 어렵습니다.',
  '구독 취소 정책과 환불 조건이 눈에 잘 띄지 않아 계약 리스크가 느껴집니다.',
  '팀 구성원의 접근 권한 관리나 협업 기능에 대한 설명이 없어 팀 도입을 고려하기 어렵습니다.',
];

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

const DIMENSIONS = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];
const DIM_LABELS  = { clarity: '명확성', relevance: '관련성', value: '가치', differentiation: '차별화', trust: '신뢰' };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

function randomBox() {
  const x = randFloat(5, 50), y = randFloat(5, 50);
  const w = randFloat(15, 35), h = randFloat(10, 25);
  return { x_pct: x, y_pct: y, w_pct: Math.min(w, 92 - x), h_pct: Math.min(h, 92 - y) };
}

function pickComment(dim, score) {
  const bucket = score >= 4 ? 'high' : score >= 3 ? 'mid' : 'low';
  return randItem(COMMENTS[dim][bucket]);
}

function generateCustomAnswer(q, panelIdx, qIdx) {
  const type = q.type || q.question_type || 'text';
  if (type === 'scale') {
    const row = SCALE_POOL[panelIdx % SCALE_POOL.length];
    return String(row[qIdx % row.length]);
  } else if (type === 'radio') {
    const opts = q.options || [];
    if (!opts.length) return '해당 없음';
    return opts[RADIO_PICKS[panelIdx % RADIO_PICKS.length] % opts.length];
  }
  return TEXT_ANSWERS[panelIdx % TEXT_ANSWERS.length];
}

function parseSelectedQuestions(description) {
  try {
    const desc = JSON.parse(description || '{}');
    if (desc.selectedQuestions?.length) return desc.selectedQuestions;
    const tqs = desc.templateQuestions || [];
    const cqs = (desc.customQuestions || []).map(q =>
      typeof q === 'string' ? { id: `cq-${q.slice(0,8)}`, text: q, type: 'text', options: [] } : q
    );
    return [...tqs, ...cqs];
  } catch { return []; }
}

// ══════════════════════════════════════════════════════════════
// 핵심 공통: draft 피드백 생성 or 재사용
// ══════════════════════════════════════════════════════════════

async function ensureDraftFeedback(missionId, panelId) {
  const { data: existing } = await supabase
    .from('feedbacks')
    .select('id, status')
    .eq('mission_id', missionId)
    .eq('panel_id', panelId)
    .maybeSingle();

  if (existing?.status === 'submitted' || existing?.status === 'approved') return { id: existing.id, skip: true };
  if (existing) return { id: existing.id, skip: false };

  const { data: fb, error } = await supabase
    .from('feedbacks')
    .insert({ mission_id: missionId, panel_id: panelId, status: 'draft', purity_passed: false })
    .select('id').single();

  if (error) throw new Error(`draft INSERT 실패: ${error.message}`);
  return { id: fb.id, skip: false };
}

async function callRpcs(missionId, panelId) {
  const { error: r1 } = await supabase.rpc('increment_mission_filled_count', { mission_id: missionId });
  if (r1) console.warn(`     ⚠️  filled_count RPC: ${r1.message}`);
  const { error: r2 } = await supabase.rpc('increment_panel_mission_count', { panel_id: panelId });
  if (r2) console.warn(`     ⚠️  total_missions RPC: ${r2.message}`);
  const { error: r3 } = await supabase.rpc('add_panel_honor_points', { p_panel_id: panelId, p_delta: 5 });
  if (r3) console.warn(`     ⚠️  honor_points RPC: ${r3.message}`);
}

// ══════════════════════════════════════════════════════════════
// 메인(LP검증) 피드백
// ══════════════════════════════════════════════════════════════

async function submitMainFeedback(mission, panel, panelIdx) {
  const profile = PANEL_PROFILES[panelIdx];
  const imageCount = (mission.image_urls || []).length || 1;
  const selectedQuestions = parseSelectedQuestions(mission.description);

  const { id: feedbackId, skip } = await ensureDraftFeedback(mission.id, panel.id);
  if (skip) { console.log('     ⏩ 이미 제출됨'); return; }

  // 기존 어노테이션 삭제
  await supabase.from('feedback_annotations').delete().eq('feedback_id', feedbackId);

  const annotations = [];
  const dimAvgScores = {};

  for (let di = 0; di < DIMENSIONS.length; di++) {
    const dim = DIMENSIONS[di];

    // skip 지표: 어노테이션 없이 넘어감 (패널별 1개 지표만 skip)
    if (profile.skipDim === dim) {
      dimAvgScores[dim] = null;
      console.log(`     ↷ ${DIM_LABELS[dim]} skip`);
      continue;
    }

    const count = randInt(1, 2);
    const scores = [];
    for (let k = 0; k < count; k++) {
      const base = profile.scoreBase[di];
      const jitter = randInt(-1, 1);
      const score = clamp(base + jitter, 1, 5);
      scores.push(score);
      const imgIdx = imageCount > 1 ? (di + k) % imageCount : 0;
      const box = randomBox();
      annotations.push({
        feedback_id: feedbackId,
        mission_id: mission.id,
        panel_id: panel.id,
        image_index: imgIdx,
        x_pct: box.x_pct, y_pct: box.y_pct,
        w_pct: box.w_pct, h_pct: box.h_pct,
        dimension: dim,
        score,
        comment: pickComment(dim, score),
      });
    }
    dimAvgScores[dim] = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
  }

  if (annotations.length > 0) {
    const { error: annErr } = await supabase.from('feedback_annotations').insert(annotations);
    if (annErr) throw new Error(`어노테이션 INSERT 실패: ${annErr.message}`);
  }
  console.log(`     ✅ 어노테이션 ${annotations.length}개 (skip: ${profile.skipDim || '없음'})`);

  // suggestions 조합
  const lines = DIMENSIONS.map(dim => {
    if (profile.skipDim === dim) return `[${DIM_LABELS[dim]}]\n(해당 지표 검증할 내용 없음)`;
    const anns = annotations.filter(a => a.dimension === dim);
    return `[${DIM_LABELS[dim]}]\n${anns.map(a => a.comment).join('\n')}`;
  });
  lines.push(`[총평]\n${pickOverallByStyle(profile.commentStyle, panelIdx)}`);

  // custom_answers (LP 추가 질문)
  let customAnswers = null;
  if (selectedQuestions.length > 0) {
    customAnswers = selectedQuestions.map((q, qi) => ({
      questionId: q.id || `q-${qi}`,
      questionText: q.text || q.question_text || '',
      type: q.type || q.question_type || 'text',
      answer: generateCustomAnswer(q, panelIdx, qi),
    }));
  }

  const payload = {
    status: 'submitted',
    clarity_score:         dimAvgScores.clarity         ?? null,
    relevance_score:       dimAvgScores.relevance       ?? null,
    value_score:           dimAvgScores.value           ?? null,
    differentiation_score: dimAvgScores.differentiation ?? null,
    trust_score:           dimAvgScores.trust           ?? null,
    suggestions: lines.join('\n'),
    strengths: null,
  };
  if (customAnswers) payload.custom_answers = customAnswers;

  const { error: upErr } = await supabase.from('feedbacks').update(payload).eq('id', feedbackId);
  if (upErr) throw new Error(`feedbacks UPDATE 실패: ${upErr.message}`);

  const scoreStr = DIMENSIONS.map(d => dimAvgScores[d] ? `${DIM_LABELS[d][0]}${dimAvgScores[d]}` : `${DIM_LABELS[d][0]}-`).join(' ');
  console.log(`     ✅ 점수: ${scoreStr}${customAnswers ? ` | 추가질문 ${customAnswers.length}개` : ''}`);
  await callRpcs(mission.id, panel.id);
}

// ══════════════════════════════════════════════════════════════
// preference(소재비교) 피드백
// ══════════════════════════════════════════════════════════════

async function submitPreferenceFeedback(mission, panel, panelIdx) {
  const profile = PANEL_PROFILES[panelIdx];
  const selectedQuestions = parseSelectedQuestions(mission.description);

  const { id: feedbackId, skip } = await ensureDraftFeedback(mission.id, panel.id);
  if (skip) { console.log('     ⏩ 이미 제출됨'); return; }

  // test_id 조회
  const { data: testRow } = await supabase
    .from('preference_tests').select('id').eq('mission_id', mission.id).maybeSingle();
  const testId = testRow?.id ?? null;

  const variant = profile.preferVariant; // 'A' or 'B'
  const baseScore = profile.scoreBase[panelIdx % 5];
  const messageClarity   = clamp(baseScore + randInt(-1,1), 1, 5);
  const purchaseIntent   = clamp(profile.scoreBase[1] + randInt(-1,1), 1, 5);
  const commentPair = PREFERENCE_COMMENTS[panelIdx];
  const comment = `[선택: 소재 ${commentPair[0]}]\n${commentPair[1]}`;

  // custom_answers
  const customAnswers = selectedQuestions.map((q, qi) => ({
    questionId: q.id || `q-${qi}`,
    questionText: q.text || q.question_text || '',
    type: q.type || q.question_type || 'text',
    answer: generateCustomAnswer(q, panelIdx, qi),
  }));

  // preference_responses INSERT
  const respPayload = {
    panel_id: panel.id,
    preference: variant,
    comment,
    mission_id: mission.id,
    status: 'submitted',
    message_clarity: messageClarity,
    purchase_intent: purchaseIntent,
    custom_answers: customAnswers,
  };
  if (testId) respPayload.test_id = testId;

  const { error: rErr } = await supabase.from('preference_responses').insert(respPayload);
  if (rErr) {
    // unique constraint → 이미 있으면 UPDATE
    const { error: uErr } = await supabase.from('preference_responses')
      .update({ preference: variant, comment, message_clarity: messageClarity, purchase_intent: purchaseIntent, custom_answers: customAnswers })
      .eq('mission_id', mission.id).eq('panel_id', panel.id);
    if (uErr) throw new Error(`preference_responses 실패: ${rErr.message}`);
  }

  // feedbacks UPDATE
  const { error: upErr } = await supabase.from('feedbacks').update({
    status: 'submitted', strengths: null,
    suggestions: `[총평]\n${comment}`,
  }).eq('id', feedbackId);
  if (upErr) throw new Error(`feedbacks UPDATE 실패: ${upErr.message}`);

  console.log(`     ✅ 소재 ${variant} 선택 | 명확성${messageClarity} 구매의향${purchaseIntent}`);
  await callRpcs(mission.id, panel.id);
}

// ══════════════════════════════════════════════════════════════
// pricing(가격검증) 피드백
// ══════════════════════════════════════════════════════════════

async function submitPricingFeedback(mission, panel, panelIdx) {
  const profile = PANEL_PROFILES[panelIdx];
  const selectedQuestions = parseSelectedQuestions(mission.description);

  const { id: feedbackId, skip } = await ensureDraftFeedback(mission.id, panel.id);
  if (skip) { console.log('     ⏩ 이미 제출됨'); return; }

  const { data: testRow } = await supabase
    .from('pricing_tests').select('id').eq('mission_id', mission.id).maybeSingle();
  const testId = testRow?.id ?? null;

  const wouldBuy       = profile.wouldBuy;
  const priceFairness  = clamp(profile.scoreBase[2] + randInt(-1,1), 1, 5);
  const valuePercep    = clamp(profile.scoreBase[3] + randInt(-1,1), 1, 5);
  const keyComment     = PRICING_COMMENTS[panelIdx];

  const customAnswers = selectedQuestions.map((q, qi) => ({
    questionId: q.id || `q-${qi}`,
    questionText: q.text || q.question_text || '',
    type: q.type || q.question_type || 'text',
    answer: generateCustomAnswer(q, panelIdx, qi),
  }));

  const respPayload = {
    panel_id: panel.id,
    would_buy: wouldBuy,
    key_comment: keyComment,
    barriers: [],
    mission_id: mission.id,
    status: 'submitted',
    price_fairness: priceFairness,
    value_perception: valuePercep,
    custom_answers: customAnswers,
    tier: panel.experience || 'junior',
  };
  if (testId) respPayload.test_id = testId;

  const { error: rErr } = await supabase.from('pricing_responses').insert(respPayload);
  if (rErr) {
    const { error: uErr } = await supabase.from('pricing_responses')
      .update({ would_buy: wouldBuy, key_comment: keyComment, price_fairness: priceFairness, value_perception: valuePercep, custom_answers: customAnswers })
      .eq('mission_id', mission.id).eq('panel_id', panel.id);
    if (uErr) throw new Error(`pricing_responses 실패: ${rErr.message}`);
  }

  const { error: upErr } = await supabase.from('feedbacks').update({
    status: 'submitted', strengths: null,
    suggestions: `[총평]\n${keyComment}`,
  }).eq('id', feedbackId);
  if (upErr) throw new Error(`feedbacks UPDATE 실패: ${upErr.message}`);

  console.log(`     ✅ 구매의향:${wouldBuy?'O':'X'} | 공정가격${priceFairness} 가치인식${valuePercep}`);
  await callRpcs(mission.id, panel.id);
}

// ══════════════════════════════════════════════════════════════
// email(이메일검증) 피드백
// ══════════════════════════════════════════════════════════════

async function submitEmailFeedback(mission, panel, panelIdx) {
  const profile = PANEL_PROFILES[panelIdx];
  const selectedQuestions = parseSelectedQuestions(mission.description);

  const { id: feedbackId, skip } = await ensureDraftFeedback(mission.id, panel.id);
  if (skip) { console.log('     ⏩ 이미 제출됨'); return; }

  const { data: testRow } = await supabase
    .from('cold_email_tests').select('id').eq('mission_id', mission.id).maybeSingle();
  const testId = testRow?.id ?? null;

  const wouldReply    = profile.wouldReply;
  const openIntent    = clamp(profile.scoreBase[0] + randInt(-1,1), 1, 5);
  const hookScore     = clamp(profile.scoreBase[1] + randInt(-1,1), 1, 5);
  const clarityScore  = clamp(profile.scoreBase[2] + randInt(-1,1), 1, 5);
  const curiosityScore= clamp(profile.scoreBase[3] + randInt(-1,1), 1, 5);
  const comment       = EMAIL_COMMENTS[panelIdx];

  const customAnswers = selectedQuestions.map((q, qi) => ({
    questionId: q.id || `q-${qi}`,
    questionText: q.text || q.question_text || '',
    type: q.type || q.question_type || 'text',
    answer: generateCustomAnswer(q, panelIdx, qi),
  }));

  const respPayload = {
    panel_id: panel.id,
    would_reply: wouldReply,
    hook_score: hookScore,
    clarity_score: clarityScore,
    comment,
    mission_id: mission.id,
    status: 'submitted',
    open_intent: openIntent,
    curiosity_score: curiosityScore,
    custom_answers: customAnswers,
  };
  if (testId) respPayload.test_id = testId;

  const { error: rErr } = await supabase.from('email_responses').insert(respPayload);
  if (rErr) {
    const { error: uErr } = await supabase.from('email_responses')
      .update({ would_reply: wouldReply, hook_score: hookScore, clarity_score: clarityScore, open_intent: openIntent, curiosity_score: curiosityScore, comment, custom_answers: customAnswers })
      .eq('mission_id', mission.id).eq('panel_id', panel.id);
    if (uErr) throw new Error(`email_responses 실패: ${rErr.message}`);
  }

  const { error: upErr } = await supabase.from('feedbacks').update({
    status: 'submitted', strengths: null,
    suggestions: `[총평]\n${comment}`,
  }).eq('id', feedbackId);
  if (upErr) throw new Error(`feedbacks UPDATE 실패: ${upErr.message}`);

  console.log(`     ✅ 답장의향:${wouldReply?'O':'X'} | 개봉${openIntent} 훅${hookScore} 명확${clarityScore} 호기심${curiosityScore}`);
  await callRpcs(mission.id, panel.id);
}

// ══════════════════════════════════════════════════════════════
// 메인
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log('=== 전체 활성 미션 피드백 자동 제출 (패널 1~10) ===\n');

  // 1. 모든 활성 미션 조회
  const { data: missions, error: mErr } = await supabase
    .from('missions')
    .select('id, title, type, image_urls, panel_count, filled_count, description')
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (mErr) { console.error('미션 조회 실패:', mErr.message); return; }
  if (!missions?.length) { console.error('활성 미션 없음'); return; }

  const mainMissions = missions.filter(m => !m.type || m.type === 'landing_page');
  const prefMissions = missions.filter(m => m.type === 'preference');
  const pricMissions = missions.filter(m => m.type === 'pricing');
  const mailMissions = missions.filter(m => m.type === 'email');

  console.log(`📋 활성 미션: 메인 ${mainMissions.length}개 | 소재비교 ${prefMissions.length}개 | 가격검증 ${pricMissions.length}개 | 이메일 ${mailMissions.length}개\n`);

  // 2. 패널 1~10 조회
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 조회 실패:', uErr.message); return; }

  const panelUsers = users
    .filter(u => /^panel\d+@purit\.io$/.test(u.email || ''))
    .sort((a, b) => parseInt(a.email.match(/\d+/)[0]) - parseInt(b.email.match(/\d+/)[0]));
  console.log(`✅ 패널 ${panelUsers.length}명 확인\n`);

  const { data: panelRecords, error: pErr } = await supabase
    .from('panels').select('id, user_id, name, experience')
    .in('user_id', panelUsers.map(u => u.id));
  if (pErr) { console.error('panels 조회 실패:', pErr.message); return; }

  const panelByUserId = {};
  panelRecords.forEach(p => { panelByUserId[p.user_id] = p; });

  // 3. 미션 타입별 피드백 제출
  const MISSION_GROUPS = [
    { label: '메인(LP검증)', list: mainMissions, fn: submitMainFeedback },
    { label: '소재비교',     list: prefMissions, fn: submitPreferenceFeedback },
    { label: '가격검증',     list: pricMissions, fn: submitPricingFeedback },
    { label: '이메일검증',   list: mailMissions, fn: submitEmailFeedback },
  ];

  let totalSuccess = 0, totalFail = 0;

  for (const group of MISSION_GROUPS) {
    if (!group.list.length) continue;
    console.log(`\n${'━'.repeat(56)}`);
    console.log(`▶ ${group.label} (${group.list.length}개 미션)`);

    for (const [mi, mission] of group.list.entries()) {
      const titleShort = mission.title.length > 40 ? mission.title.slice(0, 40) + '…' : mission.title;
      console.log(`\n  [${mi+1}/${group.list.length}] ${titleShort}`);

      for (let pi = 0; pi < panelUsers.length; pi++) {
        const user  = panelUsers[pi];
        const panel = panelByUserId[user.id];
        if (!panel) { console.log(`   ⚠️  panels 레코드 없음 (${user.email}), 건너뜀`); continue; }

        process.stdout.write(`   패널${pi+1} (${user.email.replace('@purit.io','')}) … `);
        try {
          await group.fn(mission, panel, pi);
          totalSuccess++;
        } catch (e) {
          console.log(`❌ ${e.message}`);
          totalFail++;
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`🎉 완료: 성공 ${totalSuccess}건 / 실패 ${totalFail}건`);

  // 최종 미션별 filled_count 요약
  const { data: finalMissions } = await supabase
    .from('missions').select('title, type, filled_count, panel_count').eq('status', 'active');
  if (finalMissions) {
    console.log('\n📊 최종 슬롯 현황:');
    finalMissions.forEach(m => {
      const typLabel = !m.type || m.type==='landing_page' ? '메인' : m.type==='preference' ? '소재비교' : m.type==='pricing' ? '가격검증' : '이메일';
      const title = (m.title || '').slice(0, 35).padEnd(36);
      console.log(`  [${typLabel}] ${title} ${m.filled_count}/${m.panel_count}`);
    });
  }
}

main().catch(e => { console.error('치명적 오류:', e); process.exit(1); });
