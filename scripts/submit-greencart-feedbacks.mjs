/**
 * GreenCart 미션 — 패널 10명 피드백 자동 제출 스크립트
 * 각 패널: 5대 지표 이미지 어노테이션(좌표+점수+코멘트) + 총평 포함하여 submitted 상태로 제출
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env.local 파일에서 환경변수 로드
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 한국어 코멘트 풀 (지표별 × 고/중/저) ──────────────────────────────────

const COMMENTS = {
  clarity: {
    high: [
      '헤더의 구독 혜택 설명이 매우 간결하고 명확합니다. 처음 보는 사람도 즉시 이해할 수 있어요.',
      '서비스 소개 섹션이 단계별로 잘 정리되어 있어 자연스럽게 읽힙니다.',
      '가격 플랜 표가 한눈에 들어오게 구성되어 있고 플랜 간 차이가 명확합니다.',
      '핵심 가치 제안이 히어로 영역에 큼직하게 표시되어 즉각 인지됩니다.',
    ],
    mid: [
      '핵심 메시지는 전달되지만 부가 정보가 너무 많아 집중이 분산됩니다.',
      '서비스 설명이 어느 정도 명확하지만 구체적인 예시가 부족합니다.',
      '글씨 크기 위계가 있어 읽히기는 하나 중요 정보가 묻히는 부분이 있습니다.',
      'CTA 근처 텍스트가 많아 버튼이 다소 묻혀 보입니다.',
    ],
    low: [
      '첫 화면에서 무엇을 제공하는 서비스인지 바로 파악하기 어렵습니다.',
      '구독 조건과 취소 정책이 눈에 잘 띄지 않아 혼란스럽습니다.',
      '텍스트가 너무 밀집되어 핵심 메시지가 희석됩니다.',
      '섹션 간 흐름이 끊겨 전체 서비스 개요를 파악하는 데 시간이 걸립니다.',
    ],
  },
  relevance: {
    high: [
      '타겟 고객인 건강 관심층에게 딱 맞는 언어와 이미지를 사용했습니다.',
      '환경 지속가능성 메시지가 타겟 페르소나의 가치관과 잘 맞아떨어집니다.',
      '정기구독 이용자들이 자주 갖는 걱정(취소 편의성)을 직접 언급해 공감을 얻습니다.',
      '20-40대 라이프스타일 이미지가 타겟과 일치해 자연스러운 동일시가 됩니다.',
    ],
    mid: [
      '전반적으로 타겟과 맞는 편이나 20-40대 폭이 넓어 핀포인트가 약합니다.',
      '건강·웰빙 키워드는 있으나 왜 GreenCart여야 하는지 설득력이 약합니다.',
      '라이프스타일 이미지는 타겟과 어느 정도 일치하지만 더 구체화가 필요합니다.',
      '환경 메시지가 있지만 실제 환경 관심층에게는 피상적으로 느껴질 수 있습니다.',
    ],
    low: [
      '타겟 고객의 일상과 연결되는 이미지나 카피가 부족합니다.',
      '환경·지속가능성 언급이 너무 일반적이어서 차별화가 느껴지지 않습니다.',
      '정기구독 경험자보다 처음 들어보는 사람 기준으로 쓰여 있어 타겟이 맞지 않습니다.',
      '사용된 모델과 배경이 타겟 페르소나와 거리감이 있습니다.',
    ],
  },
  value: {
    high: [
      '할인율과 무료 배송 혜택이 구체적인 금액으로 표시되어 가치가 잘 전달됩니다.',
      '구독 시 받는 혜택이 리스트업되어 비용 대비 효익이 명확합니다.',
      '첫 달 무료 체험 제안이 전환 장벽을 크게 낮춰줍니다.',
      '월 절약 금액을 직접 계산해 보여주는 섹션이 구매 의사결정을 돕습니다.',
    ],
    mid: [
      '가격은 적시되어 있으나 같은 가격으로 얻는 가치 설명이 부족합니다.',
      '혜택 목록은 있으나 경쟁사 대비 우위가 드러나지 않습니다.',
      '할인 비율이 표시되어 있으나 원가 정보가 없어 와닿지 않습니다.',
      '혜택이 나열되어 있지만 실제로 나에게 얼마나 도움이 될지 체감하기 어렵습니다.',
    ],
    low: [
      '구독 요금 대비 무엇을 얼마나 받는지 불명확합니다.',
      '혜택이 추상적으로 서술되어 실제 가치 판단이 어렵습니다.',
      '타 구독 서비스와 비교했을 때 가격 경쟁력이 느껴지지 않습니다.',
      '비용 절감 효과를 구체적 수치로 보여주지 않아 설득력이 부족합니다.',
    ],
  },
  differentiation: {
    high: [
      '친환경 포장 + 지역 농가 직거래 조합이 타 서비스와 확실히 차별화됩니다.',
      '탄소 절감 수치를 구체적으로 제시한 부분이 독창적입니다.',
      '월별 테마 큐레이션 기능이 일반 정기배송과 차별화되는 강점으로 잘 부각됩니다.',
      '지역 농가 스토리 섹션이 감성적 차별화를 만들어냅니다.',
    ],
    mid: [
      '친환경 강조는 있으나 실제 실행 증거가 부족해 차별화가 약하게 느껴집니다.',
      '경쟁 서비스와 비슷한 혜택을 비슷한 방식으로 제시하고 있습니다.',
      '자체 브랜드 제품 비중과 큐레이션 기준이 더 명확했으면 차별화가 강해질 것 같습니다.',
      '독자적 기술이나 프로세스에 대한 설명이 있으면 차별화가 명확해질 것입니다.',
    ],
    low: [
      '마켓컬리·쿠팡프레시 등 기존 서비스와 차이점이 거의 보이지 않습니다.',
      '친환경 메시지는 많은 브랜드가 사용하는 문구라 특별함이 느껴지지 않습니다.',
      '정기구독의 편리함만 강조하고 이 브랜드만의 고유 가치가 없습니다.',
      '"친환경" 외에 다른 차별화 요소가 보이지 않습니다.',
    ],
  },
  trust: {
    high: [
      '실제 구독자 리뷰와 별점이 신뢰도를 크게 높여줍니다.',
      '수상 이력과 언론 보도 로고 배치가 공신력을 더해줍니다.',
      '환불 보장 정책이 명시되어 있어 첫 구매 진입 장벽을 낮춥니다.',
      '실명·직업 공개 리뷰어 인터뷰가 진정성 있게 느껴집니다.',
    ],
    mid: [
      '후기 섹션은 있으나 사진 없는 텍스트 위주라 신뢰도가 조금 부족합니다.',
      '사업자 정보와 인증 마크가 있으나 눈에 잘 띄지 않습니다.',
      '고객 지원 연락처가 하단에 작게 표시되어 있어 찾기 어렵습니다.',
      '후기 수가 적어 사회적 증거로서 효과가 제한적입니다.',
    ],
    low: [
      '후기나 사회적 증거가 거의 없어 처음 방문자에게 신뢰가 생기지 않습니다.',
      '개인정보 처리방침 링크가 눈에 보이지 않아 불안합니다.',
      '결제 보안 마크나 SSL 인증 표시가 없어 결제를 망설이게 됩니다.',
      '브랜드 히스토리나 운영 주체에 대한 정보가 전혀 없습니다.',
    ],
  },
};

const OVERALL_COMMENTS = [
  'GreenCart의 LP는 전반적으로 친환경 정기구독이라는 컨셉을 잘 전달하고 있습니다. 다만 경쟁사 대비 차별화 포인트를 더 구체적인 수치와 사례로 보강한다면 전환율이 올라갈 것 같습니다. 첫 달 무료 혜택이 가장 인상적이었고, 탄소 절감 수치 시각화는 독창적인 시도입니다.',
  '타겟 고객군(건강·환경 관심 20-40대)에게 적합한 톤앤매너를 갖추고 있으며 비주얼 완성도도 높습니다. 다만 CTA 버튼이 한 개뿐이라 상단과 중간에도 구독 유도 포인트를 추가하면 좋을 것 같습니다. 모바일에서 이미지 로딩이 느리게 느껴질 수 있는 점도 개선이 필요합니다.',
  '처음 랜딩했을 때 "이 서비스가 나에게 필요한가"를 빠르게 판단하기 어렵습니다. 헤더 카피를 고객 언어로 바꾸고, 주요 혜택 3가지를 아이콘과 함께 첫 화면에 배치한다면 체류 시간과 전환율이 모두 개선될 것입니다. 신뢰 요소는 보강이 필요합니다.',
  '전반적으로 완성도 높은 LP입니다. 환경 지속가능성 메시지가 전반에 일관되게 흐르고 있고 가격 플랜이 명확하게 제시되어 있어 의사결정을 돕습니다. 추가로 구독 해지 시나리오에 대한 안내를 더 눈에 띄게 배치하면 망설이는 고객의 불안을 줄일 수 있습니다.',
  '이 LP에서 가장 잘 된 부분은 사회적 증거(리뷰, 언론 보도) 섹션입니다. 반면 가격 가치 전달이 약해서 "왜 이 가격을 내야 하는지"에 대한 설득이 부족합니다. 타겟 고객의 일상 속 페인포인트를 스토리 형식으로 풀어낸다면 공감대 형성에 도움이 될 것입니다.',
  '모바일 최적화가 잘 되어 있으며 스크롤 경험이 자연스럽습니다. 그러나 핵심 차별화인 "지역 농가 직거래" 스토리가 충분히 강조되지 않아 아쉽습니다. 농가 사진과 스토리를 추가하면 감성적 연결고리가 형성되어 정기구독 전환에 효과적일 것입니다.',
  '전반적으로 깔끔하고 신뢰감 있는 디자인입니다. 명확성 측면에서 서비스 설명이 간결하지만 구독 플랜 간 차이를 비교하는 테이블이 있으면 더 좋겠습니다. 첫인상에서 느껴지는 브랜드 아이덴티티가 일관성 있게 유지되고 있어 긍정적입니다.',
  '구독 신청 프로세스가 몇 단계인지, 배송 주기를 어떻게 조절하는지에 대한 안내가 보이지 않습니다. 구독 신청 전 고객이 궁금해할 사항들을 FAQ로 추가하면 이탈률을 줄일 수 있습니다. 비주얼 완성도는 높으나 정보 아키텍처 개선이 필요합니다.',
  'GreenCart의 핵심 가치인 건강과 지속가능성이 잘 전달됩니다. 특히 탄소 절감 수치 시각화 섹션이 인상적이며 브랜드 신뢰도를 높입니다. 다만 페이지 중간 부분에서 스크롤 피로가 생기므로, 콘텐츠 밀도를 줄이고 여백을 더 활용하면 가독성이 향상될 것입니다.',
  '타겟 고객의 언어를 잘 사용하고 있으며 CTA 문구가 명확합니다. 신뢰 요소로 후기와 별점이 있는 것은 좋지만 구체적인 사용 사례나 비포/애프터 스토리가 있다면 더욱 설득력이 생길 것입니다. 가격 대비 가치 전달을 더 강화하면 전환율이 높아질 것 같습니다.',
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

// 이미지 내 무작위 드래그 영역 (% 단위, 경계 초과 방지)
function randomBox() {
  const x = randFloat(5, 55);
  const y = randFloat(5, 55);
  const w = randFloat(15, 35);
  const h = randFloat(10, 25);
  return {
    x_pct: x,
    y_pct: y,
    w_pct: Math.min(w, 94 - x),
    h_pct: Math.min(h, 94 - y),
  };
}

function pickComment(dim, score) {
  const bucket = score >= 4 ? 'high' : score >= 3 ? 'mid' : 'low';
  const pool = COMMENTS[dim][bucket];
  return randItem(pool);
}

const DIM_LABELS = {
  clarity: '명확성',
  relevance: '관련성',
  value: '가치',
  differentiation: '차별화',
  trust: '신뢰',
};
const DIMENSIONS = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GreenCart 미션 피드백 자동 생성 ===\n');

  // 1. 미션 조회
  const { data: missionRows, error: mErr } = await supabase
    .from('missions')
    .select('id, title, image_urls, panel_count, filled_count')
    .ilike('title', '%GreenCart%');

  if (mErr) { console.error('미션 조회 오류:', mErr.message); return; }
  if (!missionRows || missionRows.length === 0) { console.error('GreenCart 미션을 찾을 수 없습니다.'); return; }

  const mission = missionRows[0];
  console.log(`✅ 미션: "${mission.title}"`);
  console.log(`   id: ${mission.id}`);
  console.log(`   이미지 수: ${(mission.image_urls || []).length}`);
  console.log(`   슬롯: ${mission.filled_count}/${mission.panel_count}\n`);

  // 2. panel1~panel10 유저 조회
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 목록 오류:', uErr.message); return; }

  const panelUsers = users
    .filter(u => /^panel\d+@purit\.io$/.test(u.email || ''))
    .sort((a, b) => {
      const na = parseInt(a.email.match(/\d+/)[0], 10);
      const nb = parseInt(b.email.match(/\d+/)[0], 10);
      return na - nb;
    });

  console.log(`✅ 패널 계정 ${panelUsers.length}개 확인\n`);

  // 3. panels 레코드 매핑
  const { data: panelRecords, error: pErr } = await supabase
    .from('panels')
    .select('id, user_id, name')
    .in('user_id', panelUsers.map(u => u.id));

  if (pErr) { console.error('panels 조회 오류:', pErr.message); return; }

  const panelByUserId = {};
  panelRecords.forEach(p => { panelByUserId[p.user_id] = p; });

  // 4. 각 패널 피드백 생성
  let successCount = 0;

  for (let i = 0; i < panelUsers.length; i++) {
    const user = panelUsers[i];
    const panel = panelByUserId[user.id];

    console.log(`\n[${i + 1}/10] ${user.email}`);

    if (!panel) {
      console.log(`   ⚠️  panels 레코드 없음, 건너뜀`);
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
      // draft 재사용
      feedbackId = existing.id;
      console.log(`   기존 draft 재사용: ${feedbackId}`);
    } else {
      // 새 draft 생성
      const { data: fb, error: fbErr } = await supabase
        .from('feedbacks')
        .insert({ mission_id: mission.id, panel_id: panel.id, status: 'draft', purity_passed: false })
        .select('id')
        .single();

      if (fbErr) { console.error(`   ❌ feedback INSERT 실패: ${fbErr.message}`); continue; }
      feedbackId = fb.id;
      console.log(`   ✅ draft 피드백 생성: ${feedbackId}`);
    }

    // 기존 어노테이션 삭제 (재시도 시 중복 방지)
    await supabase.from('feedback_annotations').delete().eq('feedback_id', feedbackId);

    // 5개 지표 어노테이션 생성 (지표당 1~2개)
    const annotations = [];
    const dimAvgScores = {};

    for (const dim of DIMENSIONS) {
      const count = randInt(1, 2);
      const scores = [];

      for (let k = 0; k < count; k++) {
        // 패널마다 약간씩 다른 점수 분포 (i 기반 seed)
        const baseScore = ((i + k) % 3 === 0) ? randInt(2, 3) : randInt(3, 5);
        scores.push(baseScore);
        const box = randomBox();
        annotations.push({
          feedback_id: feedbackId,
          mission_id: mission.id,
          panel_id: panel.id,
          image_index: 0,
          x_pct: box.x_pct,
          y_pct: box.y_pct,
          w_pct: box.w_pct,
          h_pct: box.h_pct,
          dimension: dim,
          score: baseScore,
          comment: pickComment(dim, baseScore),
        });
      }

      dimAvgScores[dim] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    const { error: annErr } = await supabase.from('feedback_annotations').insert(annotations);
    if (annErr) { console.error(`   ❌ 어노테이션 INSERT 실패: ${annErr.message}`); continue; }
    console.log(`   ✅ 어노테이션 ${annotations.length}개 (5대 지표)`);

    // suggestions 텍스트 조합 (지표별 코멘트 + 총평)
    const suggestionLines = DIMENSIONS.map(dim => {
      const dimAnns = annotations.filter(a => a.dimension === dim);
      const comments = dimAnns.map(a => a.comment).join('\n');
      return `[${DIM_LABELS[dim]}]\n${comments}`;
    });
    const overallComment = OVERALL_COMMENTS[i % OVERALL_COMMENTS.length];
    suggestionLines.push(`[총평]\n${overallComment}`);
    const suggestionsText = suggestionLines.join('\n');

    // 피드백 제출 (submitted)
    const { error: upErr } = await supabase
      .from('feedbacks')
      .update({
        status: 'submitted',
        clarity_score: dimAvgScores.clarity,
        relevance_score: dimAvgScores.relevance,
        value_score: dimAvgScores.value,
        differentiation_score: dimAvgScores.differentiation,
        trust_score: dimAvgScores.trust,
        suggestions: suggestionsText,
        strengths: null,
      })
      .eq('id', feedbackId);

    if (upErr) { console.error(`   ❌ 피드백 UPDATE 실패: ${upErr.message}`); continue; }

    const scoreStr = DIMENSIONS.map(d => `${DIM_LABELS[d][0]}${dimAvgScores[d]}`).join(' ');
    console.log(`   ✅ 제출 완료 — 점수: ${scoreStr}`);

    // RPC 호출
    const { error: r1 } = await supabase.rpc('increment_mission_filled_count', { mission_id: mission.id });
    if (r1) console.warn(`   ⚠️  filled_count RPC: ${r1.message}`);

    const { error: r2 } = await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
    if (r2) console.warn(`   ⚠️  total_missions RPC: ${r2.message}`);

    const { error: r3 } = await supabase.rpc('update_panel_gamification', { p_panel_id: panel.id });
    if (r3) console.warn(`   ⚠️  gamification RPC: ${r3.message}`);

    successCount++;
  }

  // 최종 미션 상태 확인
  const { data: finalMission } = await supabase
    .from('missions')
    .select('filled_count, panel_count')
    .eq('id', mission.id)
    .single();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`🎉 완료: ${successCount}/10 패널 피드백 제출`);
  if (finalMission) {
    console.log(`   미션 슬롯: ${finalMission.filled_count}/${finalMission.panel_count}`);
  }
}

main().catch(console.error);
