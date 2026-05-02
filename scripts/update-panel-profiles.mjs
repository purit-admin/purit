import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/?([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const INDUSTRIES = [
  '이커머스 마케터', 'B2B SaaS 세일즈', '스타트업 PM', 'B2B 영업',
  '퍼포먼스 마케터', '브랜드 마케터', 'CRO 전문가', '콘텐츠 마케터',
  '스타트업 대표', '기타',
];

// 패널별 경력 설정
const EXPERIENCE_MAP = {
  1: '2년', 2: '2년', 3: '2년',
  4: '5년', 5: '5년', 6: '5년',
  7: '8년', 8: '8년',
  9: '15년', 10: '15년',
};

// 랜덤 직군 (중복 최소화를 위해 shuffle)
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function updatePanelProfiles() {
  console.log('패널 1~10 직군·경력 업데이트 시작...\n');

  // panel1@purit.io ~ panel10@purit.io 의 auth.users → panels 조회
  const emails = Array.from({ length: 10 }, (_, i) => `panel${i + 1}@purit.io`);

  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('유저 목록 조회 실패:', uErr.message); process.exit(1); }

  const panelUsers = emails.map(email => users.users.find(u => u.email === email)).filter(Boolean);
  if (panelUsers.length !== 10) {
    console.warn(`⚠️  패널 계정 ${panelUsers.length}개만 발견됨 (기대: 10개)`);
  }

  // 직군 랜덤 배정 (10개, 중복 허용하되 shuffle로 분산)
  const industryPool = shuffled([...INDUSTRIES, ...INDUSTRIES]).slice(0, 10);

  for (let i = 0; i < panelUsers.length; i++) {
    const user = panelUsers[i];
    const panelNum = i + 1;
    const industry = industryPool[i];
    const experience = EXPERIENCE_MAP[panelNum];

    const { error } = await supabase
      .from('panels')
      .update({ industry, experience })
      .eq('user_id', user.id);

    if (error) {
      console.error(`❌ panel${panelNum} 업데이트 실패:`, error.message);
    } else {
      console.log(`✅ panel${panelNum} (${user.email}) — 직군: ${industry}, 경력: ${experience}`);
    }
  }

  console.log('\n완료.');
}

updatePanelProfiles();
