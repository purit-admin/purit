/**
 * 전체 테스트 의뢰 일괄 생성 스크립트
 * purit.admin@gmail.com의 company 계정으로:
 *   - 메인 의뢰(LP검증) 3개 (이미지·질문 포함)
 *   - 소재비교 서브 의뢰 4개
 *   - 가격검증 서브 의뢰 4개
 *   - 이메일검증 서브 의뢰 4개
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

// ══════════════════════════════════════════════════════════════
// SVG 이미지 생성 헬퍼
// ══════════════════════════════════════════════════════════════

function makeSvg(label, bg, accent, subLabel = '', w = 1200, h = 800) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <rect x="60" y="60" width="${w-120}" height="${h-120}" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  <text x="${w/2}" y="${h*0.32}" font-family="Arial,sans-serif" font-size="13" fill="${accent}" text-anchor="middle" letter-spacing="4">${subLabel.toUpperCase()}</text>
  <text x="${w/2}" y="${h*0.46}" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
  <rect x="${w/2-100}" y="${h*0.56}" width="200" height="46" rx="23" fill="${accent}"/>
  <text x="${w/2}" y="${h*0.56+29}" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">지금 시작하기 →</text>
  <text x="${w/2}" y="${h*0.84}" font-family="Arial,sans-serif" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle">TEST ASSET — PURIT</text>
</svg>`);
}

// ══════════════════════════════════════════════════════════════
// Storage 업로드 헬퍼
// ══════════════════════════════════════════════════════════════

async function uploadSvg(path, buffer) {
  const { error } = await supabase.storage.from('mission-assets').upload(path, buffer, {
    contentType: 'image/svg+xml', upsert: true,
  });
  if (error) throw new Error(`업로드 실패 [${path}]: ${error.message}`);
  return supabase.storage.from('mission-assets').getPublicUrl(path).data.publicUrl;
}

// ══════════════════════════════════════════════════════════════
// 메인 의뢰 데이터 (3개)
// ══════════════════════════════════════════════════════════════

const MAIN_MISSIONS = [
  {
    title: '핏블리 — 홈트레이닝 앱 랜딩페이지 전환율 검증',
    lpUrl: 'https://fitbly.kr',
    industry: '헬스/피트니스',
    personaAge: '20~35세',
    personaIncome: '월 250~450만원',
    personaRole: '직장인 / 운동 관심자',
    personaContext: '헬스장 대신 집에서 운동하고 싶어 하며 동기부여 유지에 어려움을 느끼는 초~중급 운동자',
    briefText: '핏블리는 AI 맞춤 홈트 루틴을 제공하는 앱입니다. 이번 검증에서는 ①히어로 섹션의 첫인상과 앱 가치 전달, ②CTA "무료 체험" 버튼의 클릭 충동, ③후기·인증 화면의 신뢰도가 타겟 페르소나에게 효과적으로 작동하는지 확인합니다.',
    focusAreas: ['첫인상 / 가독성', 'CTA 전환율', '신뢰 요소', '비주얼 완성도'],
    panelCount: 12,
    careerLevels: ['junior', 'middle'],
    images: [
      { label: '히어로 섹션', sub: 'Hero', bg: '#0d1b2a', accent: '#00c896', file: 'hero.svg' },
      { label: '기능 소개', sub: 'Features', bg: '#1b2838', accent: '#00c896', file: 'features.svg' },
      { label: '가격 & CTA', sub: 'Pricing', bg: '#12232e', accent: '#00c896', file: 'pricing.svg' },
    ],
    questions: [
      { id: 'q1', text: '이 앱의 핵심 기능이 5초 안에 명확하게 이해됩니까?', type: 'scale', options: [] },
      { id: 'q2', text: '첫 화면을 본 후 가장 먼저 드는 감정은 무엇입니까?', type: 'radio', options: ['설레고 해보고 싶다', '평범하다', '복잡해 보인다', '믿기 어렵다'] },
      { id: 'q3', text: '"무료 체험" CTA 버튼의 문구와 디자인이 클릭 충동을 유발합니까?', type: 'scale', options: [] },
      { id: 'q4', text: '후기 및 실제 사용자 결과물이 신뢰를 주는 정도는?', type: 'scale', options: [] },
      { id: 'q5', text: '구매 또는 가입을 가로막는 가장 큰 이유를 한 문장으로 적어주세요.', type: 'text', options: [] },
    ],
  },
  {
    title: '아이리스 CRM — B2B SaaS 랜딩페이지 전환율 검증',
    lpUrl: 'https://iriscrm.io',
    industry: 'SaaS / B2B',
    personaAge: '28~45세',
    personaIncome: '월 500~900만원',
    personaRole: '영업팀 리더 / 스타트업 CTO / 운영 담당자',
    personaContext: '팀의 고객 관리가 스프레드시트로 분산되어 있고, CRM 도입을 검토 중인 B2B 실무자',
    briefText: '아이리스 CRM은 소규모 영업팀을 위한 AI 자동화 고객 관리 솔루션입니다. 이번 검증에서는 ①헤드라인 카피가 타겟 고민을 정확히 짚는지, ②기능 설명의 명확성, ③요금제 비교표의 이해 용이성, ④"14일 무료 체험" 전환 의향을 측정합니다.',
    focusAreas: ['핵심 메시지 명확성', 'CTA 전환율', '가격 및 가치 전달', '타겟 일치도'],
    panelCount: 15,
    careerLevels: ['middle', 'senior'],
    images: [
      { label: '히어로 & 카피', sub: 'Hero Copy', bg: '#1a1a2e', accent: '#6c63ff', file: 'hero.svg' },
      { label: '기능 대시보드', sub: 'Dashboard', bg: '#16213e', accent: '#6c63ff', file: 'dashboard.svg' },
      { label: '요금제 비교표', sub: 'Pricing Table', bg: '#0f3460', accent: '#e94560', file: 'pricing.svg' },
    ],
    questions: [
      { id: 'q1', text: '헤드라인이 귀하의 현재 업무 고민을 정확히 묘사합니까?', type: 'scale', options: [] },
      { id: 'q2', text: '기능 설명을 읽고 이 제품이 무엇을 해결해 주는지 바로 이해됩니까?', type: 'scale', options: [] },
      { id: 'q3', text: '요금제 구성 중 귀하의 팀에 가장 적합해 보이는 플랜은?', type: 'radio', options: ['스타터 (3인 이하)', '그로스 (10인 이하)', '엔터프라이즈 (협의)', '아직 모르겠다'] },
      { id: 'q4', text: '14일 무료 체험을 신청할 의향은?', type: 'scale', options: [] },
      { id: 'q5', text: '이 페이지에서 전환을 망설이게 만드는 요소를 구체적으로 적어주세요.', type: 'text', options: [] },
    ],
  },
  {
    title: '나비 — 직장인 온라인 교육 플랫폼 랜딩페이지 검증',
    lpUrl: 'https://nabi.edu',
    industry: '에듀테크',
    personaAge: '25~40세',
    personaIncome: '월 300~600만원',
    personaRole: '직장인 / 커리어 전환 희망자',
    personaContext: '퇴근 후 자기계발을 원하지만 시간이 부족하고, 온라인 강의 이수율이 낮아 실질적 성과를 원하는 직장인',
    briefText: '나비는 "완강률 92%"를 내세우는 직장인 마이크로 러닝 플랫폼입니다. 이번 검증에서는 ①"완강률 92%" 수치의 신뢰도, ②커리큘럼 미리보기 섹션의 설득력, ③수강 후기의 공감도, ④가격 대비 가치 인식을 측정합니다.',
    focusAreas: ['신뢰 요소', '핵심 메시지 명확성', '가격 및 가치 전달', '첫인상 / 가독성'],
    panelCount: 10,
    careerLevels: ['junior', 'middle'],
    images: [
      { label: '히어로 & 수치', sub: 'Hero Stats', bg: '#2d1b69', accent: '#f7b731', file: 'hero.svg' },
      { label: '커리큘럼 미리보기', sub: 'Curriculum', bg: '#1e1e2e', accent: '#f7b731', file: 'curriculum.svg' },
      { label: '수강 후기 섹션', sub: 'Reviews', bg: '#12102b', accent: '#f7b731', file: 'reviews.svg' },
    ],
    questions: [
      { id: 'q1', text: '"완강률 92%"라는 수치가 신뢰할 만하게 느껴집니까?', type: 'scale', options: [] },
      { id: 'q2', text: '커리큘럼 미리보기를 보고 수강 후 얻을 수 있는 것이 명확합니까?', type: 'scale', options: [] },
      { id: 'q3', text: '수강생 후기가 귀하의 상황과 얼마나 공감됩니까?', type: 'scale', options: [] },
      { id: 'q4', text: '월 39,900원 가격이 제공 가치 대비 적절하다고 느껴집니까?', type: 'radio', options: ['매우 저렴하다', '적절하다', '약간 비싸다', '너무 비싸다'] },
      { id: 'q5', text: '수강 신청을 결정하기 위해 추가로 알고 싶은 정보는 무엇입니까?', type: 'text', options: [] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// 소재 비교(preference) 서브 의뢰 데이터 (4개)
// ══════════════════════════════════════════════════════════════

const PREFERENCE_MISSIONS = [
  {
    title: '핏블리 SNS 배너 광고 소재 A/B 비교',
    industry: '헬스/피트니스',
    productDescription: '핏블리 홈트 앱 — 30대 직장인을 타겟으로 한 인스타그램 피드 배너 광고입니다. 주요 KPI는 광고 클릭율(CTR) 향상입니다.',
    variantA: '[소재 A — 감성형]\n"퇴근 후 10분, 당신의 몸이 바뀝니다"\n\n홈트레이닝으로 3주 만에 -5kg 달성한 실제 후기 사진 배경, 소프트한 톤앤매너, "지금 무료 체험" CTA 버튼 (연두색)',
    variantB: '[소재 B — 기능형]\n"AI가 설계한 맞춤 홈트 루틴 — 오늘부터 시작"\n\n앱 UI 스크린샷 + 기능 아이콘(칼로리·운동 추적·코치 AI) 배치, 화이트 배경에 그린 포인트, "앱 다운로드" CTA (그린)',
    panelCount: 10,
    careerLevels: ['junior', 'middle'],
    questions: [
      { id: 'q1', text: '어느 소재가 광고를 보자마자 더 클릭하고 싶게 만듭니까?', type: 'radio', options: ['소재 A (감성형)', '소재 B (기능형)', '둘 다 비슷하다'] },
      { id: 'q2', text: '선택한 소재가 더 효과적으로 느껴지는 이유를 구체적으로 적어주세요.', type: 'text', options: [] },
      { id: 'q3', text: '선택하지 않은 소재에서 개선이 필요한 점은 무엇입니까?', type: 'text', options: [] },
    ],
    variantAImageLabel: '소재 A 감성형 배너',
    variantBImageLabel: '소재 B 기능형 배너',
    variantABg: '#2d6a4f', variantAAcc: '#b7e4c7',
    variantBBg: '#f8f9fa', variantBAcc: '#00c896',
  },
  {
    title: '아이리스 CRM 이메일 마케팅 카피 A/B 테스트',
    industry: 'SaaS / B2B',
    productDescription: '아이리스 CRM 뉴스레터 — B2B 영업팀 리더를 대상으로 한 이메일 마케팅 카피입니다. 목표는 데모 신청 CTR 향상입니다.',
    variantA: '[카피 A — 문제 중심]\n제목: "영업팀 리드가 스프레드시트에서 길을 잃고 있습니까?"\n\n본문 시작: "고객 정보가 팀원마다 다른 파일에 흩어져 있는 건 알지만, 바꾸기엔 너무 복잡해 보이죠. 아이리스 CRM은 딱 15분 온보딩으로 모든 리드를 한 곳에 모아줍니다." → [무료 데모 신청]',
    variantB: '[카피 B — 결과 중심]\n제목: "팀 영업 성과 27% 향상, 아이리스 CRM 도입 60일 성과"\n\n본문 시작: "런던의 B2B SaaS 스타트업 Zeno가 아이리스를 도입한 후 60일 만에 성약률이 27% 올랐습니다. 어떻게 했는지 알아보세요." → [성공 사례 보기 & 데모 신청]',
    panelCount: 12,
    careerLevels: ['middle', 'senior'],
    questions: [
      { id: 'q1', text: '어느 카피가 더 클릭해서 데모를 신청하고 싶게 만듭니까?', type: 'radio', options: ['카피 A (문제 중심)', '카피 B (결과 중심)', '둘 다 비슷하다'] },
      { id: 'q2', text: '선택한 카피의 가장 강력한 부분은 어느 문구입니까?', type: 'text', options: [] },
      { id: 'q3', text: '이 이메일을 받았을 때 스팸으로 느껴질 가능성은?', type: 'scale', options: [] },
    ],
    variantAImageLabel: null, variantBImageLabel: null,
    variantABg: null, variantAAcc: null, variantBBg: null, variantBAcc: null,
  },
  {
    title: '나비 교육 플랫폼 온보딩 화면 A/B 비교',
    industry: '에듀테크',
    productDescription: '나비 플랫폼 첫 로그인 후 보이는 온보딩 웰컴 화면 두 가지 디자인입니다. 수강 첫 시작률 향상이 목표입니다.',
    variantA: '[화면 A — 목표 설정 우선]\n"나비에 오신 것을 환영합니다 🎉"\n\n첫 번째 단계로 학습 목표 선택: ① 업무 스킬 향상 ② 이직 준비 ③ 취미/자기계발\n선택 후 → AI가 맞춤 커리큘럼 추천 → 첫 강의 바로 시작',
    variantB: '[화면 B — 인기 강의 우선]\n"오늘 가장 많이 수강한 강의 TOP 3"\n\n1위 엑셀 자동화 (4.9★ · 12,340명) / 2위 파이썬 입문 (4.8★ · 9,800명) / 3위 ChatGPT 실무 활용 (4.9★ · 15,200명)\n바로 듣기 버튼 → 개인화 설정은 나중에',
    panelCount: 10,
    careerLevels: ['junior', 'middle'],
    questions: [
      { id: 'q1', text: '어느 온보딩 화면이 첫 강의를 바로 시작하게 만드는 동기를 더 줍니까?', type: 'radio', options: ['화면 A (목표 설정)', '화면 B (인기 강의)', '둘 다 비슷하다'] },
      { id: 'q2', text: '목표 설정 단계(화면 A)가 번거롭게 느껴집니까?', type: 'scale', options: [] },
      { id: 'q3', text: '선택한 화면 외 개선되었으면 하는 점은?', type: 'text', options: [] },
    ],
    variantAImageLabel: '온보딩 A 목표 설정', variantBImageLabel: '온보딩 B 인기 강의',
    variantABg: '#2d1b69', variantAAcc: '#f7b731',
    variantBBg: '#1e1e2e', variantBAcc: '#f7b731',
  },
  {
    title: '글로우 스킨케어 앱 광고 소재 A/B 비교 (인스타그램)',
    industry: '뷰티/코스메틱',
    productDescription: '글로우(Glow)는 AI 피부 분석 앱으로, 사용자가 셀피를 찍으면 피부 타입과 맞춤 스킨케어 루틴을 제안합니다. 2030 여성이 주 타겟이며, 인스타그램 릴스 후기 광고의 A/B 소재 비교입니다.',
    variantA: '[소재 A — 변화 전후 비교]\n"30일 루틴 사용 전후"\n\n실제 사용자 피부 사진 좌우 비교 (Before/After), 자연광 셀피, 진정성 있는 톤\n"피부가 이렇게 바뀔 줄 몰랐어요" 캡션 + "무료로 피부 분석하기" CTA',
    variantB: '[소재 B — AI 기술 강조]\n"AI가 분석한 내 피부 타입"\n\n앱 UI 화면 (스캔 중 애니메이션 + 결과 리포트 스크린샷), 테크 느낌의 블루/화이트 톤\n"지금 내 피부 분석해보기 →" CTA + "3초면 끝!" 강조 문구',
    panelCount: 12,
    careerLevels: ['junior'],
    questions: [
      { id: 'q1', text: '어느 소재가 앱을 다운로드하게 만드는 충동을 더 줍니까?', type: 'radio', options: ['소재 A (변화 전후)', '소재 B (AI 기술 강조)', '둘 다 비슷하다'] },
      { id: 'q2', text: '소재 A의 Before/After 사진이 신뢰할 만하게 느껴집니까?', type: 'scale', options: [] },
      { id: 'q3', text: '소재 B의 기술 강조 방식이 귀하의 피부 고민과 연결됩니까?', type: 'scale', options: [] },
      { id: 'q4', text: '이 두 소재 모두에서 아쉬운 점을 솔직하게 적어주세요.', type: 'text', options: [] },
    ],
    variantAImageLabel: '소재 A 전후 비교', variantBImageLabel: '소재 B AI 강조',
    variantABg: '#fff0f3', variantAAcc: '#ff6b81',
    variantBBg: '#e8f4fd', variantBAcc: '#1e90ff',
  },
];

// ══════════════════════════════════════════════════════════════
// 가격 검증(pricing) 서브 의뢰 데이터 (4개)
// ══════════════════════════════════════════════════════════════

const PRICING_MISSIONS = [
  {
    title: '아이리스 CRM 요금제 페이지 가격 감지 테스트',
    industry: 'SaaS / B2B',
    productDescription: '아이리스 CRM — 소규모 B2B 영업팀을 위한 AI CRM 솔루션. 현재 3개 플랜(스타터·그로스·엔터프라이즈)으로 구성되어 있으며, 그로스 플랜 전환율 최적화가 목표입니다.',
    pricingContent: `[아이리스 CRM 요금제]

◾ 스타터 — 월 29,000원 (팀원 3명 이하)
  • 고객 관리 무제한
  • 기본 파이프라인 1개
  • 이메일 연동
  • 월 미팅 로그 50건

◾ 그로스 — 월 89,000원 (팀원 10명 이하) ← 추천
  • 스타터 전체 포함
  • AI 리드 스코어링
  • 파이프라인 5개
  • 자동화 워크플로우 10개
  • Slack·Notion 연동
  • 우선 지원

◾ 엔터프라이즈 — 문의 가격 (팀원 무제한)
  • 그로스 전체 포함
  • 커스텀 필드 무제한
  • SSO·SAML
  • 전담 CSM
  • SLA 보장

14일 무료 체험 — 신용카드 불필요`,
    panelCount: 10,
    careerLevels: ['middle', 'senior'],
    questions: [
      { id: 'q1', text: '스타터(29,000원)와 그로스(89,000원)의 가격 차이가 납득됩니까?', type: 'scale', options: [] },
      { id: 'q2', text: '귀하의 팀이라면 어떤 플랜을 선택하겠습니까?', type: 'radio', options: ['스타터 (29,000원)', '그로스 (89,000원)', '엔터프라이즈 (문의)', '무료 체험 후 결정'] },
      { id: 'q3', text: '그로스 플랜에서 가장 매력적인 기능은 무엇입니까?', type: 'text', options: [] },
      { id: 'q4', text: '"엔터프라이즈 — 문의 가격" 구성이 전환 의사에 부정적인 영향을 줍니까?', type: 'scale', options: [] },
    ],
    imageLabel: '요금제 비교표 화면',
    imageBg: '#1a1a2e', imageAcc: '#6c63ff',
  },
  {
    title: '핏블리 프리미엄 구독 가격 페이지 구매 의향 테스트',
    industry: '헬스/피트니스',
    productDescription: '핏블리 홈트 앱의 프리미엄 구독 요금 구조입니다. 현재 전환율이 낮아 가격 표현 방식과 구조를 검증하고자 합니다.',
    pricingContent: `[핏블리 프리미엄 구독]

FREE — 영원히 무료
  • 기본 루틴 20개
  • 칼로리 트래커 (일 1회)
  • 주간 운동 목표 설정

PLUS — 월 9,900원
  (연간 결제 시 → 월 6,600원, 34% 절약)
  • 루틴 무제한 (200+개)
  • AI 맞춤 주간 플랜
  • 체성분 변화 그래프
  • 광고 없음

PRO — 월 19,900원
  (연간 결제 시 → 월 13,200원, 34% 절약)
  • PLUS 전체 포함
  • 1:1 AI 코치 채팅 (주 5회)
  • 영양사 상담 쿠폰 월 1회
  • 커뮤니티 챌린지 우선 등록

7일 무료 체험 후 과금 — 언제든 취소 가능`,
    panelCount: 12,
    careerLevels: ['junior', 'middle'],
    questions: [
      { id: 'q1', text: 'PLUS 플랜(월 9,900원)이 제공 가치 대비 합리적입니까?', type: 'scale', options: [] },
      { id: 'q2', text: '어떤 플랜을 선택하겠습니까?', type: 'radio', options: ['무료 유지', 'PLUS 월간', 'PLUS 연간', 'PRO 월간', 'PRO 연간'] },
      { id: 'q3', text: '"7일 무료 체험"이 결제 전환에 충분한 설득력이 있습니까?', type: 'scale', options: [] },
      { id: 'q4', text: '구매를 주저하게 만드는 가장 큰 이유는?', type: 'text', options: [] },
    ],
    imageLabel: '프리미엄 요금제 화면',
    imageBg: '#0d1b2a', imageAcc: '#00c896',
  },
  {
    title: '슬로우브루 프리미엄 커피 구독 가격 페이지 검증',
    industry: '식음료 / 구독',
    productDescription: '슬로우브루는 원두 정기 구독 서비스입니다. 월 1회·2회·4회 옵션이 있으며, 첫 구독 전환율을 높이기 위한 가격 구조를 검증합니다.',
    pricingContent: `[슬로우브루 원두 정기구독]

기본 — 월 1회 (250g)
  • 가격: 22,000원/회
  • 국가별 싱글오리진 로테이션
  • 취향 노트 동봉
  • 무료 배송

클래식 — 월 2회 (250g × 2)
  • 가격: 39,000원/월 (11% 절약)  ← 인기
  • 싱글오리진 + 블렌드 조합
  • 취향 설문 → AI 큐레이션
  • 전용 패키지 + 무료 배송

프리미엄 — 월 4회 (250g × 4)
  • 가격: 72,000원/월 (18% 절약)
  • 스페셜티 단일 로트 한정 원두
  • 로스터 노트 + 브루잉 가이드
  • 새벽 배송 + 반납 없는 드리퍼 증정

첫 구독 20% 할인 쿠폰 자동 적용`,
    panelCount: 10,
    careerLevels: ['junior', 'middle'],
    questions: [
      { id: 'q1', text: '"클래식 (월 2회, 39,000원)"이 커피 구독 서비스로 합리적입니까?', type: 'scale', options: [] },
      { id: 'q2', text: '어떤 플랜을 선택하겠습니까?', type: 'radio', options: ['기본 (월 1회)', '클래식 (월 2회)', '프리미엄 (월 4회)', '구독 안 함'] },
      { id: 'q3', text: '프리미엄 플랜의 "드리퍼 증정" 혜택이 선택에 영향을 줍니까?', type: 'scale', options: [] },
      { id: 'q4', text: '이 구독 서비스에서 가장 매력적인 부분과 아쉬운 부분을 각각 말해주세요.', type: 'text', options: [] },
    ],
    imageLabel: '구독 요금제 페이지',
    imageBg: '#3d2b1f', imageAcc: '#c9a87c',
  },
  {
    title: '클리어노트 AI 필기앱 학생 요금제 가격 민감도 테스트',
    industry: 'SaaS / 에듀테크',
    productDescription: '클리어노트는 수업/강의를 자동으로 텍스트 요약하고 플래시카드로 변환해주는 AI 필기앱입니다. 대학생과 수험생이 주 타겟이며, 학생 할인 전략의 적정 가격을 검증합니다.',
    pricingContent: `[클리어노트 요금제]

FREE
  • 월 5회 AI 요약
  • 플래시카드 월 20개
  • 기기 1대

학생 BASIC — 월 4,900원
  (대학 이메일 인증 필요, 연간 결제 시 3,900원/월)
  • AI 요약 무제한
  • 플래시카드 무제한
  • 기기 3대 동기화
  • 광고 없음

학생 PRO — 월 7,900원
  (연간 결제 시 6,200원/월)
  • BASIC 전체 포함
  • 음성 → 텍스트 실시간 변환
  • 교수자 공유 기능
  • GPT-4o 기반 퀴즈 자동 생성
  • 수강신청 일정 연동 (Beta)

일반 사용자 — 월 12,900원
  (학생 인증 없음)

30일 환불 보장 / 언제든 취소`,
    panelCount: 10,
    careerLevels: ['junior'],
    questions: [
      { id: 'q1', text: '학생 BASIC 4,900원이 대학생에게 부담 없는 가격입니까?', type: 'scale', options: [] },
      { id: 'q2', text: '학생 PRO(7,900원)와 BASIC(4,900원)의 차이가 업그레이드를 정당화합니까?', type: 'scale', options: [] },
      { id: 'q3', text: '어떤 플랜을 선택하겠습니까?', type: 'radio', options: ['무료 유지', '학생 BASIC', '학생 PRO', '일반 사용자'] },
      { id: 'q4', text: '"30일 환불 보장"이 구매 결정에 영향을 줍니까? 그 이유를 설명해주세요.', type: 'text', options: [] },
    ],
    imageLabel: '학생 요금제 비교 화면',
    imageBg: '#1a1a2e', imageAcc: '#a78bfa',
  },
];

// ══════════════════════════════════════════════════════════════
// 이메일 검증(email) 서브 의뢰 데이터 (4개)
// ══════════════════════════════════════════════════════════════

const EMAIL_MISSIONS = [
  {
    productDescription: '아이리스 CRM — B2B SaaS. 이 콜드메일은 중소 스타트업 영업팀 리더(팀장급 이상)에게 발송하는 첫 아웃리치 메일입니다.',
    emailContent: `제목: [질문] 영업 리드 추적, 지금도 스프레드시트 쓰고 계신가요?

안녕하세요, [이름]님.

저는 아이리스 CRM의 정민준이라고 합니다.

스타트업 영업팀 리더들과 대화하다 보면 가장 자주 듣는 말이 있어요.
"고객 정보가 팀원마다 다른 파일에 있어서 공유가 안 돼요."

팀 규모가 5명을 넘는 순간, 스프레드시트는 오히려 병목이 됩니다.

아이리스 CRM은 딱 15분 온보딩으로 팀 전체 리드를 한 화면에 모아줍니다.
AI가 리드 우선순위를 자동으로 정렬해서, 오늘 연락할 사람을 바로 알려드려요.

혹시 이번 주 15분 짜리 데모 콜을 잡을 수 있을까요?

정민준 드림
아이리스 CRM · Growth Lead
junjun@iriscrm.io`,
    industry: 'SaaS / B2B',
    panelCount: 10,
    careerLevels: ['middle', 'senior'],
    questions: [
      { id: 'q1', text: '이 이메일의 제목을 보고 열어볼 의향이 얼마나 됩니까?', type: 'scale', options: [] },
      { id: 'q2', text: '이 이메일이 스팸이나 광고처럼 느껴집니까?', type: 'radio', options: ['아니요, 진짜 같다', '약간 그렇다', '매우 그렇다'] },
      { id: 'q3', text: '데모 콜을 신청할 의향이 얼마나 됩니까?', type: 'scale', options: [] },
      { id: 'q4', text: '이 이메일에서 가장 마음에 들거나 거슬리는 문구를 적어주세요.', type: 'text', options: [] },
    ],
  },
  {
    productDescription: '핏블리 홈트 앱 — 앱 설치 후 7일간 미접속한 사용자를 대상으로 재활성화를 유도하는 이메일입니다. 수신자는 앱을 설치했지만 아직 운동을 시작하지 않은 20~35세 직장인입니다.',
    emailContent: `제목: [이름]님, 오늘 딱 7분만 투자해보세요 🏃

안녕하세요 [이름]님,

핏블리를 설치한 지 일주일이 됐네요.
혹시 아직 첫 운동을 못 시작하셨나요? 괜찮아요, 흔한 일이에요.

사실 저희 데이터를 보면 "오늘 딱 한 번만" 시작한 사람들의 78%가
다음 날도 운동합니다.

오늘을 위해 딱 맞는 7분 루틴을 준비해뒀어요:
→ [목 스트레칭 + 어깨 풀기 — 7분, 난이도 쉬움]

지금 앱을 열면 바로 시작할 수 있어요.
운동화 안 신어도 됩니다 😄

오늘 7분,
핏블리 드림`,
    industry: '헬스/피트니스',
    panelCount: 10,
    careerLevels: ['junior', 'middle'],
    questions: [
      { id: 'q1', text: '이 이메일을 받았을 때 앱을 다시 열어볼 의향이 얼마나 됩니까?', type: 'scale', options: [] },
      { id: 'q2', text: '"78%가 다음 날도 운동합니다" 통계가 신뢰할 만합니까?', type: 'scale', options: [] },
      { id: 'q3', text: '이메일 제목의 이모지(🏃)가 클릭률에 긍정적 영향을 줄 것 같습니까?', type: 'radio', options: ['예, 호감이 간다', '아니요, 오히려 스팸 같다', '무관하다'] },
      { id: 'q4', text: '이 이메일이 더 효과적이 되려면 어떤 변화가 필요할까요?', type: 'text', options: [] },
    ],
  },
  {
    productDescription: '글로우(Glow) AI 피부 분석 앱 — 피부 관련 콘텐츠에 관심 있는 뷰티 인플루언서와 블로거에게 브랜드 협업을 제안하는 콜드메일입니다.',
    emailContent: `제목: 피부 루틴 콘텐츠 다루시는 [이름]님께 — 협업 제안드립니다

안녕하세요 [이름]님,

인스타그램에서 피부 루틴 콘텐츠를 꾸준히 올리시는 걸 인상 깊게 보고 있었어요.
특히 지난달 "여름 피부 장벽 케어" 포스트의 반응이 정말 뜨거웠더라고요.

저희는 AI 피부 분석 앱 글로우(Glow)를 만들고 있어요.
셀피 한 장으로 피부 타입·수분도·색소 침착을 분석하고
딱 맞는 스킨케어 루틴을 추천해드리는 서비스입니다.

[이름]님 팔로워분들께 이런 경험을 나눠드리면 어떨까요?

협업 제안 내용:
• 앱 6개월 PRO 무료 제공
• 전용 할인코드 (팔로워 20% 할인)
• 콘텐츠 사용료 협의 (최소 보장 있음)

부담 없이 회신 주시면 자세한 내용 공유드릴게요.

글로우 파트너십 팀 드림
glow.collab@glowapp.ai`,
    industry: '뷰티/코스메틱',
    panelCount: 10,
    careerLevels: ['junior', 'middle'],
    questions: [
      { id: 'q1', text: '이 이메일이 실제 협업 제안처럼 진정성 있게 느껴집니까?', type: 'scale', options: [] },
      { id: 'q2', text: '제목을 보고 이메일을 열어볼 의향이 얼마나 됩니까?', type: 'scale', options: [] },
      { id: 'q3', text: '인플루언서 입장에서 이 제안에서 가장 매력적인 부분은?', type: 'radio', options: ['무료 PRO 제공', '팔로워 할인 코드', '콘텐츠 사용료', '앱 자체 관심'] },
      { id: 'q4', text: '이 이메일에서 개선했으면 하는 점을 솔직하게 적어주세요.', type: 'text', options: [] },
    ],
  },
  {
    productDescription: '나비 교육 플랫폼 — 무료 체험 기간(7일)이 끝나고 유료 전환을 하지 않은 사용자에게 보내는 전환 유도 이메일입니다. 수신자는 1~2개 강의를 수강한 직장인입니다.',
    emailContent: `제목: [이름]님이 들은 "엑셀 자동화 3강", 4강 내용이 핵심입니다

안녕하세요 [이름]님,

7일 체험 기간이 끝났습니다.
[이름]님이 수강하신 "엑셀 자동화 입문" 3강까지, 잘 들으셨나요?

사실 수강생들이 "이게 진짜 써먹힌다" 느끼는 건 4강부터입니다.
4강 주제: VLOOKUP 없이 데이터 합치기 — 실무에서 주 3시간을 아끼는 법

나비 PLUS로 계속 들으시면:
• 4강~10강 전체 수강 가능
• AI가 [이름]님 수강 패턴 분석 → 다음 주 맞춤 커리큘럼 제공
• 월 6,600원 (연간 결제 기준)

오늘 하루만: 첫 달 50% 할인 쿠폰 — NABI50
(내일 자정 만료)

→ [4강 이어보기 + 쿠폰 적용]

나비 팀 드림`,
    industry: '에듀테크',
    panelCount: 12,
    careerLevels: ['junior', 'middle'],
    questions: [
      { id: 'q1', text: '"4강이 핵심"이라는 제목 전략이 이메일을 열게 만드는 충동을 줍니까?', type: 'scale', options: [] },
      { id: 'q2', text: '"내일 자정 만료" 긴박감이 구매 결정을 촉진합니까?', type: 'scale', options: [] },
      { id: 'q3', text: '이 이메일을 받은 후 쿠폰을 사용해 결제할 의향은?', type: 'scale', options: [] },
      { id: 'q4', text: '이 이메일 전략에서 설득력을 떨어뜨리는 요소가 있다면?', type: 'text', options: [] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// 메인
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log('=== 전체 테스트 의뢰 일괄 생성 ===\n');

  // 1. 유저·기업 레코드 확인
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 조회 실패:', uErr.message); process.exit(1); }
  const adminUser = users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`❌ ${ADMIN_EMAIL} 계정 없음`); process.exit(1); }

  const { data: company, error: cErr } = await supabase
    .from('companies').select('id, name, plan').eq('user_id', adminUser.id).single();
  if (cErr || !company) { console.error('❌ company 레코드 없음:', cErr?.message); process.exit(1); }

  console.log(`✅ 기업: ${company.name || '(unnamed)'} (id: ${company.id})\n`);

  const results = { main: [], preference: [], pricing: [], email: [] };

  // ──────────────────────────────────────────────
  // 2. 메인 의뢰 (LP검증) 3개
  // ──────────────────────────────────────────────
  console.log('━━━ 메인 의뢰(LP검증) 3개 생성 ━━━');

  for (const [i, m] of MAIN_MISSIONS.entries()) {
    const missionId = randomUUID();
    console.log(`\n[메인 ${i+1}] ${m.title}`);

    // 이미지 업로드
    const imageUrls = [];
    for (const img of m.images) {
      const buf = makeSvg(img.label, img.bg, img.accent, img.sub);
      const path = `${company.id}/${missionId}/${img.file}`;
      try {
        const url = await uploadSvg(path, buf);
        imageUrls.push(url);
        console.log(`  ✅ 이미지: ${img.label}`);
      } catch (e) {
        console.warn(`  ⚠️  ${e.message}`);
      }
    }

    const persona = [
      `연령: ${m.personaAge}`, `소득: ${m.personaIncome}`,
      `직군: ${m.personaRole}`, m.personaContext,
    ].join(' / ');

    const description = JSON.stringify({
      product: m.title, lpUrl: m.lpUrl, briefText: m.briefText,
      industry: m.industry, panelCount: m.panelCount,
      careerLevels: m.careerLevels,
      selectedQuestions: m.questions,
      focusAreas: m.focusAreas,
      personaAge: m.personaAge, personaIncome: m.personaIncome,
      personaRole: m.personaRole, personaContext: m.personaContext,
    });

    const { error: iErr } = await supabase.from('missions').insert({
      id: missionId, company_id: company.id,
      title: m.title, type: 'landing_page',
      target_url: m.lpUrl, description, persona,
      panel_count: m.panelCount, filled_count: 0,
      reward_amount: 8000,
      status: 'active',
      assets: m.focusAreas,
      image_urls: imageUrls,
      estimated_minutes: 7,
    });

    if (iErr) { console.error(`  ❌ INSERT 실패: ${iErr.message}`); continue; }
    console.log(`  🎉 생성 완료 → id: ${missionId}`);
    results.main.push({ title: m.title, id: missionId });
  }

  // ──────────────────────────────────────────────
  // 3. 소재비교(preference) 4개
  // ──────────────────────────────────────────────
  console.log('\n━━━ 소재비교(preference) 서브 의뢰 4개 생성 ━━━');

  for (const [i, p] of PREFERENCE_MISSIONS.entries()) {
    const missionId = randomUUID();
    const testId = randomUUID();
    console.log(`\n[소재비교 ${i+1}] ${p.title}`);

    // 소재 이미지 업로드 (있는 경우만)
    let variantAImage = null;
    let variantBImage = null;

    if (p.variantABg && p.variantAImageLabel) {
      try {
        const buf = makeSvg(p.variantAImageLabel, p.variantABg, p.variantAAcc, 'VARIANT A');
        variantAImage = await uploadSvg(`${company.id}/${missionId}/va.svg`, buf);
        console.log('  ✅ 소재 A 이미지');
      } catch (e) { console.warn(`  ⚠️  ${e.message}`); }
    }
    if (p.variantBBg && p.variantBImageLabel) {
      try {
        const buf = makeSvg(p.variantBImageLabel, p.variantBBg, p.variantBAcc, 'VARIANT B');
        variantBImage = await uploadSvg(`${company.id}/${missionId}/vb.svg`, buf);
        console.log('  ✅ 소재 B 이미지');
      } catch (e) { console.warn(`  ⚠️  ${e.message}`); }
    }

    const description = JSON.stringify({
      variantA: p.variantA, variantB: p.variantB,
      variantAImage, variantBImage,
      productDescription: p.productDescription,
      industry: p.industry,
      selectedQuestions: p.questions,
      careerLevels: p.careerLevels,
    });

    const { error: mErr } = await supabase.from('missions').insert({
      id: missionId, company_id: company.id,
      title: p.title, type: 'preference',
      description,
      persona: `산업군: ${p.industry} / 제품: ${p.productDescription.substring(0, 60)}`,
      panel_count: p.panelCount, filled_count: 0,
      reward_amount: 4500,
      status: 'active',
      estimated_minutes: 5,
    });
    if (mErr) { console.error(`  ❌ missions INSERT 실패: ${mErr.message}`); continue; }

    const { error: tErr } = await supabase.from('preference_tests').insert({
      id: testId, company_id: company.id,
      asset_type: 'text', panel_size: p.panelCount,
      status: 'active', mission_id: missionId,
    });
    if (tErr) console.warn(`  ⚠️  preference_tests INSERT 실패: ${tErr.message}`);

    console.log(`  🎉 생성 완료 → id: ${missionId}`);
    results.preference.push({ title: p.title, id: missionId });
  }

  // ──────────────────────────────────────────────
  // 4. 가격검증(pricing) 4개
  // ──────────────────────────────────────────────
  console.log('\n━━━ 가격검증(pricing) 서브 의뢰 4개 생성 ━━━');

  for (const [i, p] of PRICING_MISSIONS.entries()) {
    const missionId = randomUUID();
    const testId = randomUUID();
    console.log(`\n[가격검증 ${i+1}] ${p.title}`);

    let pricingImage = null;
    try {
      const buf = makeSvg(p.imageLabel, p.imageBg, p.imageAcc, 'PRICING PAGE');
      pricingImage = await uploadSvg(`${company.id}/${missionId}/pricing.svg`, buf);
      console.log(`  ✅ 가격 페이지 이미지`);
    } catch (e) { console.warn(`  ⚠️  ${e.message}`); }

    const description = JSON.stringify({
      content: p.pricingContent, image: pricingImage,
      productDescription: p.productDescription,
      industry: p.industry,
      selectedQuestions: p.questions,
      careerLevels: p.careerLevels,
    });

    const { error: mErr } = await supabase.from('missions').insert({
      id: missionId, company_id: company.id,
      title: p.title, type: 'pricing',
      description,
      persona: `산업군: ${p.industry}`,
      panel_count: p.panelCount, filled_count: 0,
      reward_amount: 4500,
      status: 'active',
      estimated_minutes: 5,
    });
    if (mErr) { console.error(`  ❌ missions INSERT 실패: ${mErr.message}`); continue; }

    const { error: tErr } = await supabase.from('pricing_tests').insert({
      id: testId, company_id: company.id,
      status: 'active', mission_id: missionId,
    });
    if (tErr) console.warn(`  ⚠️  pricing_tests INSERT 실패: ${tErr.message}`);

    console.log(`  🎉 생성 완료 → id: ${missionId}`);
    results.pricing.push({ title: p.title, id: missionId });
  }

  // ──────────────────────────────────────────────
  // 5. 이메일검증(email) 4개
  // ──────────────────────────────────────────────
  console.log('\n━━━ 이메일검증(email) 서브 의뢰 4개 생성 ━━━');

  for (const [i, e] of EMAIL_MISSIONS.entries()) {
    const missionId = randomUUID();
    const testId = randomUUID();
    console.log(`\n[이메일검증 ${i+1}] 이메일 검증 — ${e.industry}`);

    const description = JSON.stringify({
      content: e.emailContent,
      productDescription: e.productDescription,
      industry: e.industry,
      selectedQuestions: e.questions,
      careerLevels: e.careerLevels,
    });

    const { error: mErr } = await supabase.from('missions').insert({
      id: missionId, company_id: company.id,
      title: '이메일 검증', type: 'email',
      description,
      persona: `산업군: ${e.industry}`,
      panel_count: e.panelCount, filled_count: 0,
      reward_amount: 4500,
      status: 'active',
      estimated_minutes: 5,
    });
    if (mErr) { console.error(`  ❌ missions INSERT 실패: ${mErr.message}`); continue; }

    const { error: tErr } = await supabase.from('cold_email_tests').insert({
      id: testId, company_id: company.id,
      email_text: e.emailContent,
      status: 'active', mission_id: missionId,
    });
    if (tErr) console.warn(`  ⚠️  cold_email_tests INSERT 실패: ${tErr.message}`);

    console.log(`  🎉 생성 완료 → id: ${missionId} (${e.industry})`);
    results.email.push({ industry: e.industry, id: missionId });
  }

  // ──────────────────────────────────────────────
  // 최종 결과 요약
  // ──────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════');
  console.log('🎉 전체 의뢰 생성 완료!');
  console.log('══════════════════════════════════════════════════');
  console.log(`\n메인 의뢰 (${results.main.length}/3개)`);
  results.main.forEach((r, i) => console.log(`  ${i+1}. ${r.title}\n     id: ${r.id}`));

  console.log(`\n소재비교 의뢰 (${results.preference.length}/4개)`);
  results.preference.forEach((r, i) => console.log(`  ${i+1}. ${r.title}\n     id: ${r.id}`));

  console.log(`\n가격검증 의뢰 (${results.pricing.length}/4개)`);
  results.pricing.forEach((r, i) => console.log(`  ${i+1}. ${r.title}\n     id: ${r.id}`));

  console.log(`\n이메일검증 의뢰 (${results.email.length}/4개)`);
  results.email.forEach((r, i) => console.log(`  ${i+1}. 이메일 검증 (${r.industry})\n     id: ${r.id}`));

  console.log('\n👉 확인: /company 또는 /company/results');
}

main().catch(e => { console.error('예상치 못한 오류:', e); process.exit(1); });
