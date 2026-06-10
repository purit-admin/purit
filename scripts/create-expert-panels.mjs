// create-expert-panels.mjs
// 무료 체험 의뢰 선점용 "전문가 패널" 2계정 생성·세팅 (개발/운영 전용)
//   - auth.users 생성(role=panel) → handle_new_user 트리거가 panels(status='pending') 자동 생성
//   - panels 를 status='active' + experience='시니어'(multiplier 2.0) + is_expert=true 로 갱신
//   - 어드민이 이 계정으로 로그인해 무료 체험 의뢰 슬롯을 선점 수락·피드백 작성
// 실행: node scripts/create-expert-panels.mjs   (.env.local 필요)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/?([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 전문가 패널 정의 — 시니어 등급(/시니어/ 매칭 → multiplier 2.0)
const EXPERTS = [
  { email: 'expert1@purit.io', password: 'purit1234!', name: 'Purit 전문가 1', industry: 'CRO 전문가',   experience: '시니어' },
  { email: 'expert2@purit.io', password: 'purit1234!', name: 'Purit 전문가 2', industry: '퍼포먼스 마케터', experience: '시니어' },
];

async function run() {
  console.log('전문가 패널 계정 생성 시작...\n');

  const { data: existing, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error('유저 목록 조회 실패:', listErr.message); process.exit(1); }

  for (const ex of EXPERTS) {
    let user = existing.users.find(u => u.email === ex.email);

    // 1) auth 계정 생성(없으면)
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: ex.email,
        password: ex.password,
        email_confirm: true,
        user_metadata: { role: 'panel', name: ex.name },
      });
      if (error) { console.error(`❌ ${ex.email} 생성 실패:`, error.message); continue; }
      user = data.user;
      console.log(`✅ auth 계정 생성: ${ex.email}`);
    } else {
      console.log(`↻ 기존 계정 사용: ${ex.email}`);
    }

    // 2) panels 갱신 — 트리거가 만든 pending 레코드를 active·전문가로 승격
    const { error: upErr } = await supabase
      .from('panels')
      .update({
        name:       ex.name,
        industry:   ex.industry,
        experience: ex.experience,
        status:     'active',
        is_expert:  true,
      })
      .eq('user_id', user.id);

    if (upErr) console.error(`❌ ${ex.email} panels 갱신 실패:`, upErr.message);
    else       console.log(`   → panels active·is_expert=true·${ex.experience} (${ex.industry})`);
  }

  console.log('\n완료. 어드민은 이 계정으로 로그인해 무료 체험 의뢰를 선점 수락하세요.');
}

run();
