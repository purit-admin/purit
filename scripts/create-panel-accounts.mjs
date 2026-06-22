import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env.local 파일에서 환경변수 로드
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createPanelAccounts() {
  console.log('패널 계정 10개 생성 시작...\n');

  for (let i = 1; i <= 10; i++) {
    const email = `panel${i}@purit.io`;
    const password = '1234';
    const name = `패널${i}`;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'panel', name },
    });

    if (error) {
      console.error(`❌ panel${i} 생성 실패:`, error.message);
    } else {
      console.log(`✅ panel${i} 생성 완료 — ${email} (uid: ${data.user.id})`);
    }
  }

  console.log('\n완료.');
}

createPanelAccounts();
