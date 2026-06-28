import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/?([A-Z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// 컬럼/테이블 존재 확인: select ?select=col&limit=0
async function hasColumn(table, col) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=${col}&limit=0`, { headers: H });
  if (r.ok) return true;
  const t = await r.text();
  // 테이블 자체 없음 vs 컬럼 없음 구분
  if (/does not exist|Could not find the table|relation .* does not exist/i.test(t)) return `테이블/컬럼 없음`;
  return false;
}
async function hasTable(table) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=0`, { headers: H });
  return r.ok ? true : false;
}
// 함수 존재 확인: 빈 본문 {} 호출
//  - 인자 필요 함수: 404 + hint("Perhaps you meant ... fn(args)") → 존재
//  - 인자 없는 read 함수: 200 실행 → 존재
//  - 트리거 함수 등: 400/500 (schema cache 메시지 아님) → 존재(본문 진입)
//  - 진짜 없음: 404 PGRST202, hint 없음
async function hasFunction(fn) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: H, body: JSON.stringify({}),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (r.ok) return true;
  if (j && j.hint && /function/i.test(j.hint)) return true; // 시그니처 힌트 → 존재
  if (/Could not find the function/i.test(t) && !(j && j.hint)) return false; // 라우팅 실패 + 힌트 없음 → 없음
  return true; // schema cache 메시지가 아닌 다른 에러 → 본문 진입(존재)
}

const COLS = [
  ['101', 'companies', 'phone_verified'],
  ['103', 'team_members', 'phone'],
  ['104', 'feedbacks', 'revision_dismissed'],
  ['105', 'feedback_helpfulness_ratings', 'applied_hp_delta'],
  ['105', 'feedbacks', 'rejection_honor_delta'],
  ['108', 'panels', 'avatar_emoji'],
  ['109', 'panels', 'trust_score_count'],
  ['120', 'companies', 'subscription_cancel_at_period_end'],
];
const TABLES = [
  ['120', 'subscription_cancellations'],
];
const FUNCS = [
  ['103', 'save_my_phone'],
  ['105', 'reject_feedback_honor'],
  ['105', 'restore_feedback_honor'],
  ['109', 'recalc_panel_trust_score'],
  ['112', 'is_caller_admin'],
  ['115', 'admin_delete_feedback'],
  ['115', 'guard_mission_freemium_columns'],
  ['117', 'get_my_panel_id'],
  ['117', 'get_my_company_mission_ids'],
  ['117', 'get_my_feedback_mission_ids'],
  ['120', 'cancel_my_subscription'],
];

console.log('===== 컬럼 점검 (ALTER TABLE ADD COLUMN) =====');
for (const [m, t, c] of COLS) {
  const r = await hasColumn(t, c);
  console.log(`[${m}] ${t}.${c}: ${r === true ? '✅ 있음' : '❌ ' + r}`);
}
console.log('\n===== 테이블 점검 (CREATE TABLE) =====');
for (const [m, t] of TABLES) {
  const r = await hasTable(t);
  console.log(`[${m}] ${t}: ${r ? '✅ 있음' : '❌ 없음'}`);
}
console.log('\n===== 신규 함수 점검 (CREATE FUNCTION) =====');
for (const [m, f] of FUNCS) {
  const r = await hasFunction(f);
  console.log(`[${m}] ${f}(): ${r ? '✅ 있음' : '❌ 없음'}`);
}
console.log('\n※ 102/106/107/110/111/116/121 은 기존 함수 CREATE OR REPLACE(버전 교체)라 PostgREST로 버전 대조 불가.');
console.log('   위 신규 객체들이 모두 있으면 순차 적용 특성상 함께 적용됐을 가능성이 높음.');
