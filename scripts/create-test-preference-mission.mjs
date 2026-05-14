/**
 * 테스트 소재비교(preference) 의뢰 생성 스크립트
 * purit.admin@gmail.com의 company 계정으로 모든 필드가 채워진 의뢰를 생성합니다.
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
  console.error('❌ 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'purit.admin@gmail.com';

// ── 의뢰 데이터 ────────────────────────────────────────────────────────────────

const MISSION_DATA = {
  title: 'Purit 신규 광고 소재 A/B 전환력 검증',
  industry: 'SaaS/소프트웨어',
  productDescription: 'Purit는 기업이 실제 타겟 패널에게 마케팅 소재를 검증받는 CRO 플랫폼입니다. 주 타겟은 마케팅 비용 대비 성과가 떨어진다고 느끼는 B2B SaaS 마케터 및 스타트업 대표입니다.',
  assetType: 'image',
  variantAText: '지금 쓰는 마케팅 비용, 얼마나 낭비되고 있나요?\nPurit로 실제 타겟에게 검증받고 전환율을 2배로 높이세요.\n✓ 48시간 내 피드백  ✓ 5차원 정량 분석  ✓ 패널 100% 검증',
  variantBText: '전환율 40% 개선, 데이터가 증명합니다.\n실제 구매 의사결정자 100명의 피드백으로\n랜딩페이지를 완성하세요.\n→ 지금 무료 체험',
  panelCount: 10,
  careerLevels: ['junior', 'middle', 'senior'],
};

// 소재비교 질문 (광고소재A/B 템플릿 5개 전부)
const SELECTED_QUESTIONS = [
  { id: 'p1a-q1', text: '두 소재 중 첫 3초 안에 시선을 더 강력하게 끄는 것은 무엇입니까?', type: 'radio', options: ['A', 'B'] },
  { id: 'p1a-q2', text: '선택한 소재가 귀하의 현재 필요(Needs)를 얼마나 잘 짚어냈습니까?', type: 'scale', options: [] },
  { id: 'p1a-q3', text: '선택한 소재에서 가장 매력적으로 느껴진 요소는 무엇입니까?', type: 'radio', options: ['카피라이팅', '디자인/이미지', '혜택/할인', '신뢰성'] },
  { id: 'p1a-q4', text: '두 소재 중 \'클릭해서 더 알아보기\'를 누르고 싶은 충동이 더 큰 것은 무엇입니까?', type: 'radio', options: ['A', 'B'] },
  { id: 'p1a-q5', text: '선택한 소재가 상대방 소재보다 더 끌렸던 결정적인 이유를 한 문장으로 적어주세요.', type: 'text', options: [] },
];

// ── 테스트 이미지 생성 ──────────────────────────────────────────────────────────

function makeVariantSvg(variant, headline, sub, cta, bgTop, bgBottom, accentColor) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgTop}"/>
      <stop offset="100%" stop-color="${bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="628" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="628" fill="rgba(0,0,0,0.15)"/>

  <!-- 소재 구분 뱃지 -->
  <rect x="48" y="44" width="72" height="36" rx="18" fill="${accentColor}"/>
  <text x="84" y="67" font-family="Arial" font-size="18" font-weight="bold" fill="white" text-anchor="middle">소재 ${variant}</text>

  <!-- 헤드라인 -->
  <text x="600" y="230" font-family="Arial" font-size="52" font-weight="bold" fill="white" text-anchor="middle">${headline}</text>

  <!-- 서브카피 -->
  <text x="600" y="300" font-family="Arial" font-size="26" fill="rgba(255,255,255,0.85)" text-anchor="middle">${sub}</text>

  <!-- CTA 버튼 -->
  <rect x="450" y="360" width="300" height="60" rx="30" fill="${accentColor}"/>
  <text x="600" y="397" font-family="Arial" font-size="20" font-weight="bold" fill="white" text-anchor="middle">${cta}</text>

  <!-- 하단 신뢰 요소 -->
  <text x="600" y="520" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.5)" text-anchor="middle">TEST IMAGE — PURIT PREFERENCE MISSION ASSET ${variant}</text>
</svg>`);
}

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== 테스트 소재비교 의뢰 생성 ===\n');

  // 1. 어드민 유저 확인
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 조회 실패:', uErr.message); process.exit(1); }

  const adminUser = users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`❌ ${ADMIN_EMAIL} 계정 없음`); process.exit(1); }
  console.log(`✅ 어드민 유저: ${adminUser.email} (${adminUser.id})`);

  // 2. company 레코드 확인
  const { data: company, error: cErr } = await supabase
    .from('companies')
    .select('id, name, plan')
    .eq('user_id', adminUser.id)
    .single();

  if (cErr || !company) { console.error('❌ company 레코드 없음:', cErr?.message); process.exit(1); }
  console.log(`✅ 기업: ${company.name} (id: ${company.id}, plan: ${company.plan})\n`);

  // 3. UUID 사전 생성
  const missionUuid = randomUUID();
  console.log(`📋 미션 UUID: ${missionUuid}`);

  // 4. 소재 이미지 업로드 (A/B 각 1장)
  console.log('\n📤 소재 이미지 업로드 중...');

  const imgA = makeVariantSvg(
    'A',
    '마케팅 낭비, 지금 멈추세요',
    '실제 타겟 패널 피드백으로 전환율 2배',
    '무료로 시작하기 →',
    '#1a1a2e', '#10367D', '#CF6A44'
  );
  const imgB = makeVariantSvg(
    'B',
    '전환율 40% 개선, 데이터 증명',
    '구매결정자 100명의 실피드백으로 완성',
    '지금 무료 체험 →',
    '#0f3460', '#2d6a4f', '#10B981'
  );

  const uploads = [
    { buf: imgA, filename: 'va.svg', label: '소재 A' },
    { buf: imgB, filename: 'vb.svg', label: '소재 B' },
  ];

  const imageUrls = {};
  for (const { buf, filename, label } of uploads) {
    const path = `${company.id}/${missionUuid}/${filename}`;
    const { error: upErr } = await supabase.storage
      .from('mission-assets')
      .upload(path, buf, { contentType: 'image/svg+xml', upsert: true });

    if (upErr) { console.warn(`  ⚠️  ${label} 업로드 실패: ${upErr.message}`); continue; }

    const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
    imageUrls[filename === 'va.svg' ? 'A' : 'B'] = publicUrl;
    console.log(`  ✅ ${label}: ${publicUrl}`);
  }

  // 5. 크레딧 계산 (주니어1×, 미들1.5×, 시니어2× → 3개 직급 → 혼합상한 1.8×)
  const maxMultiplier = 1.8; // 3개 이상 직급 선택 시 혼합상한
  const credits = Math.ceil(MISSION_DATA.panelCount * maxMultiplier * 1.0); // 서브 의뢰 ×1.0
  const rewardAmount = Math.round(4500 * maxMultiplier); // 서브 기준 4,500원

  // 6. description JSON
  const description = JSON.stringify({
    assetType: MISSION_DATA.assetType,
    variantA: MISSION_DATA.variantAText,
    variantB: MISSION_DATA.variantBText,
    variantAImage: imageUrls['A'] || null,
    variantBImage: imageUrls['B'] || null,
    productDescription: MISSION_DATA.productDescription,
    industry: MISSION_DATA.industry,
    selectedQuestions: SELECTED_QUESTIONS,
    careerLevels: MISSION_DATA.careerLevels,
    panels: MISSION_DATA.panelCount,
    step: 3,
  });

  // 7. missions INSERT
  console.log('\n📝 missions INSERT 중...');
  const { error: mErr } = await supabase.from('missions').insert({
    id:            missionUuid,
    company_id:    company.id,
    title:         MISSION_DATA.title,
    type:          'preference',
    description,
    panel_count:   MISSION_DATA.panelCount,
    reward_amount: rewardAmount,
    status:        'active',
    filled_count:  0,
  });

  if (mErr) { console.error('❌ missions INSERT 실패:', mErr.message); process.exit(1); }
  console.log('✅ missions INSERT 완료');

  // 8. preference_tests INSERT
  const { error: ptErr } = await supabase.from('preference_tests').insert({
    company_id:  company.id,
    mission_id:  missionUuid,
    asset_type:  MISSION_DATA.assetType,
    variant_a:   MISSION_DATA.variantAText,
    variant_b:   MISSION_DATA.variantBText,
    panel_size:  MISSION_DATA.panelCount,
    status:      'active',
  });

  if (ptErr) console.warn('⚠️  preference_tests INSERT 실패 (무시):', ptErr.message);
  else console.log('✅ preference_tests INSERT 완료');

  console.log('\n🎉 소재비교 의뢰 생성 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  제목:         ${MISSION_DATA.title}`);
  console.log(`  미션 ID:      ${missionUuid}`);
  console.log(`  타입:         preference (소재비교)`);
  console.log(`  산업군:       ${MISSION_DATA.industry}`);
  console.log(`  소재 유형:    이미지`);
  console.log(`  소재 A 이미지: ${imageUrls['A'] || '없음'}`);
  console.log(`  소재 B 이미지: ${imageUrls['B'] || '없음'}`);
  console.log(`  추가 질문:    ${SELECTED_QUESTIONS.length}개`);
  console.log(`  패널:         ${MISSION_DATA.panelCount}명 (주니어+미들+시니어)`);
  console.log(`  예상 크레딧:  ${credits}cr`);
  console.log(`  상태:         active`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(e => { console.error('오류:', e); process.exit(1); });
