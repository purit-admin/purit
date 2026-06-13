// QA 2-8: panels 테이블 health_insurance_url, linkedin_url 컬럼 값 확인
// VerifyDocs.jsx와 동일 경로(패널 로그인 → save_panel_verification_docs RPC)로 값 저장 후
// service role로 컬럼을 직접 조회해 검증한다. 끝에 원래 값으로 복원(테스트 계정 오염 방지).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPA_URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const TEST_EMAIL = 'panel1@purit.io';
const TEST_PASSWORD = '1234';
const TEST_LINKEDIN = 'https://linkedin.com/in/qa-test-2-8';

async function main() {
  // 1) 대상 패널 user_id 조회
  const { data: list, error: lErr } = await admin.auth.admin.listUsers();
  if (lErr) { console.error('유저 목록 조회 실패:', lErr.message); process.exit(1); }
  const u = list.users.find(x => x.email === TEST_EMAIL);
  if (!u) { console.error(`${TEST_EMAIL} 계정을 찾을 수 없음`); process.exit(1); }
  const userId = u.id;
  console.log(`대상 패널: ${TEST_EMAIL}  (user_id: ${userId})\n`);

  // 2) 변경 전 컬럼 값 (원본 백업 + 복원용)
  const cols = 'health_insurance_url, linkedin_url, portfolio_url, status';
  const { data: before } = await admin.from('panels').select(cols).eq('user_id', userId).single();
  console.log('── 변경 전 (BEFORE) ──');
  console.log(before, '\n');

  // 3) UI와 동일 경로: 패널로 로그인 후 RPC 호출
  const panelClient = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await panelClient.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (signErr) { console.error('패널 로그인 실패:', signErr.message); process.exit(1); }

  const healthPath = `${userId}/health_insurance.png`; // VerifyDocs가 저장하는 경로 형식과 동일
  const { data: rpcOk, error: rpcErr } = await panelClient.rpc('save_panel_verification_docs', {
    p_user_id: userId,
    p_health_insurance_url: healthPath,
    p_linkedin_url: TEST_LINKEDIN,
  });
  if (rpcErr) { console.error('RPC 실패:', rpcErr.message); process.exit(1); }
  console.log(`RPC save_panel_verification_docs 반환값: ${rpcOk}  (true=대상 행 업데이트됨)\n`);

  // 4) 변경 후 컬럼 값 — service role로 직접 조회 (DB 실제 반영 확인)
  const { data: after } = await admin.from('panels').select(cols).eq('user_id', userId).single();
  console.log('── 변경 후 (AFTER) ──');
  console.log(after, '\n');

  // 5) 판정
  const pass =
    after.health_insurance_url === healthPath &&
    after.linkedin_url === TEST_LINKEDIN;
  console.log('================ QA 2-8 결과 ================');
  console.log(`health_insurance_url: ${after.health_insurance_url}`);
  console.log(`linkedin_url        : ${after.linkedin_url}`);
  console.log(`status (참고, 2-9)  : ${after.status}  ${after.status === 'pending' ? '(pending 유지 OK)' : '(주의: pending 아님)'}`);
  console.log(pass ? '\n✅ PASS — 두 컬럼이 제출 값으로 정상 저장됨' : '\n❌ FAIL — 컬럼 값이 기대와 다름');
  console.log('=============================================\n');

  // 6) 원래 값으로 복원 (테스트 계정 오염 방지)
  await admin.from('panels').update({
    health_insurance_url: before.health_insurance_url,
    linkedin_url: before.linkedin_url,
  }).eq('user_id', userId);
  console.log('원본 값으로 복원 완료.');
}

main();
