/**
 * 2026-05-18 생성 메인 의뢰 3개 × 패널 1~10 피드백 자동 생성
 * - 5차원 이미지/텍스트 어노테이션 + 총평 + LP 추가 질문 응답
 * - 신뢰(trust) 점수만 완전 랜덤(1~5), 나머지는 패널 품질 티어 기반
 * - 너무 완벽하지 않게: 패널별 품질 혼합 (low/mid/high 혼재)
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

// ── 차원별 코멘트 풀 ──────────────────────────────────────────────────────────

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
      '일반적인 B2B 마케팅 문구라 이 분야 특유의 공감대가 없습니다.',
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
      '정량적 5차원 평가 프레임이 독자적인 방법론으로 분명히 부각됩니다.',
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
      '차별화 메시지가 없어 다른 마케팅 리서치 플랫폼과 혼동됩니다.',
    ],
  },
  trust: {
    high: [
      '실제 도입 기업 사례와 구체적인 전환율 개선 수치가 신뢰도를 크게 높입니다.',
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

// ── 총평 풀 ───────────────────────────────────────────────────────────────────

const OVERALL_HIGH = [
  '전반적으로 CRO SaaS의 핵심 가치를 잘 전달하고 있습니다. "실제 타겟 패널"이라는 차별화 포인트가 인상적이며, 5차원 평가 프레임이 독창적입니다. 다만 히어로 섹션의 카피를 고객 언어로 좀 더 바꾸고 상단에 구체적인 전환율 개선 수치를 배치한다면 즉각적인 관심 유도에 효과적일 것입니다.',
  '타겟 고객(B2B SaaS 마케터)의 페인포인트를 적절히 짚어주고 있고 비주얼 완성도가 높습니다. CTA 버튼이 하단에만 있어 스크롤 없이 상단에서도 전환 유도가 필요해 보입니다. 패널 NDA 보장 문구가 기업 고객의 정보 보안 불안을 직접 해소해주는 것이 인상적이었습니다.',
  '처음 랜딩했을 때 "이 서비스가 나의 전환율 문제를 어떻게 해결해주는가"를 5초 안에 파악하기가 약간 어렵습니다. 히어로 섹션 헤드라인을 결과 중심으로 바꾼다면 체류 시간이 늘어날 것 같습니다. 신뢰 요소 보강이 가장 시급해 보입니다.',
  '5차원 평가 방법론이 페이지 전반에 일관되게 표현되어 있고, 가격 플랜 비교 테이블이 명확해 의사결정을 돕습니다. 무료 체험이나 파일럿 제안 섹션이 추가된다면 도입 장벽을 낮출 수 있을 것입니다.',
  '이 LP에서 가장 잘 된 부분은 어노테이션 기반 피드백 시스템 소개입니다. 경쟁사들이 보여주지 못하는 독자적인 방법론이 설득력 있게 전달됩니다. 반면 가격 가치 전달이 약해서 구체적인 ROI 계산 섹션이 추가되면 전환율이 높아질 것입니다.',
  '전반적으로 깔끔하고 전문적인 디자인입니다. 플랜 간 차이가 명확하게 표현되어 있어 구독 플랜 선택이 어렵지 않습니다. 실 고객 인터뷰 영상이나 짧은 사용 데모가 추가되면 전환율이 더 올라갈 것입니다.',
  '타겟 고객의 언어를 잘 사용하고 있으며 각 섹션 CTA 문구가 명확합니다. 도입 기업 구체 사례(업종, 개선 수치)와 30일 무료 체험 제안이 추가된다면 망설이는 고객의 최종 전환에 결정적인 역할을 할 것입니다.',
];

const OVERALL_MID = [
  '서비스의 방향성은 이해되지만 방문자가 즉시 가치를 체감하기에는 설명이 다소 부족합니다. 고객 도입 사례나 효과 데이터가 보강되면 설득력이 올라갈 것 같습니다.',
  '전반적인 구성은 무난하지만 경쟁 서비스 대비 차별점이 더 강조될 필요가 있습니다. 각 섹션 메시지를 명확하게 수정하면 방문자 이탈을 줄이는 데 도움이 될 것입니다.',
  '서비스의 특징은 파악되지만 처음 방문한 사람이 왜 이 서비스를 선택해야 하는지 설득이 약합니다. 고객 후기나 비교 정보를 추가하면 의사결정에 도움이 될 것입니다.',
  '랜딩페이지의 첫인상은 좋지만 핵심 가치 메시지가 더 앞에 배치될 필요가 있습니다.',
  '서비스 컨셉과 기능은 이해됩니다. 다만 방문자가 즉각적으로 기억할 만한 핵심 메시지가 좀 더 강조되면 좋겠다는 느낌을 받았습니다.',
];

const OVERALL_LOW = [
  '랜딩페이지를 전반적으로 살펴봤는데 크게 문제될 부분은 없어 보입니다. 서비스의 방향성이 잘 잡혀 있다고 생각됩니다.',
  '전체적인 구성이 깔끔하게 정리되어 있어서 보기에 좋습니다. 방문자에게 서비스가 무난하게 전달될 것이라 판단됩니다.',
  '서비스 소개가 기본적인 역할은 충분히 하고 있습니다. 전체적으로 무난하게 잘 되어있다고 생각됩니다.',
];

// ── 패널별 품질 티어 (신뢰도 점수 다양성을 위해 의도적 혼합) ─────────────────
// 인덱스: 0~9 = panel1~panel10
const PANEL_QUALITY = [
  'mid',   // panel1
  'high',  // panel2
  'low',   // panel3
  'high',  // panel4
  'mid',   // panel5
  'low',   // panel6
  'high',  // panel7
  'mid',   // panel8
  'high',  // panel9
  'mid',   // panel10
];

// ── 추가 질문 답변 풀 ──────────────────────────────────────────────────────────

const SCALE_ANSWERS = [
  [3, 2, 3, 2, 3],
  [4, 5, 4, 4, 3],
  [3, 3, 4, 3, 3],
  [5, 4, 5, 4, 5],
  [3, 4, 3, 4, 4],
  [2, 3, 3, 2, 3],
  [4, 4, 3, 4, 4],
  [3, 3, 3, 3, 4],
  [5, 5, 4, 5, 4],
  [4, 3, 4, 3, 3],
];

const RADIO_OPTION_PICKS = [1, 0, 1, 0, 2, 1, 0, 3, 0, 1];

const TEXT_ANSWERS = [
  '구체적인 ROI 수치와 실제 도입 기업의 전환율 개선 사례가 없어 가격 대비 효과를 판단하기 어렵습니다.',
  '서비스 결과물(리포트, 대시보드)의 실제 샘플이 없어 도입 후 어떤 인사이트를 얻을 수 있는지 막막합니다.',
  '패널의 전문성과 선발 기준이 명확하지 않아 피드백의 품질을 신뢰하기 어렵습니다.',
  '경쟁사와의 비교 없이는 가격 경쟁력을 판단할 수 없습니다.',
  '무료 체험이나 소규모 파일럿 없이 구독을 결정하기에는 초기 비용 부담이 있습니다.',
  '5차원 평가 프레임이 우리 서비스에 어떻게 맞춤 적용되는지 구체적인 설명이 없습니다.',
  '피드백 수집부터 최종 리포트까지 소요 기간이 명시되어 있지 않아 의사결정이 어렵습니다.',
  '어드민 대시보드나 실제 사용 화면 없이 기능만 나열되어 있어 실사용 경험을 상상하기 어렵습니다.',
  '구독 취소 정책과 환불 조건이 눈에 잘 띄지 않아 계약 리스크가 느껴집니다.',
  '팀 구성원의 접근 권한 관리나 협업 기능에 대한 설명이 없어 팀 도입을 고려하기 어렵습니다.',
];

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

// 차원별 점수 선택 (신뢰 차원은 완전 랜덤)
function pickDimScore(panelIdx, dim) {
  // 신뢰 차원: 완전 랜덤 1~5
  if (dim === 'trust') return randInt(1, 5);

  const q = PANEL_QUALITY[panelIdx % PANEL_QUALITY.length];
  if (q === 'low')  return randInt(1, 3);
  if (q === 'high') return randInt(3, 5);
  // mid
  return randInt(2, 4);
}

function pickOverall(panelIdx) {
  const q = PANEL_QUALITY[panelIdx % PANEL_QUALITY.length];
  if (q === 'low')  return OVERALL_LOW[panelIdx % OVERALL_LOW.length];
  if (q === 'high') return OVERALL_HIGH[panelIdx % OVERALL_HIGH.length];
  return OVERALL_MID[panelIdx % OVERALL_MID.length];
}

function generateCustomAnswer(question, panelIndex, qIndex) {
  const type = question.type || 'text';
  const scaleRow = SCALE_ANSWERS[panelIndex % SCALE_ANSWERS.length];

  if (type === 'scale') {
    return String(scaleRow[qIndex % scaleRow.length]);
  } else if (type === 'radio') {
    const options = question.options || [];
    if (options.length === 0) return '해당 없음';
    const pickIdx = RADIO_OPTION_PICKS[panelIndex % RADIO_OPTION_PICKS.length] % options.length;
    return options[pickIdx];
  } else {
    return TEXT_ANSWERS[panelIndex % TEXT_ANSWERS.length];
  }
}

const DIM_LABELS = {
  clarity: '명확성',
  relevance: '관련성',
  value: '가치',
  differentiation: '차별화',
  trust: '신뢰',
};
const DIMENSIONS = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];

// ── 미션 1개에 대해 패널 1~10 피드백 생성 ────────────────────────────────────

async function submitFeedbacksForMission(mission, panelUsers, panelByUserId) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📌 미션: "${mission.title}"`);
  console.log(`   id: ${mission.id}`);
  console.log(`   이미지 수: ${(mission.image_urls || []).length}`);
  console.log(`   슬롯: ${mission.filled_count}/${mission.panel_count}`);

  // LP 질문 파싱
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
  } catch {
    console.log('   ℹ️  description 파싱 불가 — 추가 질문 없음');
  }

  if (selectedQuestions.length > 0) {
    console.log(`   📝 LP 추가 질문 ${selectedQuestions.length}개`);
  }

  const imageCount = (mission.image_urls || []).length || 0;
  const hasImages = imageCount > 0;

  let successCount = 0;

  for (let i = 0; i < panelUsers.length; i++) {
    const user = panelUsers[i];
    const panel = panelByUserId[user.id];

    if (!panel) {
      console.log(`\n   [${i + 1}/10] ${user.email} — panels 레코드 없음, 건너뜀`);
      continue;
    }

    console.log(`\n   [${i + 1}/10] ${user.email} (${panel.name || '이름 없음'})`);

    // 기존 피드백 확인
    const { data: existing } = await supabase
      .from('feedbacks')
      .select('id, status')
      .eq('mission_id', mission.id)
      .eq('panel_id', panel.id)
      .maybeSingle();

    if (existing && existing.status === 'submitted') {
      console.log(`      ⏩ 이미 제출됨, 건너뜀`);
      successCount++;
      continue;
    }

    let feedbackId;

    if (existing) {
      feedbackId = existing.id;
      console.log(`      기존 draft 재사용: ${feedbackId.slice(0, 8)}...`);
    } else {
      const { data: fb, error: fbErr } = await supabase
        .from('feedbacks')
        .insert({ mission_id: mission.id, panel_id: panel.id, status: 'draft', purity_passed: false })
        .select('id')
        .single();

      if (fbErr) { console.error(`      ❌ feedback INSERT 실패: ${fbErr.message}`); continue; }
      feedbackId = fb.id;
    }

    // 기존 어노테이션 삭제
    if (hasImages) {
      await supabase.from('feedback_annotations').delete().eq('feedback_id', feedbackId);
    }

    // 5차원 점수 계산 (신뢰는 랜덤)
    const dimAvgScores = {};
    const annotations = [];

    for (const dim of DIMENSIONS) {
      const score = pickDimScore(i, dim);
      dimAvgScores[dim] = score;

      if (hasImages) {
        // 이미지 어노테이션 1~2개
        const count = randInt(1, 2);
        for (let k = 0; k < count; k++) {
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
      }
    }

    // 어노테이션 INSERT (이미지 미션만)
    if (hasImages && annotations.length > 0) {
      const { error: annErr } = await supabase.from('feedback_annotations').insert(annotations);
      if (annErr) { console.error(`      ❌ 어노테이션 INSERT 실패: ${annErr.message}`); continue; }
      console.log(`      ✅ 어노테이션 ${annotations.length}개`);
    }

    // suggestions 텍스트 구성
    let suggestionsText;
    if (hasImages) {
      const lines = DIMENSIONS.map(dim => {
        const dimAnns = annotations.filter(a => a.dimension === dim);
        return `[${DIM_LABELS[dim]}]\n${dimAnns.map(a => a.comment).join('\n')}`;
      });
      lines.push(`[총평]\n${pickOverall(i)}`);
      suggestionsText = lines.join('\n');
    } else {
      // 텍스트 미션 포맷
      const lines = DIMENSIONS.map(dim =>
        `[${DIM_LABELS[dim]}]\n${pickComment(dim, dimAvgScores[dim])}`
      );
      lines.push(`[총평]\n${pickOverall(i)}`);
      suggestionsText = lines.join('\n\n');
    }

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

    if (upErr) { console.error(`      ❌ 피드백 UPDATE 실패: ${upErr.message}`); continue; }

    const scoreStr = DIMENSIONS.map(d => `${DIM_LABELS[d][0]}${dimAvgScores[d]}`).join(' ');
    console.log(`      ✅ 제출 완료 — ${scoreStr} (신뢰: ${dimAvgScores.trust})`);

    // RPC 호출
    const { error: r1 } = await supabase.rpc('increment_mission_filled_count', { mission_id: mission.id });
    if (r1) console.warn(`      ⚠️  filled_count RPC: ${r1.message}`);

    const { error: r2 } = await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
    if (r2) console.warn(`      ⚠️  total_missions RPC: ${r2.message}`);

    const { error: r3 } = await supabase.rpc('add_panel_honor_points', { p_panel_id: panel.id });
    if (r3) console.warn(`      ⚠️  honor_points RPC: ${r3.message}`);
    else console.log(`      ✅ honor_points +5`);

    successCount++;
  }

  return successCount;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== 2026-05-18 생성 메인 의뢰 3개 × 패널 10명 피드백 자동 생성 ===\n');

  // 1. admin 계정의 company_id 조회
  const { data: { users: allUsers }, error: uListErr } = await supabase.auth.admin.listUsers();
  if (uListErr) { console.error('유저 목록 오류:', uListErr.message); return; }

  const adminUser = allUsers.find(u => u.email === 'purit.admin@gmail.com');
  if (!adminUser) { console.error('❌ purit.admin@gmail.com 계정을 찾을 수 없습니다.'); return; }

  console.log(`✅ 어드민 계정: ${adminUser.email} (${adminUser.id.slice(0, 8)}...)`);

  const { data: adminCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', adminUser.id)
    .maybeSingle();

  if (!adminCompany) { console.error('❌ 어드민 companies 레코드 없음'); return; }
  console.log(`✅ 어드민 company_id: ${adminCompany.id.slice(0, 8)}...`);

  // 2. 5/18 생성 메인 의뢰 조회
  const { data: missions, error: mErr } = await supabase
    .from('missions')
    .select('id, title, image_urls, panel_count, filled_count, description, type, created_at, status')
    .eq('company_id', adminCompany.id)
    .or('type.is.null,type.eq.landing_page')
    .neq('status', 'draft')
    .gte('created_at', '2026-05-18T00:00:00.000Z')
    .lte('created_at', '2026-05-18T23:59:59.999Z')
    .order('created_at', { ascending: true });

  if (mErr) { console.error('미션 조회 오류:', mErr.message); return; }
  if (!missions || missions.length === 0) {
    console.error('❌ 2026-05-18 생성 메인 의뢰가 없습니다.');
    return;
  }

  console.log(`\n📋 5/18 메인 의뢰 ${missions.length}개:`);
  missions.forEach((m, i) => {
    console.log(`  [${i + 1}] "${m.title}" — status:${m.status}, 이미지:${(m.image_urls || []).length}장, 슬롯:${m.filled_count}/${m.panel_count}`);
  });

  if (missions.length < 3) {
    console.warn(`\n⚠️  3개보다 적습니다(${missions.length}개). 발견된 의뢰 모두 처리합니다.`);
  }

  const targetMissions = missions.slice(0, 3);

  // 3. 패널 계정 조회
  const panelUsers = allUsers
    .filter(u => /^panel\d+@purit\.io$/.test(u.email || ''))
    .sort((a, b) => {
      const na = parseInt(a.email.match(/\d+/)[0], 10);
      const nb = parseInt(b.email.match(/\d+/)[0], 10);
      return na - nb;
    });

  console.log(`\n✅ 패널 계정 ${panelUsers.length}개 확인`);

  const { data: panelRecords, error: pErr } = await supabase
    .from('panels')
    .select('id, user_id, name')
    .in('user_id', panelUsers.map(u => u.id));

  if (pErr) { console.error('panels 조회 오류:', pErr.message); return; }

  const panelByUserId = {};
  panelRecords.forEach(p => { panelByUserId[p.user_id] = p; });

  // 4. 각 미션 처리
  let totalSuccess = 0;
  for (const mission of targetMissions) {
    const count = await submitFeedbacksForMission(mission, panelUsers, panelByUserId);
    totalSuccess += count;
  }

  // 5. 최종 결과
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 완료: 총 ${totalSuccess}개 피드백 처리 (목표: ${targetMissions.length * panelUsers.length}개)`);

  for (const m of targetMissions) {
    const { data: fm } = await supabase
      .from('missions')
      .select('filled_count, panel_count')
      .eq('id', m.id)
      .single();
    if (fm) console.log(`   "${m.title}": ${fm.filled_count}/${fm.panel_count} 슬롯`);
  }
}

main().catch(console.error);
