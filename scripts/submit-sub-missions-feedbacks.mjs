/**
 * 어드민 기업 계정의 서브 의뢰(소재비교·가격검증·이메일검증) 8개
 * × 패널 1~9 피드백 자동 생성 (의뢰당 9개 피드백)
 *
 * - 퓨릿 필터 점수가 완전 랜덤 분포 (low/mid/high 패널 프로필 혼합)
 * - 모든 커스텀 질문에 타입별 응답 생성
 * - INSERT 실패 시 UPDATE fallback (중복 방지)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── 환경변수 로드 ──────────────────────────────────────────────────────────────
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
// 패널 1~9 프로필 (퓨릿 점수 분포 랜덤성 확보)
// ══════════════════════════════════════════════════════════════

const PANEL_PROFILES = [
  // idx 0 (panel1): 꼼꼼한 비판적 평가자 → 낮은 점수, 긴 코멘트
  { scoreBase: [2,3,2,3,2], preferVariant: 'A', wouldBuy: false, wouldReply: false, commentStyle: 'critical' },
  // idx 1 (panel2): 긍정적 얼리어답터 → 높은 점수, 구체적 코멘트
  { scoreBase: [4,5,4,4,5], preferVariant: 'B', wouldBuy: true,  wouldReply: true,  commentStyle: 'positive' },
  // idx 2 (panel3): 중립적 실용주의자 → 중간 점수
  { scoreBase: [3,3,4,3,3], preferVariant: 'A', wouldBuy: true,  wouldReply: false, commentStyle: 'neutral' },
  // idx 3 (panel4): 열정적 지지자 → 높은 점수, 상세 코멘트
  { scoreBase: [5,4,5,5,4], preferVariant: 'A', wouldBuy: true,  wouldReply: true,  commentStyle: 'enthusiast' },
  // idx 4 (panel5): 가성비 중시 → 중간 점수
  { scoreBase: [3,4,3,4,4], preferVariant: 'B', wouldBuy: true,  wouldReply: true,  commentStyle: 'practical' },
  // idx 5 (panel6): 회의적 분석가 → 낮은 점수, 짧은 코멘트
  { scoreBase: [2,2,3,2,3], preferVariant: 'B', wouldBuy: false, wouldReply: false, commentStyle: 'skeptic' },
  // idx 6 (panel7): 디자인 민감 → 높은 점수
  { scoreBase: [4,4,3,4,4], preferVariant: 'A', wouldBuy: true,  wouldReply: true,  commentStyle: 'design' },
  // idx 7 (panel8): 데이터 지향 → 중간 점수, 구체적 수치 언급
  { scoreBase: [3,3,3,3,4], preferVariant: 'B', wouldBuy: false, wouldReply: true,  commentStyle: 'data' },
  // idx 8 (panel9): 브랜드 신뢰 중시 → 높은 점수
  { scoreBase: [5,5,4,4,5], preferVariant: 'A', wouldBuy: true,  wouldReply: true,  commentStyle: 'brand' },
];

// ══════════════════════════════════════════════════════════════
// 서브 미션 코멘트 풀
// ══════════════════════════════════════════════════════════════

// preference: [선택 소재, 코멘트]
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
];

// pricing 코멘트
const PRICING_COMMENTS = [
  '가격 대비 제공 가치가 명확하게 표현되어 있습니다. 다만 실제 사용 사례가 없어 추상적으로 느껴집니다.',
  '요금제 구성이 직관적이고 비교하기 쉽습니다. 엔터프라이즈 가격 공개가 되면 더 좋을 것 같습니다.',
  '무료 체험 기간이 결제 진입 장벽을 낮추는 데 효과적입니다. 취소가 쉽다는 안내도 도움이 됩니다.',
  '중간 요금제의 기능 차별화가 업그레이드를 자연스럽게 유도합니다. 가격이 조금 더 저렴했으면 합니다.',
  '가격 정책은 합리적이지만 경쟁사 대비 비교가 없어 상대적 가치 판단이 어렵습니다.',
  '환불 보장 정책이 있어 리스크 없이 시작할 수 있다는 느낌이 좋습니다.',
  '월간/연간 옵션과 절감액이 명확해서 연간 구독을 고려하게 됩니다.',
  '최고가 요금제의 차별화 기능이 충분히 매력적으로 표현되지 않았습니다. 실제 ROI 수치가 있으면 설득력이 올라갈 것 같습니다.',
  '가격 표현 방식이 깔끔하고 비교가 쉽습니다. 학생/스타트업 할인 옵션이 있으면 더 좋겠습니다.',
];

// email 코멘트
const EMAIL_COMMENTS = [
  '제목에서 즉각적인 호기심이 생겼습니다. 본문이 간결하면서도 핵심을 잘 짚어 읽기 편했습니다.',
  '개인화된 느낌이 강해서 스팸으로 느껴지지 않았습니다. CTA가 명확하고 부담스럽지 않습니다.',
  '문제 제기 → 해결책 → CTA 구조가 논리적이고 설득력이 있습니다. 발신자 신원이 명확한 점도 좋습니다.',
  '통계와 구체적인 수치가 신뢰를 줍니다. 이런 증거 기반 접근이 B2B 이메일에서 특히 효과적입니다.',
  '본문 길이가 적절해서 바쁜 독자도 끝까지 읽을 수 있을 것 같습니다. CTA 문구가 더 구체적이면 좋겠습니다.',
  '제목이 직접적인 질문 형태라 나를 위한 메일인지 빠르게 판단하게 해줍니다.',
  '감성적 톤이 브랜드와 잘 맞고 부담 없이 읽힙니다. 긴급성 요소가 추가되면 전환율이 올라갈 것 같습니다.',
  '발신자 소개가 자연스럽고 과도한 영업 느낌이 없습니다. 소셜 프루프가 더 있으면 좋겠습니다.',
  '명확한 한 가지 CTA에 집중한 구성이 좋습니다. 본문에서 더 구체적인 혜택을 먼저 언급하면 더 효과적일 것 같습니다.',
];

// ══════════════════════════════════════════════════════════════
// 커스텀 질문 답변 풀
// ══════════════════════════════════════════════════════════════

const SCALE_POOL = [
  [2,3,2,3,2], [4,5,4,4,3], [3,3,4,3,3], [5,4,5,4,5],
  [3,4,3,4,4], [2,3,3,2,3], [4,4,3,4,4], [3,3,3,3,4],
  [5,5,4,5,4],
];
const RADIO_PICKS = [1,0,1,0,2,1,0,2,0];
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
];

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function parseSelectedQuestions(description) {
  try {
    const desc = JSON.parse(description || '{}');
    if (desc.selectedQuestions?.length) return desc.selectedQuestions;
    const tqs = desc.templateQuestions || [];
    const cqs = (desc.customQuestions || []).map(q =>
      typeof q === 'string' ? { id: `cq-${q.slice(0, 8)}`, text: q, type: 'text', options: [] } : q
    );
    return [...tqs, ...cqs];
  } catch { return []; }
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

async function ensureDraftFeedback(missionId, panelId) {
  const { data: existing } = await supabase
    .from('feedbacks').select('id, status')
    .eq('mission_id', missionId).eq('panel_id', panelId).maybeSingle();

  if (existing?.status === 'submitted') return { id: existing.id, skip: true };
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
// preference(소재비교) 피드백
// ══════════════════════════════════════════════════════════════

async function submitPreferenceFeedback(mission, panel, panelIdx) {
  const profile = PANEL_PROFILES[panelIdx];
  const selectedQuestions = parseSelectedQuestions(mission.description);

  const { id: feedbackId, skip } = await ensureDraftFeedback(mission.id, panel.id);
  if (skip) { process.stdout.write('⏩ 이미 제출됨\n'); return; }

  const { data: testRow } = await supabase
    .from('preference_tests').select('id').eq('mission_id', mission.id).maybeSingle();
  const testId = testRow?.id ?? null;

  const commentPair = PREFERENCE_COMMENTS[panelIdx % PREFERENCE_COMMENTS.length];
  const selectedVariant = commentPair[0].includes('A') ? 'A' : 'B';
  const messageClarity = clamp(profile.scoreBase[0] + randInt(-1, 1), 1, 5);
  const purchaseIntent  = clamp(profile.scoreBase[1] + randInt(-1, 1), 1, 5);
  const comment = `[선택: ${commentPair[0]}]\n${commentPair[1]}`;

  const customAnswers = selectedQuestions.map((q, qi) => ({
    questionId: q.id || `q-${qi}`,
    questionText: q.text || q.question_text || '',
    type: q.type || q.question_type || 'text',
    answer: generateCustomAnswer(q, panelIdx, qi),
  }));

  const respPayload = {
    panel_id: panel.id,
    preference: selectedVariant,
    comment,
    mission_id: mission.id,
    status: 'submitted',
    message_clarity: messageClarity,
    purchase_intent: purchaseIntent,
    custom_answers: customAnswers.length ? customAnswers : null,
  };
  if (testId) respPayload.test_id = testId;

  const { error: rErr } = await supabase.from('preference_responses').insert(respPayload);
  if (rErr) {
    const { error: uErr } = await supabase.from('preference_responses')
      .update({ preference: selectedVariant, comment, message_clarity: messageClarity, purchase_intent: purchaseIntent, custom_answers: customAnswers.length ? customAnswers : null })
      .eq('mission_id', mission.id).eq('panel_id', panel.id);
    if (uErr) throw new Error(`preference_responses 실패: ${rErr.message}`);
  }

  const { error: upErr } = await supabase.from('feedbacks')
    .update({ status: 'submitted', strengths: null, suggestions: `[총평]\n${comment}` })
    .eq('id', feedbackId);
  if (upErr) throw new Error(`feedbacks UPDATE 실패: ${upErr.message}`);

  process.stdout.write(`소재${selectedVariant} | 명확성${messageClarity} 구매의향${purchaseIntent}${customAnswers.length ? ` | 추가질문${customAnswers.length}개` : ''}\n`);
  await callRpcs(mission.id, panel.id);
}

// ══════════════════════════════════════════════════════════════
// pricing(가격검증) 피드백
// ══════════════════════════════════════════════════════════════

async function submitPricingFeedback(mission, panel, panelIdx) {
  const profile = PANEL_PROFILES[panelIdx];
  const selectedQuestions = parseSelectedQuestions(mission.description);

  const { id: feedbackId, skip } = await ensureDraftFeedback(mission.id, panel.id);
  if (skip) { process.stdout.write('⏩ 이미 제출됨\n'); return; }

  const { data: testRow } = await supabase
    .from('pricing_tests').select('id').eq('mission_id', mission.id).maybeSingle();
  const testId = testRow?.id ?? null;

  const wouldBuy      = profile.wouldBuy;
  const priceFairness = clamp(profile.scoreBase[2] + randInt(-1, 1), 1, 5);
  const valuePercep   = clamp(profile.scoreBase[3] + randInt(-1, 1), 1, 5);
  const keyComment    = PRICING_COMMENTS[panelIdx % PRICING_COMMENTS.length];

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
    custom_answers: customAnswers.length ? customAnswers : null,
    tier: panel.experience || 'junior',
  };
  if (testId) respPayload.test_id = testId;

  const { error: rErr } = await supabase.from('pricing_responses').insert(respPayload);
  if (rErr) {
    const { error: uErr } = await supabase.from('pricing_responses')
      .update({ would_buy: wouldBuy, key_comment: keyComment, price_fairness: priceFairness, value_perception: valuePercep, custom_answers: customAnswers.length ? customAnswers : null })
      .eq('mission_id', mission.id).eq('panel_id', panel.id);
    if (uErr) throw new Error(`pricing_responses 실패: ${rErr.message}`);
  }

  const { error: upErr } = await supabase.from('feedbacks')
    .update({ status: 'submitted', strengths: null, suggestions: `[총평]\n${keyComment}` })
    .eq('id', feedbackId);
  if (upErr) throw new Error(`feedbacks UPDATE 실패: ${upErr.message}`);

  process.stdout.write(`구매의향:${wouldBuy ? 'O' : 'X'} | 공정가격${priceFairness} 가치인식${valuePercep}${customAnswers.length ? ` | 추가질문${customAnswers.length}개` : ''}\n`);
  await callRpcs(mission.id, panel.id);
}

// ══════════════════════════════════════════════════════════════
// email(이메일검증) 피드백
// ══════════════════════════════════════════════════════════════

async function submitEmailFeedback(mission, panel, panelIdx) {
  const profile = PANEL_PROFILES[panelIdx];
  const selectedQuestions = parseSelectedQuestions(mission.description);

  const { id: feedbackId, skip } = await ensureDraftFeedback(mission.id, panel.id);
  if (skip) { process.stdout.write('⏩ 이미 제출됨\n'); return; }

  const { data: testRow } = await supabase
    .from('cold_email_tests').select('id').eq('mission_id', mission.id).maybeSingle();
  const testId = testRow?.id ?? null;

  const wouldReply     = profile.wouldReply;
  const openIntent     = clamp(profile.scoreBase[0] + randInt(-1, 1), 1, 5);
  const hookScore      = clamp(profile.scoreBase[1] + randInt(-1, 1), 1, 5);
  const clarityScore   = clamp(profile.scoreBase[2] + randInt(-1, 1), 1, 5);
  const curiosityScore = clamp(profile.scoreBase[3] + randInt(-1, 1), 1, 5);
  const comment        = EMAIL_COMMENTS[panelIdx % EMAIL_COMMENTS.length];

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
    custom_answers: customAnswers.length ? customAnswers : null,
  };
  if (testId) respPayload.test_id = testId;

  const { error: rErr } = await supabase.from('email_responses').insert(respPayload);
  if (rErr) {
    const { error: uErr } = await supabase.from('email_responses')
      .update({ would_reply: wouldReply, hook_score: hookScore, clarity_score: clarityScore, open_intent: openIntent, curiosity_score: curiosityScore, comment, custom_answers: customAnswers.length ? customAnswers : null })
      .eq('mission_id', mission.id).eq('panel_id', panel.id);
    if (uErr) throw new Error(`email_responses 실패: ${rErr.message}`);
  }

  const { error: upErr } = await supabase.from('feedbacks')
    .update({ status: 'submitted', strengths: null, suggestions: `[총평]\n${comment}` })
    .eq('id', feedbackId);
  if (upErr) throw new Error(`feedbacks UPDATE 실패: ${upErr.message}`);

  process.stdout.write(`답장의향:${wouldReply ? 'O' : 'X'} | 개봉${openIntent} 훅${hookScore} 명확${clarityScore} 호기심${curiosityScore}${customAnswers.length ? ` | 추가질문${customAnswers.length}개` : ''}\n`);
  await callRpcs(mission.id, panel.id);
}

// ══════════════════════════════════════════════════════════════
// 메인
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log('=== 어드민 기업 서브 의뢰 × 패널 1~9 피드백 자동 생성 ===\n');

  // 1. 유저 목록 로드
  const { data: { users: allUsers }, error: uListErr } = await supabase.auth.admin.listUsers();
  if (uListErr) { console.error('유저 목록 오류:', uListErr.message); return; }

  // 2. 어드민 company_id 조회
  const adminUser = allUsers.find(u => u.email === 'purit.admin@gmail.com');
  if (!adminUser) { console.error('❌ purit.admin@gmail.com 계정 없음'); return; }

  const { data: adminCompany } = await supabase
    .from('companies').select('id').eq('user_id', adminUser.id).maybeSingle();
  if (!adminCompany) { console.error('❌ 어드민 companies 레코드 없음'); return; }

  console.log(`✅ 어드민 company_id: ${adminCompany.id.slice(0, 8)}...`);

  // 3. 어드민 서브 의뢰 조회 (active 상태만)
  const { data: missions, error: mErr } = await supabase
    .from('missions')
    .select('id, title, type, description, panel_count, filled_count, status, created_at')
    .eq('company_id', adminCompany.id)
    .in('type', ['preference', 'pricing', 'email'])
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (mErr) { console.error('미션 조회 오류:', mErr.message); return; }
  if (!missions?.length) { console.error('❌ 어드민 계정의 active 서브 의뢰가 없습니다.'); return; }

  const prefMissions  = missions.filter(m => m.type === 'preference');
  const pricMissions  = missions.filter(m => m.type === 'pricing');
  const emailMissions = missions.filter(m => m.type === 'email');

  console.log(`\n📋 서브 의뢰 총 ${missions.length}개 (소재비교 ${prefMissions.length} / 가격검증 ${pricMissions.length} / 이메일검증 ${emailMissions.length})`);
  missions.forEach((m, i) => {
    const typeLabel = m.type === 'preference' ? '소재비교' : m.type === 'pricing' ? '가격검증' : '이메일검증';
    console.log(`  [${i + 1}] [${typeLabel}] "${m.title || '(제목없음)'.slice(0, 40)}" — 슬롯 ${m.filled_count}/${m.panel_count}`);
  });

  // 4. 패널 1~9 조회
  const panelUsers = allUsers
    .filter(u => /^panel\d+@purit\.io$/.test(u.email || ''))
    .sort((a, b) => parseInt(a.email.match(/\d+/)[0]) - parseInt(b.email.match(/\d+/)[0]))
    .slice(0, 9); // panel1 ~ panel9

  console.log(`\n✅ 패널 ${panelUsers.length}명 (panel1~panel9)`);

  const { data: panelRecords, error: pErr } = await supabase
    .from('panels').select('id, user_id, name, experience')
    .in('user_id', panelUsers.map(u => u.id));
  if (pErr) { console.error('panels 조회 오류:', pErr.message); return; }

  const panelByUserId = {};
  panelRecords.forEach(p => { panelByUserId[p.user_id] = p; });

  // 5. 타입별 처리 함수 매핑
  const TYPE_FN = {
    preference: submitPreferenceFeedback,
    pricing: submitPricingFeedback,
    email: submitEmailFeedback,
  };
  const TYPE_LABEL = { preference: '소재비교', pricing: '가격검증', email: '이메일검증' };

  let totalSuccess = 0, totalFail = 0;

  for (const [mi, mission] of missions.entries()) {
    const typeLabel = TYPE_LABEL[mission.type];
    const fn = TYPE_FN[mission.type];
    const titleShort = (mission.title || '').length > 42 ? (mission.title || '').slice(0, 42) + '…' : (mission.title || '(제목없음)');

    console.log(`\n${'━'.repeat(60)}`);
    console.log(`▶ [${mi + 1}/${missions.length}] [${typeLabel}] ${titleShort}`);

    for (let pi = 0; pi < panelUsers.length; pi++) {
      const user  = panelUsers[pi];
      const panel = panelByUserId[user.id];
      if (!panel) { console.log(`   ⚠️  panels 레코드 없음 (${user.email})`); continue; }

      process.stdout.write(`   panel${pi + 1} (${panel.name || user.email}) → `);
      try {
        await fn(mission, panel, pi);
        totalSuccess++;
      } catch (e) {
        console.log(`❌ ${e.message}`);
        totalFail++;
      }
    }
  }

  // 6. 최종 요약
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎉 완료: 성공 ${totalSuccess}건 / 실패 ${totalFail}건`);
  console.log(`   (목표: ${missions.length} 의뢰 × ${panelUsers.length} 패널 = ${missions.length * panelUsers.length}건)\n`);

  // 최종 슬롯 현황
  const { data: finalMissions } = await supabase
    .from('missions')
    .select('title, type, filled_count, panel_count')
    .eq('company_id', adminCompany.id)
    .in('type', ['preference', 'pricing', 'email'])
    .eq('status', 'active');

  if (finalMissions) {
    console.log('📊 최종 슬롯 현황:');
    finalMissions.forEach(m => {
      const tl = TYPE_LABEL[m.type] || m.type;
      const title = (m.title || '').slice(0, 38).padEnd(39);
      console.log(`  [${tl}] ${title} ${m.filled_count}/${m.panel_count} 슬롯`);
    });
  }
}

main().catch(e => { console.error('치명적 오류:', e); process.exit(1); });
