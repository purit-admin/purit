/**
 * 테스트 의뢰 12개 일괄 생성 스크립트
 * purit.admin@gmail.com 기업 계정으로:
 *   - 메인 LP 검증 의뢰 3개 (이미지 3장씩 완전 첨부)
 *   - 소재비교(preference) 3개
 *   - 가격검증(pricing) 3개
 *   - 이메일검증(email) 3개
 * 총 12개 의뢰 생성
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
  console.error('VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'purit.admin@gmail.com';

// ── SVG 이미지 생성 ────────────────────────────────────────────────────────
function makeSvg(title, subtitle, bgColor, accentColor, w = 1200, h = 800) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${accentColor}22;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#grad)"/>
  <rect x="48" y="48" width="${w - 96}" height="${h - 96}" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  <text x="${w / 2}" y="${h * 0.32}" font-family="Arial,sans-serif" font-size="46" font-weight="bold" fill="white" text-anchor="middle">${title}</text>
  <text x="${w / 2}" y="${h * 0.44}" font-family="Arial,sans-serif" font-size="20" fill="rgba(255,255,255,0.60)" text-anchor="middle">${subtitle}</text>
  <rect x="${w / 2 - 140}" y="${h * 0.54}" width="280" height="58" rx="29" fill="${accentColor}"/>
  <text x="${w / 2}" y="${h * 0.54 + 37}" font-family="Arial,sans-serif" font-size="17" font-weight="bold" fill="${bgColor}" text-anchor="middle">무료로 시작하기 →</text>
  <text x="${w / 2}" y="${h * 0.86}" font-family="Arial,sans-serif" font-size="13" fill="rgba(255,255,255,0.25)" text-anchor="middle">PURIT TEST ASSET</text>
</svg>`);
}

async function uploadImg(companyId, missionUuid, filename, svgBuf) {
  const path = `${companyId}/${missionUuid}/${filename}`;
  const { error } = await supabase.storage
    .from('mission-assets')
    .upload(path, svgBuf, { contentType: 'image/svg+xml', upsert: true });
  if (error) { console.warn(`  이미지 업로드 실패(${filename}):`, error.message); return null; }
  const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
  console.log(`  ${filename} 업로드 완료`);
  return publicUrl;
}

// ── 크레딧 계산 ───────────────────────────────────────────────────────────
const CAREER_MULT = { junior: 1.0, middle: 1.5, senior: 2.0, clevel: 3.0 };
const MISSION_MULT = { main: 1.5, sub: 1.0 };

function calcCredits(panelCount, careerLevels, missionType) {
  const mults = careerLevels.map(c => CAREER_MULT[c] || 1.0);
  const finalMult = mults.length <= 2 ? Math.max(...mults) : 1.8;
  return panelCount * finalMult * MISSION_MULT[missionType];
}

function calcPanelPayout(careerLevels, missionType) {
  const BASE = missionType === 'main' ? 8000 : 4500;
  const mults = careerLevels.map(c => CAREER_MULT[c] || 1.0);
  const finalMult = mults.length <= 2 ? Math.max(...mults) : 1.8;
  return Math.round(BASE * finalMult);
}

// ── 질문 세트 ─────────────────────────────────────────────────────────────
const Q = {
  lp: [
    { id: 'lp-q1', text: '이 랜딩페이지의 핵심 가치가 5초 안에 명확하게 이해됩니까?', type: 'scale', options: [] },
    { id: 'lp-q2', text: '첫 화면을 보고 난 후 가장 먼저 드는 감정은 무엇입니까?', type: 'radio', options: ['신뢰감', '궁금함', '무관심', '혼란스러움'] },
    { id: 'lp-q3', text: '헤드라인 카피가 귀하의 현재 상황이나 고민을 얼마나 정확히 묘사합니까?', type: 'scale', options: [] },
    { id: 'lp-q4', text: '최종적으로 이 페이지에서 전환(가입/구매/문의)할 의향은 어느 정도입니까?', type: 'scale', options: [] },
    { id: 'lp-q5', text: '전환을 가로막는 가장 결정적인 장애 요소를 한 문장으로 적어주세요.', type: 'text', options: [] },
  ],
  pref: [
    { id: 'pref-q1', text: '두 소재 중 어느 쪽이 더 클릭하고 싶은 충동을 일으킵니까?', type: 'radio', options: ['소재 A', '소재 B', '비슷하다'] },
    { id: 'pref-q2', text: '선택한 소재의 메시지가 귀하의 상황에 얼마나 공감됩니까?', type: 'scale', options: [] },
    { id: 'pref-q3', text: '선택하지 않은 소재의 가장 큰 약점은 무엇이라고 생각합니까?', type: 'text', options: [] },
  ],
  pricing: [
    { id: 'price-q1', text: '제시된 가격이 제공되는 가치에 비해 적절하다고 생각합니까?', type: 'scale', options: [] },
    { id: 'price-q2', text: '가격 구조(플랜 구성)가 얼마나 명확하게 이해됩니까?', type: 'scale', options: [] },
    { id: 'price-q3', text: '이 가격에서 구매 결정을 주저하게 만드는 가장 큰 요인은 무엇입니까?', type: 'text', options: [] },
  ],
  email: [
    { id: 'email-q1', text: '이 이메일의 제목(첫 문장)을 보고 열어볼 의향이 얼마나 됩니까?', type: 'scale', options: [] },
    { id: 'email-q2', text: '이메일 본문을 읽으면서 가장 흥미로웠던 부분은 어디입니까?', type: 'radio', options: ['도입부 문제 제기', '솔루션 설명', 'CTA(행동 유도)', '특별 혜택/조건'] },
    { id: 'email-q3', text: '이 이메일에 답장하거나 링크를 클릭하지 않게 만드는 요인을 적어주세요.', type: 'text', options: [] },
  ],
};

// ── 메인 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 테스트 의뢰 12개 일괄 생성 ===\n');
  console.log('  메인 LP 검증 3개 + 소재비교 3개 + 가격검증 3개 + 이메일검증 3개\n');

  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 조회 실패:', uErr.message); process.exit(1); }
  const adminUser = users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`${ADMIN_EMAIL} 계정 없음`); process.exit(1); }
  console.log(`어드민 유저: ${adminUser.email} (${adminUser.id})`);

  const { data: company } = await supabase
    .from('companies').select('id, name, plan').eq('user_id', adminUser.id).single();
  if (!company) { console.error('company 레코드 없음'); process.exit(1); }
  console.log(`기업: ${company.name || '(unnamed)'} (id: ${company.id}, plan: ${company.plan})\n`);

  const co = company.id;
  const results = [];

  // ════════════════════════════════════════════════════════════════
  // [A] 메인 LP 검증 의뢰 3개
  // ════════════════════════════════════════════════════════════════

  // [A-1] Purit SaaS 랜딩페이지
  {
    const id = randomUUID();
    console.log('[A-1] Purit SaaS 랜딩페이지 전환율 검증 생성 중...');
    const imgs = [];
    for (const [fn, title, sub, bg, ac] of [
      ['hero.svg',    'Purit 히어로 섹션',   '패널 피드백으로 전환율을 높이세요',    '#0f1629', '#6366F1'],
      ['value.svg',   'Purit 가치 제안',     '데이터로 증명하는 마케팅 최적화',      '#16213e', '#34D399'],
      ['cta.svg',     'Purit CTA 섹션',      '지금 바로 무료로 시작하세요',          '#0f3460', '#E8D5A3'],
    ]) {
      const url = await uploadImg(co, id, fn, makeSvg(title, sub, bg, ac));
      if (url) imgs.push(url);
    }
    const careerLevels = ['junior', 'middle'];
    const panelCount = 15;
    const focusAreas = ['첫인상 / 가독성', 'CTA 전환율', '핵심 메시지 명확성', '신뢰 요소', '타겟 일치도'];
    const description = JSON.stringify({
      product: 'Purit', lpUrl: 'https://purit.io', industry: 'SaaS/소프트웨어',
      personaAge: '25~35세', personaIncome: '월 400~700만원',
      personaRole: 'B2B SaaS 마케터 / 스타트업 대표',
      personaContext: '전환율 최적화에 관심이 많고 마케팅 툴 도입 의사결정 경험이 있는 실무자',
      briefText: 'Purit는 실제 타겟 패널의 피드백으로 랜딩페이지 전환율을 높이는 CRO SaaS입니다. 히어로 섹션의 첫인상, 가치 제안의 명확성, CTA 버튼 클릭 충동, 신뢰 요소 구성이 타겟 페르소나에게 얼마나 효과적으로 작동하는지 확인합니다.',
      focusAreas, imageUrls: imgs, selectedQuestions: Q.lp, careerLevels, panels: panelCount, step: 4,
    });
    const persona = '연령: 25~35세 / 소득: 월 400~700만원 / 직군: B2B SaaS 마케터 / 스타트업 대표 / 산업군: SaaS/소프트웨어';
    const credits = calcCredits(panelCount, careerLevels, 'main');
    const reward = calcPanelPayout(careerLevels, 'main');
    const { error } = await supabase.from('missions').insert({
      id, company_id: co, title: 'Purit SaaS 랜딩페이지 전환율 검증',
      type: 'landing_page', target_url: 'https://purit.io',
      description, persona, panel_count: panelCount, filled_count: 0,
      reward_amount: reward, status: 'active', assets: focusAreas, image_urls: imgs,
      estimated_minutes: 7, credits_reserved: credits,
    });
    if (error) console.error('  INSERT 실패:', error.message);
    else { console.log(`  완료 (이미지 ${imgs.length}장, credits: ${credits}, reward: ${reward})\n`); results.push('A-1 Purit SaaS LP'); }
  }

  // [A-2] Glowi 뷰티 브랜드 랜딩페이지
  {
    const id = randomUUID();
    console.log('[A-2] Glowi 뷰티 브랜드 랜딩페이지 첫인상 검증 생성 중...');
    const imgs = [];
    for (const [fn, title, sub, bg, ac] of [
      ['hero.svg',    'Glowi 히어로 섹션',   '피부가 빛나는 순간, Glowi',            '#1a0a1e', '#F472B6'],
      ['value.svg',   'Glowi 성분 가치',     '자연성분으로 완성되는 광채',            '#2d0a2e', '#C084FC'],
      ['trust.svg',   'Glowi 신뢰 요소',     '피부과 전문의 12명이 인증한 성분',      '#1a0a2d', '#E879F9'],
    ]) {
      const url = await uploadImg(co, id, fn, makeSvg(title, sub, bg, ac));
      if (url) imgs.push(url);
    }
    const careerLevels = ['junior'];
    const panelCount = 10;
    const focusAreas = ['첫인상 / 가독성', '비주얼 완성도', '신뢰 요소', '타겟 일치도'];
    const description = JSON.stringify({
      product: 'Glowi 스킨케어', lpUrl: 'https://glowi.co.kr', industry: '뷰티/코스메틱',
      personaAge: '20~35세', personaIncome: '월 200~450만원',
      personaRole: '직장인 여성 / 뷰티 관심층',
      personaContext: '자연성분 스킨케어에 관심이 많고 SNS 뷰티 콘텐츠를 즐겨 보는 소비자',
      briefText: '뷰티 브랜드 Glowi의 신제품 세럼 랜딩페이지입니다. 첫 화면의 비주얼 임팩트, 성분 가치 전달의 명확성, 피부과 인증 신뢰 요소, 타겟 페르소나와의 공감 포인트를 검증합니다.',
      focusAreas, imageUrls: imgs, selectedQuestions: Q.lp.slice(0, 4), careerLevels, panels: panelCount, step: 4,
    });
    const persona = '연령: 20~35세 / 소득: 월 200~450만원 / 직군: 직장인 여성 / 뷰티 관심층 / 산업군: 뷰티/코스메틱';
    const credits = calcCredits(panelCount, careerLevels, 'main');
    const reward = calcPanelPayout(careerLevels, 'main');
    const { error } = await supabase.from('missions').insert({
      id, company_id: co, title: '뷰티 브랜드 신제품 세럼 랜딩페이지 첫인상 검증',
      type: 'landing_page', target_url: 'https://glowi.co.kr',
      description, persona, panel_count: panelCount, filled_count: 0,
      reward_amount: reward, status: 'active', assets: focusAreas, image_urls: imgs,
      estimated_minutes: 6, credits_reserved: credits,
    });
    if (error) console.error('  INSERT 실패:', error.message);
    else { console.log(`  완료 (이미지 ${imgs.length}장, credits: ${credits}, reward: ${reward})\n`); results.push('A-2 Glowi 뷰티 LP'); }
  }

  // [A-3] FitPath 헬스케어 앱 랜딩페이지
  {
    const id = randomUUID();
    console.log('[A-3] FitPath 헬스케어 앱 랜딩페이지 가치 전달 검증 생성 중...');
    const imgs = [];
    for (const [fn, title, sub, bg, ac] of [
      ['hero.svg',    'FitPath 히어로 섹션', 'AI 퍼스널 트레이너, 당신만을 위한 코칭', '#0a1a0f', '#34D399'],
      ['feature.svg', 'FitPath 핵심 기능',  '개인화된 운동+식단 플랜 자동 생성',     '#0f2a1a', '#6EE7B7'],
      ['pricing.svg', 'FitPath 요금제',     '월 9,900원으로 AI 코칭 시작',            '#1a3a2a', '#A7F3D0'],
    ]) {
      const url = await uploadImg(co, id, fn, makeSvg(title, sub, bg, ac));
      if (url) imgs.push(url);
    }
    const careerLevels = ['junior', 'middle'];
    const panelCount = 12;
    const focusAreas = ['첫인상 / 가독성', '핵심 메시지 명확성', '가격 및 가치 전달', '타겟 일치도'];
    const description = JSON.stringify({
      product: 'FitPath', lpUrl: 'https://fitpath.app', industry: '헬스/피트니스',
      personaAge: '25~45세', personaIncome: '월 300~600만원',
      personaRole: '직장인 / 건강관리 관심층',
      personaContext: '바쁜 일상 속 효율적인 운동 및 식단 관리를 원하는 직장인으로 앱 구독에 익숙한 사용자',
      briefText: 'AI 퍼스널 트레이닝 앱 FitPath의 랜딩페이지입니다. 첫인상에서 핵심 가치(AI 코칭, 개인화 운동 계획)가 얼마나 빠르게 전달되는지, 가격 플랜 구성이 타겟 사용자의 구독 결정을 유도하는지 검증합니다.',
      focusAreas, imageUrls: imgs, selectedQuestions: Q.lp, careerLevels, panels: panelCount, step: 4,
    });
    const persona = '연령: 25~45세 / 소득: 월 300~600만원 / 직군: 직장인 / 건강관리 관심층 / 산업군: 헬스/피트니스';
    const credits = calcCredits(panelCount, careerLevels, 'main');
    const reward = calcPanelPayout(careerLevels, 'main');
    const { error } = await supabase.from('missions').insert({
      id, company_id: co, title: '헬스케어 앱 온보딩 랜딩페이지 가치 전달 검증',
      type: 'landing_page', target_url: 'https://fitpath.app',
      description, persona, panel_count: panelCount, filled_count: 0,
      reward_amount: reward, status: 'active', assets: focusAreas, image_urls: imgs,
      estimated_minutes: 7, credits_reserved: credits,
    });
    if (error) console.error('  INSERT 실패:', error.message);
    else { console.log(`  완료 (이미지 ${imgs.length}장, credits: ${credits}, reward: ${reward})\n`); results.push('A-3 FitPath LP'); }
  }

  // ════════════════════════════════════════════════════════════════
  // [B] 소재비교(preference) 3개
  // ════════════════════════════════════════════════════════════════

  // [B-1] Purit SNS 광고 배너 A/B
  {
    const id = randomUUID();
    console.log('[B-1] Purit SNS 광고 배너 A/B 소재 비교 생성 중...');
    const imgA = await uploadImg(co, id, 'va.svg',
      makeSvg('배너 A — 기능 소구', '전환율을 정확하게 측정하세요', '#1a1a2e', '#6366F1', 800, 800));
    const imgB = await uploadImg(co, id, 'vb.svg',
      makeSvg('배너 B — 감성 소구', '마케터의 직관을 데이터로 증명하세요', '#2d1a0a', '#F59E0B', 800, 800));
    const careerLevels = ['junior'];
    const panelCount = 10;
    const description = JSON.stringify({
      missionTitle: 'Purit SNS 광고 배너 A/B 소재 비교',
      variantA: '[배너 A 기능 소구] 헤드라인: 전환율을 정확하게 측정하세요 / 서브카피: 실제 타겟 패널의 반응으로 검증된 마케팅 소재 / CTA: 무료 체험 시작',
      variantB: '[배너 B 감성 소구] 헤드라인: 마케터의 직관을 데이터로 증명하세요 / 서브카피: 당신의 감각이 맞다는 걸 수치로 확인하세요 / CTA: 지금 바로 검증하기',
      variantAImage: imgA, variantBImage: imgB,
      productDescription: 'Purit — 실제 타겟 패널 피드백 기반 CRO SaaS. 랜딩페이지/광고 소재/가격/이메일 4가지 검증 도구 제공.',
      industry: 'SaaS/소프트웨어', selectedQuestions: Q.pref, careerLevels,
    });
    const persona = '연령: 25~35세 / 직군: B2B 마케터 / 스타트업 대표 / 산업군: SaaS/소프트웨어';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: 'Purit SNS 광고 배너 A/B 소재 비교',
      type: 'preference', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['소재 A/B 비교', '메시지 공감도', 'CTA 전환력'],
      image_urls: [imgA, imgB].filter(Boolean), estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('preference_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id,
        asset_type: 'image', variant_a: 'variantA_image', variant_b: 'variantB_image',
        panel_size: panelCount, status: 'active',
      });
      if (tErr) console.warn('  preference_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (이미지 A/B 각 1장, credits: ${credits}, reward: ${reward})\n`);
      results.push('B-1 Purit SNS 배너 A/B');
    }
  }

  // [B-2] FitPath 헤드라인 카피 A/B
  {
    const id = randomUUID();
    console.log('[B-2] FitPath 헬스케어 앱 헤드라인 카피 A/B 비교 생성 중...');
    const careerLevels = ['junior', 'middle'];
    const panelCount = 10;
    const description = JSON.stringify({
      missionTitle: '헬스케어 앱 헤드라인 카피 A/B 비교',
      variantA: '[버전 A — 결과 중심] "30일 안에 체지방 3kg 감량. AI가 계획하고 당신이 실행합니다." — 구체적 수치로 기대 결과 명시, AI와 사용자 역할 분리',
      variantB: '[버전 B — 공감 중심] "매일 운동 루틴을 고민하느라 지쳤나요? 이제 AI가 대신 고민합니다." — 타겟 고충 직접 언급, 감성적 공감에서 출발',
      variantAImage: null, variantBImage: null,
      productDescription: 'FitPath — AI 퍼스널 트레이닝 앱. 체형+목표+생활패턴 분석 후 개인화된 운동+식단 계획 자동 생성. 월 9,900원 구독.',
      industry: '헬스/피트니스', selectedQuestions: Q.pref, careerLevels,
    });
    const persona = '연령: 25~45세 / 직군: 직장인 / 건강관리 관심층 / 산업군: 헬스/피트니스';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: '헬스케어 앱 상세페이지 헤드라인 카피 A/B 비교',
      type: 'preference', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['메시지 공감도', '카피 전달력', '타겟 일치도'],
      image_urls: [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('preference_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id,
        asset_type: 'text', variant_a: 'variantA_text', variant_b: 'variantB_text',
        panel_size: panelCount, status: 'active',
      });
      if (tErr) console.warn('  preference_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (텍스트 소재, credits: ${credits}, reward: ${reward})\n`);
      results.push('B-2 FitPath 헤드라인 카피 A/B');
    }
  }

  // [B-3] Glowi 뷰티 가치 제안 문구 A/B
  {
    const id = randomUUID();
    console.log('[B-3] Glowi 뷰티 브랜드 가치 제안 문구 A/B 비교 생성 중...');
    const imgA = await uploadImg(co, id, 'va.svg',
      makeSvg('가치 A — 성분 중심', '피부과 검증 성분만, Glowi', '#1a0a1e', '#F472B6', 800, 800));
    const imgB = await uploadImg(co, id, 'vb.svg',
      makeSvg('가치 B — 결과 중심', '72시간 지속 수분, 빛나는 피부', '#2d0a18', '#C084FC', 800, 800));
    const careerLevels = ['junior'];
    const panelCount = 10;
    const description = JSON.stringify({
      missionTitle: '뷰티 브랜드 가치 제안 문구 A/B 비교',
      variantA: '[가치 A — 성분 중심] 헤드라인: 피부과 검증 성분만 담았습니다 / 서브카피: 나이아신아마이드 5% + 히알루론산 3중 복합체. 피부과 전문의 12명이 인증한 포뮬러 / 이미지: 성분 클로즈업 컷',
      variantB: '[가치 B — 결과 중심] 헤드라인: 72시간 후, 당신의 피부가 달라집니다 / 서브카피: 단 한 방울로 건조함 없이 하루를 마무리하세요. Before & After 실사용 후기 / 이미지: 피부 질감 비교 컷',
      variantAImage: imgA, variantBImage: imgB,
      productDescription: 'Glowi — 피부과 성분 기반 비건 스킨케어. 신제품 Dew Drop Serum(히알루론산+나이아신아마이드+판테놀). EWG 그린 등급, 무향, 민감성 피부 적합.',
      industry: '뷰티/코스메틱', selectedQuestions: Q.pref, careerLevels,
    });
    const persona = '연령: 20~35세 / 직군: 직장인 여성 / 뷰티 관심층 / 산업군: 뷰티/코스메틱';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: '뷰티 브랜드 LP 가치 제안 문구 A/B 비교 (성분 vs 결과)',
      type: 'preference', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['가치 제안 공감도', '구매 의향 유발력', '브랜드 신뢰도'],
      image_urls: [imgA, imgB].filter(Boolean), estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('preference_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id,
        asset_type: 'image', variant_a: 'variantA_image', variant_b: 'variantB_image',
        panel_size: panelCount, status: 'active',
      });
      if (tErr) console.warn('  preference_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (이미지 A/B 각 1장, credits: ${credits}, reward: ${reward})\n`);
      results.push('B-3 Glowi 가치 제안 A/B');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // [C] 가격검증(pricing) 3개
  // ════════════════════════════════════════════════════════════════

  // [C-1] Purit SaaS 구독 요금제
  {
    const id = randomUUID();
    console.log('[C-1] Purit SaaS 구독 요금제 가격 적정성 검증 생성 중...');
    const imgUrl = await uploadImg(co, id, 'pricing.svg',
      makeSvg('Purit 요금제 비교', 'Starter · Pro · Enterprise', '#0f1a2e', '#6366F1'));
    const careerLevels = ['junior'];
    const panelCount = 10;
    const content = `Purit 요금제 구성 (CRO SaaS — 패널 피드백 기반 마케팅 검증 서비스)

[ Starter — 월 82만원(무약정) / 월 68만원(연간 약정) ]
· 월 50 크레딧 지급
· 패널 10~15명 / 주니어+미들급 패널
· 추가 크레딧 구매 가능 (1cr = 25,000원 정가)
· 랜딩페이지·광고 소재·가격·이메일 4가지 검증 도구 전체 이용

[ Pro — 월 238만원(무약정) / 월 198만원(연간 약정) ]
· 월 165 크레딧 지급
· 패널 10~30명 / 시니어+헤드 패널 포함
· 추가 크레딧 구매 시 14% 할인 (1cr = 21,600원)
· 고급 타겟팅 옵션(직군·경력 핀셋 필터)

[ Enterprise — 월 450만원~ (연간 계약 전용·협의) ]
· 월 400+ 크레딧
· 패널 규모 무제한·커스텀
· 특정 회사·산업군 핀셋 필터링
· 전담 CSM 배정 및 전략 컨설팅

* 크레딧 소모 기준: 패널 수 × 경력 가중치(주니어 1×~헤드 3×) × 의뢰 유형 배수(메인 1.5×/서브 1×)
* 미사용 차액 크레딧은 검증 완료 후 즉시 환불`;
    const description = JSON.stringify({
      missionTitle: 'Purit SaaS 구독 요금제 가격 적정성 검증',
      content, image: imgUrl,
      productDescription: 'Purit — 실제 타겟 패널 피드백으로 마케팅 자산 전환율을 높이는 B2B CRO SaaS. 48시간 내 결과 제공, Purit Filter로 품질 보증.',
      industry: 'SaaS/소프트웨어', selectedQuestions: Q.pricing, careerLevels,
    });
    const persona = '연령: 25~40세 / 직군: B2B 마케터 / 스타트업 대표 / 산업군: SaaS/소프트웨어';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: 'Purit SaaS 구독 요금제 페이지 가격 적정성 검증',
      type: 'pricing', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['가격 적정성', '플랜 구성 명확성', '구매 장벽'],
      image_urls: imgUrl ? [imgUrl] : [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('pricing_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id, status: 'active',
      });
      if (tErr) console.warn('  pricing_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (이미지 1장, credits: ${credits}, reward: ${reward})\n`);
      results.push('C-1 Purit 요금제 가격 검증');
    }
  }

  // [C-2] FitPath 헬스케어 앱 구독 가격
  {
    const id = randomUUID();
    console.log('[C-2] FitPath 헬스케어 앱 월/연간 구독 가격 적정성 검증 생성 중...');
    const careerLevels = ['junior'];
    const panelCount = 10;
    const content = `FitPath 구독 요금제 (AI 퍼스널 트레이닝 앱)

[ 무료 플랜 ]
· AI 운동 계획 월 3회 제공
· 기본 식단 분석 (칼로리만)
· 운동 기록 최근 30일 보관
· 광고 포함

[ 프리미엄 — 월 9,900원 ]
· AI 운동 계획 무제한
· 고급 식단 분석 + 탄단지 영양소 트래킹
· 운동 기록 무제한 보관
· 라이브 코칭 세션 월 2회 (30분)
· 광고 없음

[ 연간 구독 — 79,000원/년 (34% 할인, 월 환산 6,583원) ]
· 프리미엄 기능 전부 포함
· 체성분 분석 리포트 분기 1회 제공
· 전담 AI 코치 배정
· 가족 계정 1인 무료 추가

* 14일 무료 체험 후 자동 결제 / 언제든지 해지 가능`;
    const description = JSON.stringify({
      missionTitle: '헬스케어 앱 구독 가격 적정성 검증',
      content, image: null,
      productDescription: 'FitPath — AI 퍼스널 트레이닝 앱. 체형+목표+생활패턴 분석 후 개인화 운동+식단 플랜 자동 생성. 누적 다운로드 50만+, 앱스토어 평점 4.8.',
      industry: '헬스/피트니스', selectedQuestions: Q.pricing, careerLevels,
    });
    const persona = '연령: 20~40세 / 직군: 직장인 / 건강관리 관심층 / 산업군: 헬스/피트니스';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: '헬스케어 앱 월/연간 구독 요금제 가격 적정성 검증',
      type: 'pricing', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['가격 적정성', '무료→유료 전환 장벽', '연간 구독 유인'],
      image_urls: [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('pricing_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id, status: 'active',
      });
      if (tErr) console.warn('  pricing_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (텍스트 가격페이지, credits: ${credits}, reward: ${reward})\n`);
      results.push('C-2 FitPath 구독 가격 검증');
    }
  }

  // [C-3] Glowi 뷰티 브랜드 멤버십 요금제
  {
    const id = randomUUID();
    console.log('[C-3] Glowi 뷰티 브랜드 멤버십 요금제 가격 적정성 검증 생성 중...');
    const imgUrl = await uploadImg(co, id, 'pricing.svg',
      makeSvg('Glowi 멤버십 플랜', 'Basic · Premium · VIP', '#1a0a1e', '#F472B6'));
    const careerLevels = ['junior'];
    const panelCount = 10;
    const content = `Glowi 뷰티 멤버십 구독 서비스

[ Basic — 월 19,900원 ]
· 매월 풀사이즈 제품 1개 큐레이션 배송
· 신제품 출시 3일 전 사전 구매 권한
· 멤버 전용 10% 상시 할인
· 무료 배송 (기본 배송)

[ Premium — 월 39,900원 ]
· 매월 풀사이즈 제품 2개 + 샘플 3종 배송
· 신제품 출시 7일 전 사전 구매 + 한정 에디션 우선 구매권
· 멤버 전용 15% 상시 할인 + 생일 30% 쿠폰
· 무료 배송 (당일 배송 월 2회 포함)
· 피부과 전문의 1:1 성분 상담 월 1회

[ VIP — 월 79,900원 ]
· 매월 풀사이즈 제품 4개 + 럭셔리 샘플 키트 배송
· 전 제품 20% 상시 할인 + 시즌 추가 혜택
· 무제한 당일 배송 + 선물 포장 무료
· 피부과 전문의 1:1 상담 월 2회 + 맞춤 루틴 설계
· VIP 전용 오프라인 팝업 스토어 초대

* 최소 3개월 구독, 이후 언제든 해지 가능
* 연간 구독 시 2개월 무료 (17% 절감)`;
    const description = JSON.stringify({
      missionTitle: '뷰티 브랜드 멤버십 구독 가격 적정성 검증',
      content, image: imgUrl,
      productDescription: 'Glowi — 피부과 성분 기반 비건 스킨케어 브랜드. 뷰티 구독 서비스를 통해 개인 맞춤 스킨케어 제품을 매월 큐레이션 제공.',
      industry: '뷰티/코스메틱', selectedQuestions: Q.pricing, careerLevels,
    });
    const persona = '연령: 20~35세 / 직군: 직장인 여성 / 뷰티 구독 서비스 관심층 / 산업군: 뷰티/코스메틱';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: '뷰티 브랜드 월 구독 멤버십 요금제 가격 적정성 검증',
      type: 'pricing', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['가격 적정성', '혜택 구성 매력도', '구독 전환 의향'],
      image_urls: imgUrl ? [imgUrl] : [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('pricing_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id, status: 'active',
      });
      if (tErr) console.warn('  pricing_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (이미지 1장, credits: ${credits}, reward: ${reward})\n`);
      results.push('C-3 Glowi 멤버십 가격 검증');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // [D] 이메일검증(email) 3개
  // ════════════════════════════════════════════════════════════════

  // [D-1] Purit B2B 콜드 리치아웃 이메일
  {
    const id = randomUUID();
    console.log('[D-1] Purit B2B SaaS 콜드 리치아웃 이메일 효과 검증 생성 중...');
    const careerLevels = ['junior', 'middle'];
    const panelCount = 10;
    const emailText = `제목: [Purit] 마케팅 소재 A/B 테스트, 이제 실제 타겟에게 물어보세요

안녕하세요, [이름]님.

저는 Purit의 [발신자 이름]입니다.

다름이 아니라, [회사명]의 마케팅팀이 어떤 소재가 타겟에게 실제로 먹히는지 확인하는 데 시간과 비용을 많이 쓰고 계실 것 같아 연락드렸습니다.

저희 Purit는 실제 타겟 페르소나와 일치하는 B2B 마케터 및 실무자 패널 500+명과 함께, 랜딩페이지/광고 소재/가격 페이지를 48시간 안에 검증해드리는 CRO 서비스입니다.

현재 가장 많이 쓰이는 활용 사례:
- 어떤 헤드라인이 우리 타겟에게 더 잘 먹히나? → A/B 카피 테스트
- 이 랜딩페이지가 왜 전환이 안 되는지 모르겠다 → 5차원 UX 진단
- 가격이 너무 높게 느껴지는 건 아닐까? → 가격 적정성 검증

다음 주 15분 정도 간단히 데모를 보여드릴 수 있을까요?
이번 주 가능한 시간을 알려주시면 맞춰 드리겠습니다.

감사합니다.
[발신자 이름] 드림
Purit | 전환율 최적화 SaaS
hello@purit.io | purit.io`;
    const description = JSON.stringify({
      missionTitle: 'Purit B2B SaaS 콜드 리치아웃 이메일 효과 검증',
      content: emailText,
      productDescription: 'Purit — 실제 타겟 패널 피드백 기반 CRO SaaS. B2B 마케터·스타트업 대표 대상 콜드 리치아웃 이메일의 개봉률·후킹력·CTA 전환 의향 측정.',
      industry: 'SaaS/소프트웨어', selectedQuestions: Q.email, careerLevels,
    });
    const persona = '연령: 25~40세 / 직군: B2B 마케터 / 마케팅 실무자 / 산업군: SaaS/소프트웨어';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: 'Purit B2B SaaS 콜드 리치아웃 이메일 효과 검증',
      type: 'email', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['제목 개봉률', '본문 후킹력', 'CTA 전환 의향'],
      image_urls: [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('cold_email_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id,
        email_text: emailText, status: 'active',
      });
      if (tErr) console.warn('  cold_email_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`);
      results.push('D-1 Purit B2B 콜드메일');
    }
  }

  // [D-2] Glowi 뷰티 신제품 론칭 프로모션 이메일
  {
    const id = randomUUID();
    console.log('[D-2] Glowi 뷰티 브랜드 신제품 론칭 프로모션 이메일 효과 검증 생성 중...');
    const careerLevels = ['junior'];
    const panelCount = 10;
    const emailText = `제목: 드디어 나왔어요 — 피부과 성분 그대로, Glowi Dew Drop 세럼

안녕하세요, [이름]님.

기다리셨죠?

지난 6개월 동안 피부과 전문의 12명과 함께 만든 Glowi의 신제품,
Dew Drop Serum이 오늘 드디어 출시됩니다.

[피부과 검증 성분만]
나이아신아마이드 5% + 히알루론산 3중 복합체 + 판테놀
자극 없이 수분을 채우고 피부 장벽을 회복합니다.

[72시간 지속 수분]
단 한 방울로 건조함 없이 하루를 마무리하세요.

[비건 · 무향 · EWG 그린 등급]
민감한 피부도 안심하고 쓸 수 있습니다.

지금 출시 기념으로 30% 할인 + 샘플 키트 증정 중입니다.

→ 지금 구매하기 (72시간 한정)

아직 고민 중이시라면, 공식 인스타그램(@glowi.official)에서 실사용 후기를 확인해보세요.

오늘도 빛나는 하루 되세요.
Glowi 팀 드림`;
    const description = JSON.stringify({
      missionTitle: '뷰티 브랜드 신제품 론칭 프로모션 이메일 효과 검증',
      content: emailText,
      productDescription: 'Glowi — 피부과 성분 기반 비건 스킨케어 브랜드. 신제품 Dew Drop Serum(히알루론산+나이아신아마이드+판테놀) 출시 프로모션 이메일의 개봉률·구매 유인력·브랜드 신뢰도 측정.',
      industry: '뷰티/코스메틱', selectedQuestions: Q.email, careerLevels,
    });
    const persona = '연령: 20~35세 / 직군: 직장인 여성 / 뷰티 관심층 / 산업군: 뷰티/코스메틱';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: '뷰티 브랜드 신제품 론칭 프로모션 이메일 효과 검증',
      type: 'email', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['제목 개봉률', '본문 구매 유인력', '브랜드 신뢰도'],
      image_urls: [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('cold_email_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id,
        email_text: emailText, status: 'active',
      });
      if (tErr) console.warn('  cold_email_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`);
      results.push('D-2 Glowi 신제품 프로모션 이메일');
    }
  }

  // [D-3] FitPath 무료→유료 전환 넛지 이메일
  {
    const id = randomUUID();
    console.log('[D-3] FitPath 무료→유료 전환 넛지 이메일 효과 검증 생성 중...');
    const careerLevels = ['junior'];
    const panelCount = 10;
    const emailText = `제목: [FitPath] 아직 무료 플랜 쓰고 계세요? 이번 달 체지방 변화가 없었다면 이유가 있습니다

안녕하세요, [이름]님.

FitPath를 시작한 지 벌써 한 달이 지났네요.

그동안 운동 기록을 꾸준히 쌓아오신 것, 잘 보고 있었습니다.

그런데 한 가지 말씀드리고 싶었어요.

무료 플랜에서는 AI가 월 3회만 운동 계획을 만들어드릴 수 있어요.
나머지 날들은 사실상 혼자 고민하셨을 거예요.

프리미엄으로 전환하신 분들의 평균 데이터를 보면:
- 운동 지속률 +43% 향상 (AI가 매일 동기부여)
- 3개월 내 체지방 평균 2.8kg 감량
- "뭘 먹어야 하나" 고민 시간 → 제로

지금 프리미엄으로 전환하시면:
✓ 첫 달 50% 할인 (월 4,950원)
✓ 오늘부터 AI 코칭 무제한
✓ 언제든지 해지 가능 (부담 없음)

→ 지금 50% 할인으로 시작하기

이 혜택은 이번 주 일요일까지만 드릴 수 있어요.

FitPath와 함께 더 건강해지세요.
FitPath 팀 드림`;
    const description = JSON.stringify({
      missionTitle: 'FitPath 무료→유료 전환 넛지 이메일 효과 검증',
      content: emailText,
      productDescription: 'FitPath — AI 퍼스널 트레이닝 앱. 무료 플랜 사용자를 프리미엄으로 전환시키기 위한 리텐션 이메일. 개봉률·전환 의향·설득력 측정.',
      industry: '헬스/피트니스', selectedQuestions: Q.email, careerLevels,
    });
    const persona = '연령: 25~45세 / 직군: 직장인 / 앱 무료 플랜 이용자 / 산업군: 헬스/피트니스';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: 'FitPath 무료→유료 전환 유도 이메일 효과 검증',
      type: 'email', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['제목 개봉률', '전환 유도 설득력', '긴박감 유발력'],
      image_urls: [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('cold_email_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id,
        email_text: emailText, status: 'active',
      });
      if (tErr) console.warn('  cold_email_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`);
      results.push('D-3 FitPath 무료→유료 전환 이메일');
    }
  }

  // ── 결과 요약 ─────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`생성 완료: ${results.length}/12개`);
  console.log('');
  console.log('[메인 LP 검증]');
  results.filter(r => r.startsWith('A-')).forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  console.log('[소재비교 A/B]');
  results.filter(r => r.startsWith('B-')).forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  console.log('[가격 검증]');
  results.filter(r => r.startsWith('C-')).forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  console.log('[이메일 검증]');
  results.filter(r => r.startsWith('D-')).forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n확인: /company 또는 /admin/missions (어드민 계정으로 로그인)');
}

main().catch(e => { console.error('예상치 못한 오류:', e); process.exit(1); });
