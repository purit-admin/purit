/**
 * 테스트 의뢰 일괄 생성 스크립트
 * purit.admin@gmail.com 기업 계정으로:
 *   - 메인 LP 검증 의뢰 3개
 *   - 소재비교(preference) 2개
 *   - 가격검증(pricing) 2개
 *   - 이메일검증(email) 2개
 * 총 9개 의뢰 생성
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'node:crypto';

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
  console.error('VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'purit.admin@gmail.com';

function makeSvg(label, subLabel, bgColor, accentColor, w = 1200, h = 800) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${bgColor}"/>
  <rect x="60" y="60" width="${w - 120}" height="${h - 120}" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  <text x="${w / 2}" y="${h * 0.35}" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
  <text x="${w / 2}" y="${h * 0.46}" font-family="Arial,sans-serif" font-size="22" fill="rgba(255,255,255,0.65)" text-anchor="middle">${subLabel}</text>
  <rect x="${w / 2 - 130}" y="${h * 0.55}" width="260" height="56" rx="28" fill="${accentColor}"/>
  <text x="${w / 2}" y="${h * 0.55 + 35}" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="${bgColor}" text-anchor="middle">무료로 시작하기</text>
  <text x="${w / 2}" y="${h * 0.84}" font-family="Arial,sans-serif" font-size="14" fill="rgba(255,255,255,0.35)" text-anchor="middle">TEST IMAGE — PURIT MISSION ASSET</text>
</svg>`);
}

async function uploadImage(companyId, missionUuid, filename, svgBuffer) {
  const path = `${companyId}/${missionUuid}/${filename}`;
  const { error } = await supabase.storage
    .from('mission-assets')
    .upload(path, svgBuffer, { contentType: 'image/svg+xml', upsert: true });
  if (error) { console.warn(`  이미지 업로드 실패(${filename}):`, error.message); return null; }
  const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
  return publicUrl;
}

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

async function main() {
  console.log('=== 테스트 의뢰 일괄 생성 (9개) ===\n');

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

  // [A-1] Purit SaaS LP 검증
  {
    const id = randomUUID();
    console.log('[A-1] Purit SaaS LP 검증 의뢰 생성 중...');
    const imgs = [];
    for (const [fn, label, sub, bg, ac] of [
      ['hero.svg',  'Purit 히어로 섹션', 'Purit - 패널 피드백으로 전환율을 높이세요', '#1a1a2e', '#6366F1'],
      ['value.svg', 'Purit 가치 제안',   '데이터로 증명하는 마케팅 최적화',           '#16213e', '#34D399'],
      ['cta.svg',   'Purit CTA 섹션',    '지금 바로 무료로 시작하세요',               '#0f3460', '#E8D5A3'],
    ]) {
      const url = await uploadImage(co, id, fn, makeSvg(label, sub, bg, ac));
      if (url) { imgs.push(url); console.log(`  ${fn} 업로드 완료`); }
    }
    const careerLevels = ['junior', 'middle'];
    const panelCount = 15;
    const focusAreas = ['첫인상 / 가독성', 'CTA 전환율', '핵심 메시지 명확성', '신뢰 요소', '타겟 일치도'];
    const description = JSON.stringify({
      product: 'Purit', lpUrl: 'https://purit.io', industry: 'SaaS/소프트웨어',
      personaAge: '25~35세', personaIncome: '월 400~700만원',
      personaRole: 'B2B SaaS 마케터 / 스타트업 대표',
      personaContext: '전환율 최적화에 관심이 많고, 마케팅 툴 도입 의사결정 경험이 있는 실무자',
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
    else { console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`); results.push('A-1 Purit SaaS LP'); }
  }

  // [A-2] 뷰티 브랜드 LP 검증
  {
    const id = randomUUID();
    console.log('[A-2] 뷰티 브랜드 LP 검증 의뢰 생성 중...');
    const imgs = [];
    for (const [fn, label, sub, bg, ac] of [
      ['hero.svg',  'Glowi 히어로',    '피부가 빛나는 순간, Glowi', '#1a0a1e', '#F472B6'],
      ['value.svg', 'Glowi 성분 가치', '자연성분으로 완성되는 광채', '#2d0a2e', '#C084FC'],
    ]) {
      const url = await uploadImage(co, id, fn, makeSvg(label, sub, bg, ac));
      if (url) { imgs.push(url); console.log(`  ${fn} 업로드 완료`); }
    }
    const careerLevels = ['junior'];
    const panelCount = 10;
    const focusAreas = ['첫인상 / 가독성', '비주얼 완성도', '신뢰 요소', '타겟 일치도'];
    const description = JSON.stringify({
      product: 'Glowi 스킨케어', lpUrl: 'https://glowi.co.kr', industry: '뷰티/코스메틱',
      personaAge: '20~35세', personaIncome: '월 200~450만원',
      personaRole: '직장인 여성 / 뷰티 관심층',
      personaContext: '자연성분 스킨케어에 관심이 많고 SNS 뷰티 콘텐츠를 즐겨 보는 소비자',
      briefText: '뷰티 브랜드 Glowi의 신제품 세럼 랜딩페이지입니다. 첫 화면의 비주얼 임팩트, 성분 가치 전달의 명확성, 타겟 페르소나와의 공감 포인트를 검증합니다.',
      focusAreas, imageUrls: imgs, selectedQuestions: Q.lp.slice(0, 4), careerLevels, panels: panelCount, step: 4,
    });
    const persona = '연령: 20~35세 / 소득: 월 200~450만원 / 직군: 직장인 여성 / 뷰티 관심층 / 산업군: 뷰티/코스메틱';
    const credits = calcCredits(panelCount, careerLevels, 'main');
    const reward = calcPanelPayout(careerLevels, 'main');
    const { error } = await supabase.from('missions').insert({
      id, company_id: co, title: '뷰티 브랜드 쇼핑몰 랜딩페이지 첫인상 검증',
      type: 'landing_page', target_url: 'https://glowi.co.kr',
      description, persona, panel_count: panelCount, filled_count: 0,
      reward_amount: reward, status: 'active', assets: focusAreas, image_urls: imgs,
      estimated_minutes: 6, credits_reserved: credits,
    });
    if (error) console.error('  INSERT 실패:', error.message);
    else { console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`); results.push('A-2 Glowi 뷰티 LP'); }
  }

  // [A-3] 헬스케어 앱 LP 검증
  {
    const id = randomUUID();
    console.log('[A-3] 헬스케어 앱 LP 검증 의뢰 생성 중...');
    const imgs = [];
    for (const [fn, label, sub, bg, ac] of [
      ['hero.svg',    'FitPath 히어로',    '당신만의 AI 헬스 코치',   '#0a1a0f', '#34D399'],
      ['feature.svg', 'FitPath 핵심 기능', '개인화된 운동 식단 플랜', '#0f2a1a', '#6EE7B7'],
      ['pricing.svg', 'FitPath 요금제',    '월 9900원으로 시작하세요', '#1a3a2a', '#A7F3D0'],
    ]) {
      const url = await uploadImage(co, id, fn, makeSvg(label, sub, bg, ac));
      if (url) { imgs.push(url); console.log(`  ${fn} 업로드 완료`); }
    }
    const careerLevels = ['junior', 'middle'];
    const panelCount = 12;
    const focusAreas = ['첫인상 / 가독성', '핵심 메시지 명확성', '가격 및 가치 전달', '타겟 일치도'];
    const description = JSON.stringify({
      product: 'FitPath', lpUrl: 'https://fitpath.app', industry: '헬스/피트니스',
      personaAge: '25~45세', personaIncome: '월 300~600만원',
      personaRole: '직장인 / 건강관리 관심층',
      personaContext: '바쁜 일상 속 효율적인 운동 및 식단 관리를 원하는 직장인으로 앱 구독에 익숙한 사용자',
      briefText: 'AI 퍼스널 트레이닝 앱 FitPath의 랜딩페이지입니다. 첫인상에서 핵심 가치(AI 코칭, 개인화된 운동 계획)가 얼마나 빠르게 전달되는지, 가격 플랜 구성이 타겟 사용자의 구독 결정을 유도하는지 검증합니다.',
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
    else { console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`); results.push('A-3 FitPath LP'); }
  }

  // [B-1] SNS 광고 배너 A/B 비교
  {
    const id = randomUUID();
    console.log('[B-1] SNS 광고 배너 A/B 비교 의뢰 생성 중...');
    const imgA = await uploadImage(co, id, 'va.svg',
      makeSvg('배너 A 기능 소구', '전환율을 정확하게 측정하세요', '#1a1a2e', '#6366F1', 800, 800));
    const imgB = await uploadImage(co, id, 'vb.svg',
      makeSvg('배너 B 감성 소구', '마케터의 직관을 데이터로 증명하세요', '#2d1a0a', '#F59E0B', 800, 800));
    if (imgA) console.log('  va.svg (배너 A) 업로드 완료');
    if (imgB) console.log('  vb.svg (배너 B) 업로드 완료');
    const careerLevels = ['junior'];
    const panelCount = 10;
    const description = JSON.stringify({
      variantA: '[배너 A 기능 소구] 헤드라인: 전환율을 정확하게 측정하세요 / 서브카피: 실제 타겟 패널의 반응으로 검증된 마케팅 소재 / CTA: 무료 체험 시작',
      variantB: '[배너 B 감성 소구] 헤드라인: 마케터의 직관을 데이터로 증명하세요 / 서브카피: 당신의 감각이 맞다는 걸 수치로 확인하세요 / CTA: 지금 바로 검증하기',
      variantAImage: imgA, variantBImage: imgB,
      productDescription: 'Purit — 실제 타겟 패널 피드백 기반 CRO SaaS. 마케팅 소재 검증, 랜딩페이지 최적화, 가격 검증 기능 제공',
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
      console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`);
      results.push('B-1 SNS 배너 A/B');
    }
  }

  // [B-2] 헤드라인 카피 A/B 비교
  {
    const id = randomUUID();
    console.log('[B-2] 헤드라인 카피 A/B 비교 의뢰 생성 중...');
    const careerLevels = ['junior', 'middle'];
    const panelCount = 10;
    const description = JSON.stringify({
      variantA: '[버전 A 결과 중심] "30일 안에 체지방 3kg 감량. AI가 계획하고 당신이 실행합니다." - 구체적 수치로 기대 결과 명시, AI와 사용자 역할 분리',
      variantB: '[버전 B 공감 중심] "매일 운동 루틴을 고민하느라 지쳤나요? 이제 AI가 대신 고민합니다." - 타겟 고충 직접 언급, 감성적 공감에서 출발',
      variantAImage: null, variantBImage: null,
      productDescription: 'FitPath — AI 퍼스널 트레이닝 앱. 사용자 체형 목표 생활 패턴 분석 후 개인화된 운동+식단 계획 자동 생성. 월 9900원 구독.',
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
      console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`);
      results.push('B-2 FitPath 헤드라인 A/B');
    }
  }

  // [C-1] Purit SaaS 요금제 가격 검증
  {
    const id = randomUUID();
    console.log('[C-1] Purit SaaS 구독 요금제 가격 검증 의뢰 생성 중...');
    const imgUrl = await uploadImage(co, id, 'pricing.svg',
      makeSvg('Purit 요금제 비교', 'Starter Pro Enterprise', '#0f1a2e', '#6366F1'));
    if (imgUrl) console.log('  pricing.svg 업로드 완료');
    const careerLevels = ['junior'];
    const panelCount = 10;
    const content = `Purit 요금제 구성 (CRO SaaS)

[ Starter - 월 82만원(무약정) / 월 68만원(연간) ]
월 50 크레딧 / 패널 10~15명 / 주니어+미들급 / 추가크레딧 25,000원/cr

[ Pro - 월 238만원(무약정) / 월 198만원(연간) ]
월 165 크레딧 / 패널 10~30명 / 시니어+헤드 포함 / 추가크레딧 21,600원/cr (14% 할인)

[ Enterprise - 월 450만원~(연간 전용) ]
월 400+ 크레딧 / 패널 무제한 / 산업군 핀셋 필터링 / 전담 CSM 배정`;
    const description = JSON.stringify({
      content, image: imgUrl,
      productDescription: 'Purit — 실제 타겟 패널 피드백으로 마케팅 자산의 전환율을 높이는 B2B CRO SaaS. 랜딩페이지, 광고 소재, 가격 페이지, 이메일 4가지 검증 도구 제공.',
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
      console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`);
      results.push('C-1 Purit 요금제 검증');
    }
  }

  // [C-2] 헬스케어 앱 구독 가격 검증
  {
    const id = randomUUID();
    console.log('[C-2] 헬스케어 앱 구독 가격 적정성 검증 의뢰 생성 중...');
    const careerLevels = ['junior'];
    const panelCount = 10;
    const content = `FitPath 구독 요금제 (AI 헬스 코칭 앱)

[ 무료 플랜 ]
AI 운동 계획 월 3회 / 기본 식단 분석 / 운동 기록 최근 30일 / 광고 포함

[ 프리미엄 - 월 9,900원 ]
AI 운동 계획 무제한 / 고급 식단 분석+영양소 트래킹 / 운동 기록 무제한 / 라이브 코칭 월 2회 / 광고 없음

[ 연간 구독 - 79,000원/년 (34% 할인) ]
프리미엄 전부 포함 / 체성분 분석 리포트 분기 1회 / 전담 AI 코치 / 가족 계정 1인 무료`;
    const description = JSON.stringify({
      content, image: null,
      productDescription: 'FitPath — AI 퍼스널 트레이닝 앱. 체형+목표+생활 패턴 분석 후 개인화 운동+식단 플랜 자동 생성. 누적 다운로드 50만+, 평점 4.8.',
      industry: '헬스/피트니스', selectedQuestions: Q.pricing, careerLevels,
    });
    const persona = '연령: 20~40세 / 직군: 직장인 / 건강관리 관심층 / 산업군: 헬스/피트니스';
    const credits = calcCredits(panelCount, careerLevels, 'sub');
    const reward = calcPanelPayout(careerLevels, 'sub');
    const { error: mErr } = await supabase.from('missions').insert({
      id, company_id: co, title: '헬스케어 앱 월/연간 구독 요금제 가격 적정성 검증',
      type: 'pricing', target_url: null, description, persona,
      panel_count: panelCount, filled_count: 0, reward_amount: reward, status: 'active',
      assets: ['가격 적정성', '무료-유료 전환 장벽', '연간 구독 유인'],
      image_urls: [], estimated_minutes: 5, credits_reserved: credits,
    });
    if (mErr) { console.error('  missions INSERT 실패:', mErr.message); }
    else {
      const { error: tErr } = await supabase.from('pricing_tests').insert({
        id: randomUUID(), company_id: co, mission_id: id, status: 'active',
      });
      if (tErr) console.warn('  pricing_tests INSERT 경고:', tErr.message);
      console.log(`  완료 (credits: ${credits}, reward: ${reward})\n`);
      results.push('C-2 FitPath 구독 가격 검증');
    }
  }

  // [D-1] B2B SaaS 콜드 리치아웃 이메일
  {
    const id = randomUUID();
    console.log('[D-1] B2B SaaS 콜드 리치아웃 이메일 검증 의뢰 생성 중...');
    const careerLevels = ['junior', 'middle'];
    const panelCount = 10;
    const emailText = `제목: [Purit] 마케팅 소재 A/B 테스트, 이제 실제 타겟에게 물어보세요

안녕하세요, [이름]님.

저는 Purit의 [발신자 이름]입니다.

다름이 아니라, [회사명]의 마케팅팀이 어떤 소재가 타겟에게 실제로 먹히는지 확인하는 데 시간과 비용을 많이 쓰고 계실 것 같아 연락드렸습니다.

저희 Purit는 실제 타겟 페르소나와 일치하는 B2B 마케터 및 실무자 패널 500+명과 함께, 랜딩페이지/광고 소재/가격 페이지를 48시간 안에 검증해드리는 CRO 서비스입니다.

현재 가장 많이 쓰시는 사용 사례:
- 어떤 헤드라인이 우리 타겟에게 더 잘 먹히나? A/B 카피 테스트
- 이 랜딩페이지가 왜 전환이 안 되는지 모르겠다. 5차원 UX 진단
- 가격이 너무 높게 느껴지는 건 아닐까? 가격 적정성 검증

다음 주 15분 정도 간단히 데모를 보여드릴 수 있을까요?

이번 주 가능한 시간을 알려주시면 맞춰 드리겠습니다.

감사합니다.
[발신자 이름] 드림
Purit | 전환율 최적화 SaaS
hello@purit.io | purit.io`;
    const description = JSON.stringify({
      content: emailText,
      productDescription: 'Purit — 실제 타겟 패널 피드백 기반 CRO SaaS. B2B 마케터 스타트업 대표 대상 콜드 리치아웃 이메일 효과 측정.',
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

  // [D-2] 뷰티 브랜드 프로모션 이메일
  {
    const id = randomUUID();
    console.log('[D-2] 뷰티 브랜드 프로모션 이메일 검증 의뢰 생성 중...');
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

[비건 무향 EWG 그린 등급]
민감한 피부도 안심하고 쓸 수 있습니다.

지금 출시 기념으로 30% 할인 + 샘플 키트 증정 중입니다.

-> 지금 구매하기 (72시간 한정)

아직 고민 중이시라면, 공식 인스타그램(@glowi.official)에서 실사용 후기를 확인해보세요.

오늘도 빛나는 하루 되세요.
Glowi 팀 드림`;
    const description = JSON.stringify({
      content: emailText,
      productDescription: 'Glowi — 피부과 성분 기반 비건 스킨케어 브랜드. 신제품 Dew Drop Serum(히알루론산+나이아신아마이드) 출시 프로모션 이메일 효과 측정.',
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
      results.push('D-2 Glowi 프로모션 이메일');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`생성 완료: ${results.length}/9개`);
  results.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n확인: /company (어드민 계정으로 로그인)');
}

main().catch(e => { console.error('예상치 못한 오류:', e); process.exit(1); });
