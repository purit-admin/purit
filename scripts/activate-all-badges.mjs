import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/?([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(envVars.VITE_SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TARGET_EMAIL = 'purit.admin@gmail.com';

// Profile.jsx BADGE_CATALOG 19개 전체 키 (RPC check_and_award_badges k1~k19와 1:1)
const ALL_BADGES = [
  '영점_조준', '유효_타격', '데이터_스캐너',
  '제로_데펙트', '크리티컬_샷', '트렌드_오라클',
  '절대_영도', '픽셀_아키텍트', '에이펙스_노드',
  '마이크로스코프', '퀵_타겟팅', '블랙_스완',
  '첫_발사', '삼연타', '댓글_장인', '스피드런', '듀얼_코어',
  '센추리', '인사이트_코어',
];

// 1) panels.email 로 직접 조회
let { data: panel, error } = await supabase
  .from('panels')
  .select('id, email, name, user_id, badges')
  .eq('email', TARGET_EMAIL)
  .maybeSingle();

// 2) 못 찾으면 auth.users에서 user_id로 폴백 조회
if (!panel) {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = list?.users?.find(x => x.email === TARGET_EMAIL);
  if (u) {
    const r = await supabase.from('panels').select('id, email, name, user_id, badges').eq('user_id', u.id).maybeSingle();
    panel = r.data;
  }
}

if (error) { console.error('조회 오류:', error.message); process.exit(1); }
if (!panel) {
  console.error(`❌ ${TARGET_EMAIL} 의 패널 레코드를 찾지 못했습니다.`);
  const { data: all } = await supabase.from('panels').select('email, name').limit(50);
  console.log('현재 패널 목록(최대 50):', all?.map(p => p.email).join(', '));
  process.exit(1);
}

console.log(`대상 패널: ${panel.name || '(이름없음)'} <${panel.email}>  id=${panel.id}`);
console.log(`현재 뱃지 ${panel.badges?.length || 0}개:`, panel.badges || []);

const { error: upErr } = await supabase
  .from('panels')
  .update({ badges: ALL_BADGES })
  .eq('id', panel.id);

if (upErr) { console.error('❌ 업데이트 실패:', upErr.message); process.exit(1); }

const { data: after } = await supabase.from('panels').select('badges').eq('id', panel.id).single();
console.log(`✅ 완료 — 뱃지 ${after?.badges?.length || 0}개 활성화:`, after?.badges);
