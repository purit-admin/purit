/**
 * 테스트 메인 의뢰(LP검증) 생성 스크립트
 * purit.admin@gmail.com의 company 계정으로 모든 필드가 채워진 테스트 의뢰를 생성합니다.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'node:crypto';

// .env.local 파일에서 환경변수 로드
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'purit.admin@gmail.com';

// ── 미션 데이터 ──────────────────────────────────────────────────────────────

const MISSION_DATA = {
  title: 'Purit SaaS 랜딩페이지 전환율 검증',
  lpUrl: 'https://purit.io',
  personaAge: '25~35세',
  personaIncome: '월 400~700만원',
  personaRole: 'B2B SaaS 마케터 / 스타트업 대표',
  personaContext: '전환율 최적화에 관심이 많고, 마케팅 툴 도입 의사결정 경험이 있는 실무자',
  briefText: 'Purit는 실제 타겟 패널의 피드백으로 랜딩페이지 전환율을 높이는 CRO SaaS입니다. 이번 검증에서는 ①히어로 섹션의 첫인상, ②가치 제안의 명확성, ③CTA 버튼 클릭 충동, ④신뢰 요소 구성이 타겟 페르소나에게 얼마나 효과적으로 작동하는지 확인하고자 합니다.',
  focusAreas: ['첫인상 / 가독성', 'CTA 전환율', '핵심 메시지 명확성', '신뢰 요소', '타겟 일치도'],
  panelCount: 15,
  careerLevels: ['junior', 'middle'],
};

// LP 질문 (3개 템플릿에서 총 5개 선택)
const SELECTED_QUESTIONS = [
  { id: 'lp4a-q1', text: '이 랜딩페이지의 핵심 가치가 5초 안에 명확하게 이해됩니까?', type: 'scale', options: [] },
  { id: 'lp4a-q2', text: '첫 화면을 보고 난 후 가장 먼저 드는 감정은 무엇입니까?', type: 'radio', options: ['신뢰감', '궁금함', '무관심', '혼란스러움'] },
  { id: 'lp4b-q1', text: '헤드라인 카피가 귀하의 현재 상황이나 고민을 얼마나 정확히 묘사합니까?', type: 'scale', options: [] },
  { id: 'lp4c-q4', text: '최종적으로 이 페이지에서 전환(가입/구매/문의)할 의향은 어느 정도입니까?', type: 'scale', options: [] },
  { id: 'lp4c-q5', text: '전환을 가로막는 가장 결정적인 장애 요소를 한 문장으로 적어주세요.', type: 'text', options: [] },
];

// ── 테스트 이미지 (SVG → Buffer) ────────────────────────────────────────────

function makeSvgBuffer(label, bgColor, width = 1200, height = 800) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <rect x="60" y="60" width="${width - 120}" height="${height - 120}" rx="16" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <text x="${width / 2}" y="${height * 0.38}" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">Purit LP — ${label}</text>
  <text x="${width / 2}" y="${height * 0.5}" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.7)" text-anchor="middle">패널 피드백으로 전환율을 높이세요</text>
  <rect x="${width / 2 - 120}" y="${height * 0.58}" width="240" height="52" rx="26" fill="white"/>
  <text x="${width / 2}" y="${height * 0.58 + 33}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${bgColor}" text-anchor="middle">무료로 시작하기 →</text>
  <text x="${width / 2}" y="${height * 0.82}" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.5)" text-anchor="middle">TEST IMAGE — PURIT MISSION ASSET</text>
</svg>`;
  return Buffer.from(svg);
}

const TEST_IMAGES = [
  { label: '히어로 섹션',   bg: '#1a1a2e', filename: 'hero.svg' },
  { label: '가치 제안',     bg: '#16213e', filename: 'value.svg' },
  { label: '요금제 비교',   bg: '#0f3460', filename: 'pricing.svg' },
  { label: '고객 후기',     bg: '#533483', filename: 'social.svg' },
  { label: 'CTA 섹션',      bg: '#2d6a4f', filename: 'cta.svg' },
];

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== 테스트 메인 의뢰 생성 ===\n');

  // 1. 관리자 유저 확인
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 조회 실패:', uErr.message); process.exit(1); }

  const adminUser = users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`❌ ${ADMIN_EMAIL} 계정을 찾을 수 없습니다.`); process.exit(1); }
  console.log(`✅ 어드민 유저: ${adminUser.email} (${adminUser.id})`);

  // 2. company 레코드 확인
  const { data: company, error: cErr } = await supabase
    .from('companies')
    .select('id, name, plan')
    .eq('user_id', adminUser.id)
    .single();

  if (cErr || !company) {
    console.error('❌ company 레코드를 찾을 수 없습니다:', cErr?.message);
    process.exit(1);
  }
  console.log(`✅ 기업 레코드: ${company.name || '(unnamed)'} (id: ${company.id}, plan: ${company.plan})\n`);

  // 3. 미션 UUID 사전 생성
  const missionUuid = randomUUID();
  console.log(`📋 미션 UUID: ${missionUuid}`);

  // 4. 테스트 이미지 업로드
  console.log('\n📤 테스트 이미지 5장 업로드 중...');
  const imageUrls = [];

  for (const img of TEST_IMAGES) {
    const svgBuffer = makeSvgBuffer(img.label, img.bg);
    const path = `${company.id}/${missionUuid}/${img.filename}`;

    const { error: uploadErr } = await supabase.storage
      .from('mission-assets')
      .upload(path, svgBuffer, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (uploadErr) {
      console.warn(`  ⚠️  ${img.label} 업로드 실패: ${uploadErr.message}`);
      continue;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('mission-assets')
      .getPublicUrl(path);

    imageUrls.push(publicUrl);
    console.log(`  ✅ ${img.label}: ${publicUrl}`);
  }

  if (imageUrls.length === 0) {
    console.error('\n❌ 이미지 업로드가 모두 실패했습니다. Storage 버킷 권한을 확인해주세요.');
    process.exit(1);
  }

  console.log(`\n✅ ${imageUrls.length}장 업로드 완료`);

  // 5. 크레딧 계산 (주니어 1.0× + 미들 1.5× 평균 = 1.25×)
  const careerMultiplierAvg = (1.0 + 1.5) / 2; // 1.25
  const credits = Math.ceil(MISSION_DATA.panelCount * careerMultiplierAvg);
  const rewardAmount = credits * 10000;

  // 6. description JSON 구성
  const persona = [
    `연령: ${MISSION_DATA.personaAge}`,
    `소득: ${MISSION_DATA.personaIncome}`,
    `직군: ${MISSION_DATA.personaRole}`,
    MISSION_DATA.personaContext,
  ].join(' / ');

  const description = JSON.stringify({
    briefText: MISSION_DATA.briefText,
    careerLevels: MISSION_DATA.careerLevels,
    selectedQuestions: SELECTED_QUESTIONS,
  });

  // 7. missions INSERT
  console.log('\n📝 미션 데이터 INSERT 중...');
  const { error: insertErr } = await supabase.from('missions').insert({
    id:                missionUuid,
    company_id:        company.id,
    title:             MISSION_DATA.title,
    type:              'landing_page',
    target_url:        MISSION_DATA.lpUrl,
    description,
    persona,
    panel_count:       MISSION_DATA.panelCount,
    reward_amount:     rewardAmount,
    status:            'active',
    assets:            MISSION_DATA.focusAreas,
    image_urls:        imageUrls,
    estimated_minutes: 7,
    filled_count:      0,
  });

  if (insertErr) {
    console.error('❌ 미션 INSERT 실패:', insertErr.message);
    process.exit(1);
  }

  console.log('\n🎉 테스트 메인 의뢰 생성 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  제목:       ${MISSION_DATA.title}`);
  console.log(`  미션 ID:    ${missionUuid}`);
  console.log(`  LP URL:     ${MISSION_DATA.lpUrl}`);
  console.log(`  페르소나:   ${persona}`);
  console.log(`  검증 포인트: ${MISSION_DATA.focusAreas.join(', ')}`);
  console.log(`  패널 수:    ${MISSION_DATA.panelCount}명`);
  console.log(`  경력 레벨:  ${MISSION_DATA.careerLevels.join(', ')}`);
  console.log(`  선택 질문:  ${SELECTED_QUESTIONS.length}개`);
  console.log(`  이미지:     ${imageUrls.length}장`);
  console.log(`  보상:       ${rewardAmount.toLocaleString()}원 (${credits}크레딧)`);
  console.log(`  상태:       active`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n👉 확인: https://purit.io/company (어드민 계정으로 로그인)`);
}

main().catch(e => { console.error('예상치 못한 오류:', e); process.exit(1); });
