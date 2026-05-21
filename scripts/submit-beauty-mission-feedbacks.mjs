/**
 * "뷰티 브랜드 신제품 세럼 랜딩페이지 첫인상 검증" 의뢰에
 * panel1~panel9 피드백 9개 자동 제출 (퓨릿 점수 랜덤)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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
  console.error('❌ 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 차원별 코멘트 풀 (뷰티/스킨케어 맥락) ──────────────────────────────────────

const COMMENTS = {
  clarity: {
    high: [
      '히어로 섹션에서 "신제품 세럼"의 핵심 효능(수분 앰플 50% 함유)이 첫눈에 파악됩니다.',
      '성분 설명이 전문적이면서도 소비자 언어로 잘 풀어쓰여 있어 이해가 쉽습니다.',
      'CTA 버튼("지금 구매하기") 주변에 가격과 용량이 명확히 표시되어 결정을 돕습니다.',
      '3단계 사용법 시각화가 복잡한 스킨케어 루틴을 한 눈에 보여줘 이해도가 높습니다.',
    ],
    mid: [
      '핵심 성분 효능은 있으나 전문 용어가 많아 일반 소비자가 이해하기 어려운 부분이 있습니다.',
      '브랜드 스토리와 제품 설명이 혼재되어 있어 집중도가 다소 분산됩니다.',
      '전성분 표기가 있으나 소비자 관점 혜택으로 전환하는 설명이 부족합니다.',
      'CTA가 있으나 가격 정보 접근이 바로 가능하지 않아 불편함이 있습니다.',
    ],
    low: [
      '첫 화면에서 이 세럼이 어떤 피부 고민을 해결하는지 즉각 파악하기 어렵습니다.',
      '다양한 성분 정보가 나열되어 있어 무엇이 핵심인지 판단이 어렵습니다.',
      '제품 효능 주장이 너무 많아 어느 것을 믿어야 할지 신뢰도가 오히려 낮아집니다.',
      '콘텐츠 흐름이 명확하지 않아 랜딩에서 구매까지의 여정이 불분명합니다.',
    ],
  },
  relevance: {
    high: [
      '"건성 피부 30대 여성"을 정확히 겨냥한 고민 언어("당김, 각질, 칙칙함")가 공감대를 만듭니다.',
      '계절별 피부 변화에 맞춘 사용 시나리오가 타겟 라이프스타일과 잘 맞아떨어집니다.',
      '연령대별 피부 고민에 맞는 성분 강조 방식이 타겟 세분화에 효과적입니다.',
      '바쁜 직장 여성을 위한 "1분 세럼" 콘셉트가 타겟 페르소나와 정확히 맞습니다.',
    ],
    mid: [
      '뷰티 타겟은 어느 정도 맞으나 연령대/피부 타입 세분화가 더 필요해 보입니다.',
      '이미지 모델이 타겟과 유사하지만 더 구체적인 사용 상황 묘사가 있으면 좋겠습니다.',
      '성분 강조는 트렌드를 반영하고 있으나 타겟의 실제 일상과 연결이 약합니다.',
      '전반적으로 뷰티 브랜드 느낌은 있으나 특정 타겟을 강하게 겨냥하지는 않습니다.',
    ],
    low: [
      '성별, 연령, 피부 타입에 상관없이 모두를 대상으로 한 것처럼 느껴져 공감이 약합니다.',
      '피부 고민 표현이 너무 일반적이어서 특정 타겟의 마음을 움직이지 못합니다.',
      '사용 이미지가 타겟 페르소나와 거리가 있어 "나를 위한 제품"이라는 느낌이 없습니다.',
      '타겟 세분화 없이 광범위한 소비자를 겨냥해 누구에게도 강하게 어필하지 못합니다.',
    ],
  },
  value: {
    high: [
      '"4주 임상 결과 수분 87% 개선" 데이터가 구체적이어서 가격 대비 가치 납득이 됩니다.',
      '비슷한 성분의 백화점 세럼 대비 50% 저렴하다는 가성비 비교가 설득력 있습니다.',
      '300ml 대용량과 리필 옵션 제공이 장기 사용 비용을 줄여주는 실질적 가치를 전달합니다.',
      '무료 체험 키트 + 첫 구매 할인 조합이 도입 장벽을 크게 낮춰줍니다.',
    ],
    mid: [
      '가격은 표시되어 있으나 그 가격이 왜 합리적인지 설득 근거가 부족합니다.',
      '성분의 프리미엄 가치는 있으나 실제 비용 절감이나 효과 수치가 없어 체감이 어렵습니다.',
      '번들 옵션은 좋으나 단품 대비 얼마나 절약되는지 직관적으로 보이지 않습니다.',
      '효능 주장은 있으나 임상 데이터나 수치적 근거가 뒷받침되어야 납득이 더 됩니다.',
    ],
    low: [
      '가격 정보가 하단에 있어 상단에서 구매를 결정하기 전 이탈이 많을 것 같습니다.',
      '효능에 비해 가격이 높다는 인상을 주는데 이를 상쇄할 근거 데이터가 없습니다.',
      '타 브랜드 대비 차별화된 가성비 포인트가 불명확해 구매 결정이 어렵습니다.',
      '혜택 목록이 추상적으로 서술되어 실제 피부에 얼마나 도움이 될지 체감이 안 됩니다.',
    ],
  },
  differentiation: {
    high: [
      '"허가받은 피부과 전문의 추천 성분" 배지가 일반 코스메틱과 강력히 차별화됩니다.',
      '자체 개발 나노 캡슐 기술이 성분 흡수율을 높인다는 독자적 기술력이 부각됩니다.',
      '비건 + 더마 + 클린뷰티 3중 인증이 경쟁 제품 대비 명확한 우위를 만듭니다.',
      '피부과 처방 성분을 합리적 가격에 제공한다는 포지셔닝이 독창적으로 느껴집니다.',
    ],
    mid: [
      '브랜드만의 특색이 있으나 유사 기능을 주장하는 다른 세럼들과 차이가 명확하지 않습니다.',
      '"자연 성분" 강조는 트렌드에 맞으나 이 브랜드만의 고유한 기술이나 인증이 없습니다.',
      '경쟁 브랜드 대비 어떤 점이 더 나은지 직접 비교 없이는 차별화 파악이 어렵습니다.',
      '피부과 추천은 언급되나 구체적 검증 기관이나 임상 기관 명시가 없어 설득력이 제한적입니다.',
    ],
    low: [
      '성분 구성이나 효능 주장이 비슷한 경쟁 세럼들과 거의 차이가 없어 보입니다.',
      '"고농축 세럼" "수분 폭탄" 같은 일반 마케팅 문구만 사용해 차별점이 없습니다.',
      '브랜드 고유 기술이나 특허 성분에 대한 언급이 없어 평범한 제품으로 느껴집니다.',
      '다른 드럭스토어 세럼들과 동일한 클레임을 하고 있어 브랜드 고유 가치가 느껴지지 않습니다.',
    ],
  },
  trust: {
    high: [
      '"3,000명 리얼 사용 후기" + 평균 별점 4.8이 강력한 사회적 증거를 만들어줍니다.',
      '피부과 전문의 처방 성분 인증서와 임상 시험 결과지가 브랜드 신뢰를 크게 높입니다.',
      '30일 전액 환불 보장 정책이 구매 리스크를 완전히 제거해줍니다.',
      '전 성분 공개 + 무향 무색소 인증 배지가 성분 민감 소비자의 불안을 해소합니다.',
    ],
    mid: [
      '후기가 있으나 사진 후기 위주라 텍스트 리뷰의 신뢰도가 상대적으로 낮습니다.',
      '브랜드 히스토리가 있으나 설립 배경이나 창업 철학이 진정성 있게 전달되지 않습니다.',
      '인증 배지가 있으나 어느 기관의 것인지 명시되지 않아 신뢰도가 제한적입니다.',
      '환불 정책이 있으나 눈에 잘 띄지 않아 구매 결정 시 불안감이 남습니다.',
    ],
    low: [
      '실제 사용자 후기나 임상 데이터가 없어 효능 주장을 믿기 어렵습니다.',
      '브랜드 정보나 생산지 인증이 전혀 없어 제품 안전성에 의문이 생깁니다.',
      '유명인 협찬 사진만 있고 실 사용자 비포/애프터가 없어 신뢰가 낮습니다.',
      '고객 지원 채널이 눈에 띄지 않아 구매 후 문제 발생 시 대응이 걱정됩니다.',
    ],
  },
};

const OVERALL_HIGH = [
  '뷰티 브랜드의 프리미엄 이미지와 성분 신뢰도가 잘 전달됩니다. 피부과 추천 성분 배지가 인상적이며, 임상 데이터를 상단에 더 강조하면 즉각적인 구매 전환에 효과적일 것입니다. "30일 환불 보장" 문구를 CTA 근처로 이동시키면 망설이는 소비자의 클릭을 이끌어낼 수 있습니다.',
  '타겟 소비자(건성 피부 30대)의 고민을 직접 언급해 공감대 형성이 탁월합니다. 비포/애프터 사진이 강력한 설득 도구가 되고 있으며, 3,000개 이상 리얼 후기가 사회적 증거를 충분히 제공합니다. 가격 비교 섹션을 추가하면 전환율이 더 높아질 것으로 판단됩니다.',
  '세럼의 핵심 성분과 효능이 명확하고 간결하게 전달되며 비주얼 완성도가 높습니다. 특히 나노 캡슐 기술 소개 섹션이 타 브랜드와의 차별화를 효과적으로 만들어냅니다. 무료 샘플 신청 CTA를 히어로 섹션에 추가하면 리드 확보에 큰 도움이 될 것 같습니다.',
  '전반적으로 뷰티 커머스에서 중요한 요소들(비주얼, 성분, 후기, 가격)이 체계적으로 배치되어 있습니다. "4주 임상 87% 개선" 데이터가 구매 결정의 핵심 근거가 되고 있습니다. 구독 정기 배송 옵션의 절약 금액을 더 강조하면 장기 고객 전환에 효과적일 것입니다.',
  '피부 타입별 추천 섹션이 개인화 경험을 잘 구현하고 있습니다. 특히 성분 투명성(전성분 공개)이 MZ 소비자에게 강한 신뢰 신호를 보냅니다. 인플루언서 협찬 콘텐츠와 실 사용자 UGC를 혼합하면 진정성과 도달율 두 마리 토끼를 잡을 수 있을 것입니다.',
];

const OVERALL_MID = [
  '세럼의 기본 정보는 전달되고 있으나 타겟 고객의 피부 고민에 직접적으로 공감하는 언어가 더 필요합니다. 성분 설명을 소비자 혜택 언어로 바꾸면 구매 결정에 도움이 될 것 같습니다.',
  '브랜드 신뢰도를 높이는 콘텐츠(임상 데이터, 전문가 추천)가 보강되면 전환율 개선에 효과적일 것 같습니다. 현재는 제품 설명 위주로 "왜 이 브랜드여야 하는가"에 대한 답변이 약합니다.',
  '비주얼은 좋으나 소비자가 구매를 망설이는 핵심 이유(가격 적정성, 부작용 우려)를 직접 해소하는 콘텐츠가 필요해 보입니다.',
  '제품의 방향성과 특징은 파악되지만 유사 세럼들과의 차별점이 더 명확하게 표현될 필요가 있습니다.',
  '랜딩페이지 구성 자체는 무난하지만 첫 방문자가 바로 구매할 만큼의 강한 동기 유발이 부족합니다. 사회적 증거를 더 강화하면 좋겠습니다.',
];

const OVERALL_LOW = [
  '전반적으로 기본적인 제품 소개는 되어 있다고 생각됩니다. 뷰티 랜딩페이지로서 큰 문제는 없어 보이며 무난하게 잘 만들어진 페이지라 판단됩니다.',
  '제품의 기본 정보가 담겨 있어 방문자에게 서비스가 무난하게 전달될 것이라 생각됩니다. 전체적으로 나쁘지 않은 구성이라 판단됩니다.',
  '깔끔하게 정리된 랜딩페이지라 생각됩니다. 뷰티 제품 소개로서 기본 역할은 충분히 하고 있다고 판단됩니다.',
];

const SCALE_ANSWERS_POOL = [
  [2, 3, 2, 3, 2],
  [4, 5, 4, 4, 3],
  [3, 3, 4, 3, 3],
  [5, 4, 5, 4, 5],
  [3, 4, 3, 4, 4],
  [2, 3, 3, 2, 3],
  [4, 4, 3, 4, 4],
  [3, 3, 3, 3, 4],
  [5, 5, 4, 5, 4],
];

const TEXT_ANSWERS_POOL = [
  '임상 데이터를 더 구체적으로 표시해주면 효능을 신뢰하는 데 도움이 될 것 같습니다.',
  '비슷한 성분의 타 브랜드 세럼과 비교한 정보가 있으면 구매 결정에 도움이 됩니다.',
  '피부 타입별 사용 후기가 더 많이 있으면 내 피부에 맞는지 판단하기 쉬울 것 같습니다.',
  '정기구독 할인율과 단품 구매 차이를 더 눈에 띄게 표시해주면 좋겠습니다.',
  '성분 중 알러지 유발 가능성이 있는 것들에 대한 안내가 있으면 안심하고 구매할 수 있습니다.',
  '샘플 체험 후 정식 구매로 이어지는 프로세스가 더 명확하게 안내되면 좋겠습니다.',
  '전문의 추천 근거가 더 구체적으로 제시된다면 신뢰도가 크게 올라갈 것 같습니다.',
  '제품 용량 대비 권장 사용 기간과 사용량을 명시해주면 실질적 가성비 판단에 도움이 됩니다.',
  '모공, 탄력, 미백 등 세부 효능별 체감 기간이 안내되면 기대 관리에 유용할 것 같습니다.',
];

const DIM_LABELS = {
  clarity: '명확성',
  relevance: '관련성',
  value: '가치',
  differentiation: '차별화',
  trust: '신뢰',
};
const DIMENSIONS = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
function randomBox() {
  const x = randFloat(5, 55);
  const y = randFloat(5, 55);
  const w = randFloat(15, 35);
  const h = randFloat(10, 25);
  return { x_pct: x, y_pct: y, w_pct: Math.min(w, 93 - x), h_pct: Math.min(h, 93 - y) };
}
function pickComment(dim, score) {
  const bucket = score >= 4 ? 'high' : score >= 3 ? 'mid' : 'low';
  return randItem(COMMENTS[dim][bucket]);
}

// 각 패널마다 랜덤 품질 티어 부여
const QUALITY_TIERS = ['low', 'mid', 'high'];
function randomQuality() {
  return QUALITY_TIERS[Math.floor(Math.random() * QUALITY_TIERS.length)];
}

function pickDimScore(quality, k) {
  if (quality === 'low')  return randInt(2, 3);
  if (quality === 'high') return randInt(3, 5);
  return k % 2 === 0 ? randInt(2, 3) : randInt(3, 4);
}

function pickOverall(quality, idx) {
  if (quality === 'low')  return OVERALL_LOW[idx % OVERALL_LOW.length];
  if (quality === 'high') return OVERALL_HIGH[idx % OVERALL_HIGH.length];
  return OVERALL_MID[idx % OVERALL_MID.length];
}

function generateCustomAnswer(question, panelIdx, qIdx) {
  const type = question.type || 'text';
  const scaleRow = SCALE_ANSWERS_POOL[panelIdx % SCALE_ANSWERS_POOL.length];
  if (type === 'scale') return String(scaleRow[qIdx % scaleRow.length]);
  if (type === 'radio') {
    const options = question.options || [];
    if (options.length === 0) return '해당 없음';
    return options[panelIdx % options.length];
  }
  return TEXT_ANSWERS_POOL[panelIdx % TEXT_ANSWERS_POOL.length];
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== 뷰티 세럼 의뢰 — panel1~9 피드백 자동 생성 ===\n');

  // 1. 대상 미션 조회 (제목에 "뷰티" 포함, active 상태)
  const { data: missionRows, error: mErr } = await supabase
    .from('missions')
    .select('id, title, image_urls, panel_count, filled_count, description, type, status')
    .eq('status', 'active')
    .or('type.is.null,type.eq.landing_page')
    .ilike('title', '%뷰티%')
    .order('created_at', { ascending: false });

  if (mErr) { console.error('미션 조회 오류:', mErr.message); return; }
  if (!missionRows || missionRows.length === 0) {
    console.error('❌ "뷰티" 포함 활성 메인 의뢰를 찾을 수 없습니다.');
    return;
  }

  console.log('📋 검색된 의뢰:');
  missionRows.forEach((m, i) => {
    console.log(`  [${i + 1}] "${m.title}" (슬롯: ${m.filled_count}/${m.panel_count}, 이미지: ${(m.image_urls || []).length}장)`);
  });

  const mission = missionRows[0];
  console.log(`\n✅ 대상: "${mission.title}"`);
  console.log(`   id: ${mission.id}`);
  console.log(`   이미지: ${(mission.image_urls || []).length}장`);
  console.log(`   현재 슬롯: ${mission.filled_count}/${mission.panel_count}\n`);

  // 2. LP 추가 질문 파싱
  let selectedQuestions = [];
  try {
    const desc = JSON.parse(mission.description || '{}');
    selectedQuestions = desc.selectedQuestions || [];
    if (selectedQuestions.length === 0) {
      const tqs = desc.templateQuestions || [];
      const cqs = (desc.customQuestions || []).map(q =>
        typeof q === 'string' ? { id: `cq-${q.slice(0, 8)}`, text: q, type: 'text', options: [] } : q
      );
      selectedQuestions = [...tqs, ...cqs];
    }
  } catch {}

  if (selectedQuestions.length > 0) {
    console.log(`📝 LP 추가 질문 ${selectedQuestions.length}개:`);
    selectedQuestions.forEach((q, i) => {
      console.log(`   [${i + 1}] [${q.type || 'text'}] ${q.text || q.question_text || ''}`);
    });
    console.log('');
  }

  const imageCount = Math.max((mission.image_urls || []).length, 1);

  // 3. panel1~9 유저 조회
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 목록 오류:', uErr.message); return; }

  const panelUsers = users
    .filter(u => /^panel([1-9])@purit\.io$/.test(u.email || ''))
    .sort((a, b) => {
      const na = parseInt(a.email.match(/\d+/)[0], 10);
      const nb = parseInt(b.email.match(/\d+/)[0], 10);
      return na - nb;
    });

  console.log(`✅ panel1~9 계정 ${panelUsers.length}개 확인\n`);

  // 4. panels 레코드 매핑
  const { data: panelRecords, error: pErr } = await supabase
    .from('panels')
    .select('id, user_id, name, honor_points, experience')
    .in('user_id', panelUsers.map(u => u.id));

  if (pErr) { console.error('panels 조회 오류:', pErr.message); return; }
  const panelByUserId = {};
  panelRecords.forEach(p => { panelByUserId[p.user_id] = p; });

  let successCount = 0;

  for (let i = 0; i < panelUsers.length; i++) {
    const user = panelUsers[i];
    const panel = panelByUserId[user.id];

    // 이 패널의 퓨릿 점수 품질 티어를 랜덤 지정
    const quality = randomQuality();
    const tierLabel = quality === 'high' ? '고품질(~85+)' : quality === 'mid' ? '중품질(~50~70)' : '저품질(~30)';

    console.log(`\n[${i + 1}/9] ${user.email} (${panel?.name || '?'}) — 퓨릿 티어: ${tierLabel}`);

    if (!panel) {
      console.log('   ⚠️  panels 레코드 없음, 건너뜀');
      continue;
    }

    // 기존 피드백 확인
    const { data: existing } = await supabase
      .from('feedbacks')
      .select('id, status')
      .eq('mission_id', mission.id)
      .eq('panel_id', panel.id)
      .maybeSingle();

    if (existing && (existing.status === 'submitted' || existing.status === 'approved')) {
      console.log(`   ⏩ 이미 제출됨 (${existing.status}), 건너뜀`);
      successCount++;
      continue;
    }

    let feedbackId;

    if (existing) {
      feedbackId = existing.id;
      console.log(`   기존 draft 재사용: ${feedbackId}`);
    } else {
      const { data: fb, error: fbErr } = await supabase
        .from('feedbacks')
        .insert({ mission_id: mission.id, panel_id: panel.id, status: 'draft', purity_passed: false })
        .select('id')
        .single();

      if (fbErr) { console.error(`   ❌ feedback INSERT 실패: ${fbErr.message}`); continue; }
      feedbackId = fb.id;
      console.log(`   ✅ draft 생성: ${feedbackId}`);
    }

    // 기존 어노테이션 삭제
    await supabase.from('feedback_annotations').delete().eq('feedback_id', feedbackId);

    // 5차원 어노테이션 생성
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
          feedback_id: feedbackId,
          mission_id: mission.id,
          panel_id: panel.id,
          image_index: imgIdx,
          x_pct: box.x_pct,
          y_pct: box.y_pct,
          w_pct: box.w_pct,
          h_pct: box.h_pct,
          dimension: dim,
          score,
          comment: pickComment(dim, score),
        });
      }

      dimAvgScores[dim] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    const { error: annErr } = await supabase.from('feedback_annotations').insert(annotations);
    if (annErr) { console.error(`   ❌ 어노테이션 INSERT 실패: ${annErr.message}`); continue; }
    console.log(`   ✅ 어노테이션 ${annotations.length}개 (이미지 ${imageCount}장 분산)`);

    // suggestions 텍스트
    const suggestionLines = DIMENSIONS.map(dim => {
      const dimAnns = annotations.filter(a => a.dimension === dim);
      return `[${DIM_LABELS[dim]}]\n${dimAnns.map(a => a.comment).join('\n')}`;
    });
    const overallComment = pickOverall(quality, i);
    suggestionLines.push(`[총평]\n${overallComment}`);
    const suggestionsText = suggestionLines.join('\n');

    // custom_answers 생성
    let customAnswers = null;
    if (selectedQuestions.length > 0) {
      customAnswers = selectedQuestions.map((q, qIdx) => ({
        questionId: q.id || `q-${qIdx}`,
        questionText: q.text || q.question_text || '',
        type: q.type || q.question_type || 'text',
        answer: generateCustomAnswer(
          { type: q.type || q.question_type || 'text', options: q.options || [] },
          i,
          qIdx
        ),
      }));
      console.log(`   ✅ custom_answers ${customAnswers.length}개`);
    }

    // 피드백 제출
    const updatePayload = {
      status: 'submitted',
      clarity_score: dimAvgScores.clarity,
      relevance_score: dimAvgScores.relevance,
      value_score: dimAvgScores.value,
      differentiation_score: dimAvgScores.differentiation,
      trust_score: dimAvgScores.trust,
      suggestions: suggestionsText,
      strengths: null,
    };
    if (customAnswers) updatePayload.custom_answers = customAnswers;

    const { error: upErr } = await supabase
      .from('feedbacks')
      .update(updatePayload)
      .eq('id', feedbackId);

    if (upErr) { console.error(`   ❌ 피드백 UPDATE 실패: ${upErr.message}`); continue; }

    const scoreStr = DIMENSIONS.map(d => `${DIM_LABELS[d][0]}${dimAvgScores[d]}`).join(' ');
    console.log(`   ✅ 제출 — 점수: ${scoreStr}`);

    // RPC: filled_count +1
    if (!existing || existing.status === 'draft') {
      const { error: r1 } = await supabase.rpc('increment_mission_filled_count', { mission_id: mission.id });
      if (r1) console.warn(`   ⚠️  filled_count RPC: ${r1.message}`);
    }

    // RPC: total_missions +1
    const { error: r2 } = await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
    if (r2) console.warn(`   ⚠️  total_missions RPC: ${r2.message}`);

    // RPC: honor_points +5
    const { error: r3 } = await supabase.rpc('add_panel_honor_points', { p_panel_id: panel.id });
    if (r3) console.warn(`   ⚠️  honor_points RPC: ${r3.message}`);
    else console.log(`   ✅ honor_points +5`);

    successCount++;
  }

  // 최종 슬롯 확인
  const { data: finalM } = await supabase
    .from('missions')
    .select('filled_count, panel_count')
    .eq('id', mission.id)
    .single();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 완료: ${successCount}/9 패널 피드백 제출`);
  if (finalM) console.log(`   최종 슬롯: ${finalM.filled_count}/${finalM.panel_count}`);
}

main().catch(console.error);
